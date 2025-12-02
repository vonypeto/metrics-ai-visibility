import { Injectable, Logger } from '@nestjs/common';
import mongoose from 'mongoose';
import pLimit from 'p-limit';
import * as crypto from 'crypto';
import {
  RunRepository,
  PromptRepository,
  BrandRepository,
  ResponseRepository,
  BrandMentionRepository,
} from '../llm-visibility.repositories';
import { LLMProviderService } from './llm-provider.service';
import { RateLimiterService } from '../../../libs/rate-limiter-module';
import type {
  IRun,
  IPrompt,
  IBrand,
  IResponse,
} from '../types/llm-visibility.interfaces';

export interface CreateRunDto {
  prompts: string[];
  brands: string[];
  models: { model: string; provider: string }[];
  notes?: string;
  idempotencyKey?: string;
  config?: {
    concurrencyLimit?: number;
    retryAttempts?: number;
    timeout?: number;
    rateLimitPerSecond?: number;
    enableCircuitBreaker?: boolean;
  };
}

export interface RunSummary {
  run: IRun;
  brandMetrics: Array<{
    brandName: string;
    totalMentions: number;
    mentionRate: number;
    avgPosition?: number;
    byPrompt: Array<{
      promptText: string;
      mentioned: boolean;
      mentionCount: number;
      models: string[];
    }>;
  }>;
  promptMetrics: Array<{
    promptText: string;
    totalResponses: number;
    successfulResponses: number;
    brandsMetioned: string[];
  }>;
}

@Injectable()
export class LLMVisibilityService {
  private readonly logger = new Logger(LLMVisibilityService.name);

  constructor(
    private readonly runRepository: RunRepository,
    private readonly promptRepository: PromptRepository,
    private readonly brandRepository: BrandRepository,
    private readonly responseRepository: ResponseRepository,
    private readonly brandMentionRepository: BrandMentionRepository,
    private readonly llmProvider: LLMProviderService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.rateLimiter.createProviderLimiters();
  }

  /**
   * Generate a content hash for idempotency based on prompts, brands, and models
   */
  private generateContentHash(dto: CreateRunDto): string {
    const content = {
      prompts: [...dto.prompts].sort(),
      brands: [...dto.brands].sort(),
      models: [...dto.models].sort((a, b) =>
        `${a.provider}:${a.model}`.localeCompare(`${b.provider}:${b.model}`),
      ),
    };
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }

  async createRun(dto: CreateRunDto): Promise<{ run: IRun; isNew: boolean }> {
    const existingRun = await this.checkExistingRun(dto);
    if (existingRun) {
      return { run: existingRun, isNew: false };
    }

    const [prompts, brands] = await Promise.all([
      Promise.all(
        dto.prompts.map((text) => this.promptRepository.findOrCreate(text)),
      ),
      Promise.all(
        dto.brands.map((name) => this.brandRepository.findOrCreate(name)),
      ),
    ]);

    const run = await this.runRepository.create({
      notes: dto.notes,
      status: 'pending',
      totalPrompts: prompts.length * dto.models.length,
      completedPrompts: 0,
      failedPrompts: 0,
      idempotencyKey: dto.idempotencyKey,
      contentHash: this.generateContentHash(dto),
      config: {
        brands: dto.brands,
        models: dto.models.map((m) => `${m.provider}:${m.model}`),
        concurrencyLimit: dto.config?.concurrencyLimit || 5,
        retryAttempts: dto.config?.retryAttempts || 3,
        timeout: dto.config?.timeout || 30000,
        rateLimitPerSecond: dto.config?.rateLimitPerSecond,
        enableCircuitBreaker: dto.config?.enableCircuitBreaker !== false,
      },
    } as any);

    this.processRun(run._id.toString(), prompts, brands, dto.models).catch(
      (error) => {
        this.logger.error(`Run ${run._id} failed: ${error.message}`);
      },
    );

    return { run, isNew: true };
  }

  private async checkExistingRun(dto: CreateRunDto): Promise<IRun | null> {
    if (dto.idempotencyKey) {
      const existing = await this.runRepository.findByIdempotencyKey(
        dto.idempotencyKey,
      );
      if (existing) {
        this.logger.log(
          `Returning existing run ${existing._id} (idempotency key)`,
        );
        return existing;
      }
    }

    const contentHash = this.generateContentHash(dto);
    const duplicate = await this.runRepository.findByContentHash(contentHash);
    if (duplicate) {
      const ageMinutes = (Date.now() - duplicate.createdAt.getTime()) / 60000;
      if (ageMinutes < 5) {
        this.logger.log(
          `Returning duplicate run ${duplicate._id} (${ageMinutes.toFixed(1)}min old)`,
        );
        return duplicate;
      }
    }

    return null;
  }

  private async processRun(
    runId: string,
    prompts: IPrompt[],
    brands: IBrand[],
    models: { model: string; provider: string }[],
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(
      `Starting run ${runId}: ${prompts.length} prompts × ${models.length} models`,
    );

    await this.runRepository.updateProgress(runId, { status: 'running' });

    const run = await this.runRepository.findById(
      new mongoose.Types.ObjectId(runId),
    );
    if (!run) throw new Error('Run not found');

    const { latencies, totalTokens } = await this.processAllPairs(
      run,
      prompts,
      brands,
      models,
    );

    await this.updateRunCompletion(
      runId,
      startTime,
      latencies,
      totalTokens,
      models,
    );
  }

  private async processAllPairs(
    run: IRun,
    prompts: IPrompt[],
    brands: IBrand[],
    models: { model: string; provider: string }[],
  ): Promise<{ latencies: number[]; totalTokens: number }> {
    const limit = pLimit(run.config.concurrencyLimit || 5);
    const latencies: number[] = [];
    let totalTokens = 0;

    const tasks = prompts.flatMap((prompt) =>
      models.map((model) =>
        limit(async () => {
          const tokens = await this.processPromptModelPair(
            run._id.toString(),
            prompt,
            brands,
            model,
            run.config.retryAttempts || 3,
            run.config.timeout || 30000,
            run.config.enableCircuitBreaker !== false,
            latencies,
          );
          totalTokens += tokens;
        }),
      ),
    );

    await Promise.allSettled(tasks);
    return { latencies, totalTokens };
  }

  private async updateRunCompletion(
    runId: string,
    startTime: number,
    latencies: number[],
    totalTokens: number,
    models: { model: string; provider: string }[],
  ): Promise<void> {
    const duration = Date.now() - startTime;
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    const responses = await this.responseRepository.findByRun(runId);
    const successCount = responses.filter((r) => r.status === 'success').length;
    const failedCount = responses.filter((r) => r.status !== 'success').length;

    await this.runRepository.updateProgress(runId, {
      status:
        failedCount === 0
          ? 'completed'
          : failedCount < responses.length
            ? 'partial'
            : 'failed',
      completedPrompts: successCount,
      failedPrompts: failedCount,
    });

    await this.runRepository.updateMetrics(runId, {
      totalDurationMs: duration,
      avgLatencyMs: Math.round(avgLatency),
      totalTokensUsed: totalTokens,
      estimatedCost: this.estimateCost(totalTokens, models),
    });

    this.logger.log(
      `Run ${runId} completed in ${(duration / 1000).toFixed(2)}s: ${successCount} ok, ${failedCount} failed`,
    );
  }

  /**
   * Estimate cost based on tokens and models used
   */
  private estimateCost(
    totalTokens: number,
    models: { model: string; provider: string }[],
  ): number {
    const costPerToken: Record<string, number> = {
      'gpt-4o-mini': 0.00000015,
      'gpt-4o': 0.000005,
      'gpt-3.5-turbo': 0.0000005,
      'claude-3-5-sonnet-20241022': 0.000003,
      'claude-3-5-haiku-20241022': 0.0000008,
    };

    const avgCost =
      models.reduce((sum, m) => {
        return sum + (costPerToken[m.model] || 0.000001);
      }, 0) / models.length;

    return totalTokens * avgCost;
  }

  private async processPromptModelPair(
    runId: string,
    prompt: IPrompt,
    brands: IBrand[],
    modelConfig: { model: string; provider: string },
    maxRetries: number,
    timeout: number,
    useCircuitBreaker: boolean,
    latencies: number[],
  ): Promise<number> {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const llmResponse = await this.rateLimiter.scheduleWithDistributedLimit(
          modelConfig.provider,
          () =>
            this.llmProvider.callLLM(prompt.text, {
              model: modelConfig.model,
              provider: modelConfig.provider,
              timeout,
              useCircuitBreaker,
            }),
        );

        latencies.push(llmResponse.latencyMs);
        const response = await this.saveResponse(
          runId,
          prompt,
          modelConfig,
          llmResponse,
          retryCount,
        );
        await this.analyzeBrandMentions(response, brands, llmResponse.text);

        return llmResponse.tokenUsage?.totalTokens || 0;
      } catch (error) {
        const errorMsg = (error as Error)?.message || '';
        const isRateLimit = this.isRateLimitError(errorMsg);

        if (isRateLimit || retryCount >= maxRetries) {
          await this.saveFailedResponse(
            runId,
            prompt,
            modelConfig,
            error as Error,
            retryCount,
            isRateLimit,
          );
          return 0;
        }

        retryCount++;
        await this.delayWithBackoff(retryCount);
        this.logger.warn(
          `Retry ${retryCount}/${maxRetries}: ${modelConfig.provider}:${modelConfig.model}`,
        );
      }
    }

    return 0;
  }

  private isRateLimitError(errorMsg: string): boolean {
    return (
      errorMsg.includes('Rate limit') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('429') ||
      errorMsg.includes('Too Many Requests')
    );
  }

  private async delayWithBackoff(retryCount: number): Promise<void> {
    const baseDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
    const jitter = Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
  }

  private async saveResponse(
    runId: string,
    prompt: IPrompt,
    modelConfig: { model: string; provider: string },
    llmResponse: any,
    retryCount: number,
  ): Promise<IResponse> {
    return this.responseRepository.create({
      runId: new mongoose.Types.ObjectId(runId),
      promptId: prompt._id,
      modelName: modelConfig.model,
      provider: modelConfig.provider,
      latencyMs: llmResponse.latencyMs,
      rawText: llmResponse.text,
      tokenUsage: llmResponse.tokenUsage,
      metadata: llmResponse.metadata,
      status: 'success',
      retryCount,
    } as any);
  }

  private async saveFailedResponse(
    runId: string,
    prompt: IPrompt,
    modelConfig: { model: string; provider: string },
    error: Error,
    retryCount: number,
    isRateLimit: boolean,
  ): Promise<void> {
    const status = isRateLimit ? 'rate_limited' : 'failed';
    const errorMessage = isRateLimit
      ? `Rate limit exceeded: ${error.message}`
      : error.message || 'Unknown error';

    await this.responseRepository.create({
      runId: new mongoose.Types.ObjectId(runId),
      promptId: prompt._id,
      modelName: modelConfig.model,
      provider: modelConfig.provider,
      latencyMs: 0,
      rawText: '',
      status,
      errorMessage,
      retryCount,
    } as any);

    const logMethod = isRateLimit ? 'warn' : 'error';
    this.logger[logMethod](
      `${status}: ${modelConfig.provider}:${modelConfig.model} - ${errorMessage}`,
    );
  }

  private async analyzeBrandMentions(
    response: IResponse,
    brands: IBrand[],
    responseText: string,
  ): Promise<void> {
    const lowerText = responseText.toLowerCase();

    const mentions = brands.map((brand) => {
      const brandLower = brand.name.toLowerCase();
      const mentioned = lowerText.includes(brandLower);

      if (!mentioned) {
        return {
          responseId: response._id,
          brandId: brand._id,
          mentioned: false,
          positionIndex: undefined,
          mentionCount: 0,
          context: undefined,
        };
      }

      const mentionCount = (lowerText.match(new RegExp(brandLower, 'g')) || [])
        .length;
      const positionIndex = lowerText.indexOf(brandLower);

      const start = Math.max(0, positionIndex - 50);
      const end = Math.min(
        responseText.length,
        positionIndex + brandLower.length + 50,
      );
      const context = responseText.substring(start, end);

      return {
        responseId: response._id,
        brandId: brand._id,
        mentioned: true,
        positionIndex,
        mentionCount,
        context,
      };
    });

    await Promise.all(
      mentions.map((m) => this.brandMentionRepository.create(m as any)),
    );
  }

  async getRunSummary(runId: string): Promise<RunSummary> {
    const run = await this.runRepository.findById(
      new mongoose.Types.ObjectId(runId),
    );
    if (!run) throw new Error('Run not found');

    const data = await this.brandMentionRepository.getAggregatedMetrics(runId);

    const brandMap = new Map<string, any>();
    const promptMap = new Map<string, any>();

    for (const item of data) {
      this.aggregateBrandMetrics(brandMap, item);
      this.aggregatePromptMetrics(promptMap, item);
    }

    return {
      run,
      brandMetrics: Array.from(brandMap.values()).map((b) => ({
        ...b,
        mentionRate:
          b.byPrompt.length > 0 ? b.mentionCount / b.byPrompt.length : 0,
      })),
      promptMetrics: Array.from(promptMap.values()).map((p) => ({
        ...p,
        brandsMetioned: Array.from(p.brandsMetioned),
      })),
    };
  }

  private aggregateBrandMetrics(brandMap: Map<string, any>, item: any): void {
    const { brandName, promptText, model, totalMentions, mentioned } = {
      brandName: item._id.brandName,
      promptText: item._id.promptText,
      model: item._id.model,
      totalMentions: item.totalMentions,
      mentioned: item.mentioned,
    };

    if (!brandMap.has(brandName)) {
      brandMap.set(brandName, {
        brandName,
        totalMentions: 0,
        mentionCount: 0,
        byPrompt: [],
      });
    }

    const brand = brandMap.get(brandName);
    brand.totalMentions += totalMentions;
    if (mentioned) brand.mentionCount++;

    let promptEntry = brand.byPrompt.find(
      (p: any) => p.promptText === promptText,
    );
    if (!promptEntry) {
      promptEntry = {
        promptText,
        mentioned: false,
        mentionCount: 0,
        models: [],
      };
      brand.byPrompt.push(promptEntry);
    }

    if (mentioned) {
      promptEntry.mentioned = true;
      promptEntry.mentionCount += totalMentions;
    }
    promptEntry.models.push(model);
  }

  private aggregatePromptMetrics(promptMap: Map<string, any>, item: any): void {
    const { promptText, brandName, mentioned } = {
      promptText: item._id.promptText,
      brandName: item._id.brandName,
      mentioned: item.mentioned,
    };

    if (!promptMap.has(promptText)) {
      promptMap.set(promptText, {
        promptText,
        totalResponses: 0,
        successfulResponses: 0,
        brandsMetioned: new Set(),
      });
    }

    const prompt = promptMap.get(promptText);
    prompt.totalResponses++;
    if (mentioned) {
      prompt.successfulResponses++;
      prompt.brandsMetioned.add(brandName);
    }
  }

  async listRuns(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: IRun[]; total: number }> {
    const [data, total] = await Promise.all([
      this.runRepository.findAll(page, limit),
      this.runRepository.countAll(),
    ]);
    return { data, total };
  }

  async getRunById(runId: string): Promise<IRun | null> {
    return this.runRepository.findById(new mongoose.Types.ObjectId(runId));
  }

  async getRunChat(runId: string): Promise<{
    run: IRun;
    conversations: Array<{
      prompt: string;
      promptId: string;
      responses: Array<{
        model: string;
        provider: string;
        text: string;
        latencyMs: number;
        tokenUsage?: {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        };
        status: string;
        errorMessage?: string;
        timestamp: Date;
        brandMentions?: Array<{
          brandName: string;
          mentioned: boolean;
          mentionCount: number;
          context?: string;
        }>;
      }>;
    }>;
  }> {
    const run = await this.runRepository.findById(
      new mongoose.Types.ObjectId(runId),
    );
    if (!run) throw new Error('Run not found');

    const responses = await this.responseRepository.findByRun(runId);

    const promptIds = [...new Set(responses.map((r) => r.promptId.toString()))];
    const prompts = await Promise.all(
      promptIds.map((id) =>
        this.promptRepository.findById(new mongoose.Types.ObjectId(id)),
      ),
    );
    const promptMap = new Map(
      prompts
        .filter((p): p is IPrompt => p !== null)
        .map((p) => [p._id.toString(), p.text]),
    );

    const responseIds = responses.map((r) => r._id);
    const allMentions = await Promise.all(
      responseIds.map((id) =>
        this.brandMentionRepository.findByResponse(id.toString()),
      ),
    );
    const mentionMap = new Map(
      responseIds.map((id, idx) => [id.toString(), allMentions[idx]]),
    );

    const promptResponseMap = new Map<string, IResponse[]>();
    for (const response of responses) {
      const pid = response.promptId.toString();
      if (!promptResponseMap.has(pid)) promptResponseMap.set(pid, []);
      promptResponseMap.get(pid)!.push(response);
    }

    const conversations = Array.from(promptResponseMap.entries()).map(
      ([promptId, promptResponses]) => ({
        prompt: promptMap.get(promptId) || 'Unknown prompt',
        promptId,
        responses: promptResponses.map((r) => ({
          model: r.modelName,
          provider: r.provider,
          text: r.rawText,
          latencyMs: r.latencyMs,
          tokenUsage: r.tokenUsage,
          status: r.status,
          errorMessage: r.errorMessage,
          timestamp: r.timestamp,
          brandMentions: (mentionMap.get(r._id.toString()) || []).map((m) => ({
            brandName: (m.brandId as any).name || 'Unknown',
            mentioned: m.mentioned,
            mentionCount: m.mentionCount || 0,
            context: m.context,
          })),
        })),
      }),
    );

    return { run, conversations };
  }
}
