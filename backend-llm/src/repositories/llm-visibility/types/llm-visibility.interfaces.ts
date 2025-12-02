import { IRun } from '../schemas/run.schema';
import { IPrompt } from '../schemas/prompt.schema';
import { IBrand } from '../schemas/brand.schema';
import { IResponse } from '../schemas/response.schema';
import { IBrandMention } from '../schemas/brand-mention.schema';

interface RunSummary {
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

export type { IRun, IPrompt, IBrand, IResponse, IBrandMention, RunSummary };
