import { IRun } from './llm-visibility.interfaces';

export interface CreateRunRequest {
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

export interface RunChatResponse {
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
}
