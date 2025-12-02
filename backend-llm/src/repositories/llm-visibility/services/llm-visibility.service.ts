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
  idempotencyKey?: string; // Client-provided idempotency key
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
    // Initialize provider-specific rate limiters
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
    // Check for idempotency key first
    if (dto.idempotencyKey) {
      const existing = await this.runRepository.findByIdempotencyKey(
        dto.idempotencyKey,
      );
      if (existing) {
        this.logger.log(
          `Returning existing run ${existing._id} for idempotency key ${dto.idempotencyKey}`,
        );
        return { run: existing, isNew: false };
      }
    }

    // Check for duplicate content (same prompts, brands, models)
    const contentHash = this.generateContentHash(dto);
    const recentDuplicate =
      await this.runRepository.findByContentHash(contentHash);

    if (recentDuplicate) {
      const ageMinutes =
        (Date.now() - recentDuplicate.createdAt.getTime()) / 60000;
      // If duplicate is less than 5 minutes old, return it
      if (ageMinutes < 5) {
        this.logger.log(
          `Returning recent duplicate run ${recentDuplicate._id} (${ageMinutes.toFixed(1)}min old)`,
        );
        return { run: recentDuplicate, isNew: false };
      }
    }

    // Create or get prompts and brands
    const prompts = await Promise.all(
      dto.prompts.map((text) => this.promptRepository.findOrCreate(text)),
    );

    const brands = await Promise.all(
      dto.brands.map((name) => this.brandRepository.findOrCreate(name)),
    );

    // Create run
    const totalPrompts = prompts.length * dto.models.length;
    const run = await this.runRepository.create({
      notes: dto.notes,
      status: 'pending',
      totalPrompts,
      completedPrompts: 0,
      failedPrompts: 0,
      idempotencyKey: dto.idempotencyKey,
      contentHash,
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

    // Start processing asynchronously
    this.processRun(run._id.toString(), prompts, brands, dto.models).catch(
      (error) => {
        this.logger.error(
          `Run ${run._id} processing failed: ${error.message}`,
          error.stack,
        );
      },
    );

    return { run, isNew: true };
  }

  private async processRun(
    runId: string,
    prompts: IPrompt[],
    brands: IBrand[],
    models: { model: string; provider: string }[],
  ): Promise<void> {
    const runStartTime = Date.now();
    this.logger.log(
      `Starting run ${runId} with ${prompts.length} prompts and ${models.length} models`,
    );

    // Update run status
    await this.runRepository.updateProgress(runId, {
      status: 'running',
    });

    const run = await this.runRepository.findById(
      new mongoose.Types.ObjectId(runId),
    );
    if (!run) throw new Error('Run not found');

    const concurrencyLimit = run.config.concurrencyLimit || 5;
    const limit = pLimit(concurrencyLimit);

    // Track metrics
    const latencies: number[] = [];
    let totalTokens = 0;

    // Create tasks for all prompt-model combinations
    const tasks: Promise<void>[] = [];

    for (const prompt of prompts) {
      for (const modelConfig of models) {
        const task = limit(() =>
          this.processPromptModelPair(
            runId,
            prompt,
            brands,
            modelConfig,
            run.config.retryAttempts || 3,
            run.config.timeout || 30000,
            run.config.enableCircuitBreaker !== false,
            latencies,
          ).then((tokens) => {
            if (tokens) totalTokens += tokens;
          }),
        );
        tasks.push(task);
      }
    }

    // Wait for all tasks to complete
    await Promise.allSettled(tasks);

    // Calculate final metrics
    const runDuration = Date.now() - runStartTime;
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    // Update final run status
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

    // Update metrics
    await this.runRepository.updateMetrics(runId, {
      totalDurationMs: runDuration,
      avgLatencyMs: Math.round(avgLatency),
      totalTokensUsed: totalTokens,
      estimatedCost: this.estimateCost(totalTokens, models),
    });

    this.logger.log(
      `Run ${runId} completed in ${(runDuration / 1000).toFixed(2)}s: ${successCount} succeeded, ${failedCount} failed`,
    );
  }

  /**
   * Estimate cost based on tokens and models used
   */
  private estimateCost(
    totalTokens: number,
    models: { model: string; provider: string }[],
  ): number {
    // Rough estimates (adjust based on actual pricing)
    const costPerToken: Record<string, number> = {
      'gpt-4o-mini': 0.00000015, // $0.15 per 1M tokens
      'gpt-4o': 0.000005, // $5 per 1M tokens
      'gpt-3.5-turbo': 0.0000005, // $0.50 per 1M tokens
      'claude-3-5-sonnet-20241022': 0.000003, // $3 per 1M tokens
      'claude-3-5-haiku-20241022': 0.0000008, // $0.80 per 1M tokens
    };

    // Use average cost if multiple models
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
    let lastError: Error | undefined;

    while (retryCount <= maxRetries) {
      try {
        // Use distributed rate limiter if available (shared across workers)
        // Falls back to local rate limiter if Redis not available
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

        // Track latency
        latencies.push(llmResponse.latencyMs);

        // Store response
        const response = await this.responseRepository.create({
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

        // Analyze brand mentions
        await this.analyzeBrandMentions(response, brands, llmResponse.text);

        return llmResponse.tokenUsage?.totalTokens || 0;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount <= maxRetries) {
          // Exponential backoff with jitter
          const baseDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;

          await new Promise((resolve) => setTimeout(resolve, delay));
          this.logger.warn(
            `Retry ${retryCount}/${maxRetries} for prompt ${prompt._id} with ${modelConfig.provider}:${modelConfig.model} after ${delay.toFixed(0)}ms`,
          );
        }
      }
    }

    // All retries failed, store error response
    await this.responseRepository.create({
      runId: new mongoose.Types.ObjectId(runId),
      promptId: prompt._id,
      modelName: modelConfig.model,
      provider: modelConfig.provider,
      latencyMs: 0,
      rawText: '',
      status: 'failed',
      errorMessage: lastError?.message || 'Unknown error',
      retryCount: maxRetries,
    } as any);

    this.logger.error(
      `Failed to process prompt ${prompt._id} with ${modelConfig.provider}:${modelConfig.model} after ${maxRetries} retries: ${lastError?.message}`,
    );

    return 0;
  }

  private async analyzeBrandMentions(
    response: IResponse,
    brands: IBrand[],
    responseText: string,
  ): Promise<void> {
    const lowerText = responseText.toLowerCase();

    for (const brand of brands) {
      const brandNameLower = brand.name.toLowerCase();
      const mentioned = lowerText.includes(brandNameLower);

      let positionIndex: number | undefined;
      let mentionCount = 0;
      let context: string | undefined;

      if (mentioned) {
        positionIndex = lowerText.indexOf(brandNameLower);

        // Count all occurrences
        let pos = 0;
        while ((pos = lowerText.indexOf(brandNameLower, pos)) !== -1) {
          mentionCount++;
          pos += brandNameLower.length;
        }

        // Extract context (50 chars before and after first mention)
        if (positionIndex !== -1) {
          const start = Math.max(0, positionIndex - 50);
          const end = Math.min(
            responseText.length,
            positionIndex + brandNameLower.length + 50,
          );
          context = responseText.substring(start, end);
        }
      }

      await this.brandMentionRepository.create({
        responseId: response._id,
        brandId: brand._id,
        mentioned,
        positionIndex,
        mentionCount,
        context,
      } as any);
    }
  }

  async getRunSummary(runId: string): Promise<RunSummary> {
    const run = await this.runRepository.findById(
      new mongoose.Types.ObjectId(runId),
    );
    if (!run) {
      throw new Error('Run not found');
    }

    const aggregatedData =
      await this.brandMentionRepository.getAggregatedMetrics(runId);

    // Group by brand
    const brandMap = new Map<string, any>();
    const promptMap = new Map<string, any>();

    for (const item of aggregatedData) {
      const brandName = item._id.brandName;
      const promptText = item._id.promptText;
      const modelName = item._id.model;

      // Brand metrics
      if (!brandMap.has(brandName)) {
        brandMap.set(brandName, {
          brandName,
          totalMentions: 0,
          mentionCount: 0,
          byPrompt: [],
        });
      }
      const brandData = brandMap.get(brandName);
      brandData.totalMentions += item.totalMentions;
      if (item.mentioned) brandData.mentionCount++;

      let promptEntry = brandData.byPrompt.find(
        (p: any) => p.promptText === promptText,
      );
      if (!promptEntry) {
        promptEntry = {
          promptText,
          mentioned: false,
          mentionCount: 0,
          models: [],
        };
        brandData.byPrompt.push(promptEntry);
      }
      if (item.mentioned) {
        promptEntry.mentioned = true;
        promptEntry.mentionCount += item.totalMentions;
      }
      promptEntry.models.push(modelName);

      // Prompt metrics
      if (!promptMap.has(promptText)) {
        promptMap.set(promptText, {
          promptText,
          totalResponses: 0,
          successfulResponses: 0,
          brandsMetioned: new Set(),
        });
      }
      const promptData = promptMap.get(promptText);
      promptData.totalResponses++;
      if (item.mentioned) {
        promptData.successfulResponses++;
        promptData.brandsMetioned.add(brandName);
      }
    }

    // Calculate rates
    const brandMetrics = Array.from(brandMap.values()).map((brand) => ({
      ...brand,
      mentionRate:
        brand.byPrompt.length > 0
          ? brand.mentionCount / brand.byPrompt.length
          : 0,
    }));

    const promptMetrics = Array.from(promptMap.values()).map((prompt) => ({
      ...prompt,
      brandsMetioned: Array.from(prompt.brandsMetioned),
    }));
    return {
      run,
      brandMetrics,
      promptMetrics,
    };
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

  /**
   * Get chat-like view of a run showing prompts and their responses
   */
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
    if (!run) {
      throw new Error('Run not found');
    }

    // Get all responses for this run
    const responses = await this.responseRepository.findByRun(runId);

    // Get all unique prompt IDs and fetch prompts
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

    // Get all brand mentions for these responses
    const responseIds = responses.map((r) => r._id);
    const allBrandMentions = await Promise.all(
      responseIds.map((id) =>
        this.brandMentionRepository.findByResponse(id.toString()),
      ),
    );
    const brandMentionMap = new Map(
      responseIds.map((id, idx) => [id.toString(), allBrandMentions[idx]]),
    );

    // Group responses by prompt
    const promptResponseMap = new Map<string, IResponse[]>();
    for (const response of responses) {
      const promptId = response.promptId.toString();
      if (!promptResponseMap.has(promptId)) {
        promptResponseMap.set(promptId, []);
      }
      promptResponseMap.get(promptId)!.push(response);
    }

    // Build conversations
    const conversations = Array.from(promptResponseMap.entries()).map(
      ([promptId, promptResponses]) => ({
        prompt: promptMap.get(promptId) || 'Unknown prompt',
        promptId,
        responses: promptResponses.map((response) => {
          const mentions = brandMentionMap.get(response._id.toString()) || [];
          return {
            model: response.modelName,
            provider: response.provider,
            text: response.rawText,
            latencyMs: response.latencyMs,
            tokenUsage: response.tokenUsage,
            status: response.status,
            errorMessage: response.errorMessage,
            timestamp: response.timestamp,
            brandMentions: mentions.map((mention) => ({
              brandName: (mention.brandId as any).name || 'Unknown',
              mentioned: mention.mentioned,
              mentionCount: mention.mentionCount || 0,
              context: mention.context,
            })),
          };
        }),
      }),
    );

    return {
      run,
      conversations,
    };
  }
}
