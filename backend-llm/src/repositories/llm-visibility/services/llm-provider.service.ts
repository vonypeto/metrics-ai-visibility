import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../../libs/nestjs-config-module/src';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CircuitBreakerService } from '../../../libs/circuit-breaker-module';

export interface LLMResponse {
  text: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

export interface LLMProviderConfig {
  model: string;
  provider: string;
  timeout?: number;
  maxRetries?: number;
  useCircuitBreaker?: boolean;
}

@Injectable()
export class LLMProviderService {
  private readonly logger = new Logger(LLMProviderService.name);
  private openai?: OpenAI;
  private anthropic?: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    const openaiKey = this.configService.getString('OPENAI_API_KEY', {
      optional: true,
    });
    const anthropicKey = this.configService.getString('ANTHROPIC_API_KEY', {
      optional: true,
    });

    if (openaiKey) {
      this.openai = new OpenAI({
        apiKey: openaiKey,
      });

      this.circuitBreaker.registerCircuit('openai', {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
      });
    }

    if (anthropicKey) {
      this.anthropic = new Anthropic({
        apiKey: anthropicKey,
      });

      this.circuitBreaker.registerCircuit('anthropic', {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
      });
    }
  }

  async callLLM(
    prompt: string,
    config: LLMProviderConfig,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const useCircuitBreaker = config.useCircuitBreaker !== false;

    try {
      const executeCall = async () => {
        if (config.provider === 'openai') {
          return await this.callOpenAI(prompt, config, startTime);
        } else if (config.provider === 'anthropic') {
          return await this.callAnthropic(prompt, config, startTime);
        } else {
          throw new Error(`Unsupported provider: ${config.provider}`);
        }
      };

      if (useCircuitBreaker) {
        return await this.circuitBreaker.execute(config.provider, executeCall);
      } else {
        return await executeCall();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`LLM call failed: ${errorMessage}`, errorStack);
      throw new Error(`LLM call failed: ${errorMessage}`);
    }
  }

  private async callOpenAI(
    prompt: string,
    config: LLMProviderConfig,
    startTime: number,
  ): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.timeout || 30000);

    try {
      const completion = await this.openai.chat.completions.create(
        {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
        },
        {
          timeout: config.timeout || 30000,
          signal: controller.signal,
        },
      );

      const latencyMs = Date.now() - startTime;

      return {
        text: completion.choices[0]?.message?.content || '',
        latencyMs,
        tokenUsage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
        metadata: {
          model: completion.model,
          finishReason: completion.choices[0]?.finish_reason,
          id: completion.id,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callAnthropic(
    prompt: string,
    config: LLMProviderConfig,
    startTime: number,
  ): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.timeout || 30000);

    try {
      const message = await this.anthropic.messages.create(
        {
          model: config.model,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          timeout: config.timeout || 30000,
          signal: controller.signal,
        } as any,
      );

      const latencyMs = Date.now() - startTime;

      return {
        text:
          message.content[0]?.type === 'text' ? message.content[0].text : '',
        latencyMs,
        tokenUsage: {
          promptTokens: message.usage?.input_tokens,
          completionTokens: message.usage?.output_tokens,
          totalTokens:
            (message.usage?.input_tokens || 0) +
            (message.usage?.output_tokens || 0),
        },
        metadata: {
          model: message.model,
          stopReason: message.stop_reason,
          id: message.id,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getSupportedProviders(): string[] {
    const providers: string[] = [];
    if (this.openai) providers.push('openai');
    if (this.anthropic) providers.push('anthropic');
    return providers;
  }

  getDefaultModels(): Record<string, string[]> {
    return {
      openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
      anthropic: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
      ],
    };
  }
}
