import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { BaseRepository } from '../base.repository';
import {
  IRun,
  IPrompt,
  IBrand,
  IResponse,
  IBrandMention,
} from './types/llm-visibility.interfaces';
import { tokens } from './types/tokens';

@Injectable()
export class RunRepository extends BaseRepository<IRun> {
  constructor(
    @InjectModel(tokens.Run)
    private readonly runModel: Model<IRun>,
  ) {
    super(runModel);
  }

  async findByStatus(status: string): Promise<IRun[]> {
    return this.runModel.find({ status }).exec();
  }

  async findByIdempotencyKey(key: string): Promise<IRun | null> {
    return this.runModel.findOne({ idempotencyKey: key }).exec();
  }

  async findByContentHash(hash: string): Promise<IRun | null> {
    return this.runModel
      .findOne({
        contentHash: hash,
        status: { $in: ['pending', 'running', 'completed', 'partial'] },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateProgress(
    runId: string,
    updates: {
      completedPrompts?: number;
      failedPrompts?: number;
      status?: string;
    },
  ): Promise<IRun | null> {
    return this.runModel
      .findByIdAndUpdate(runId, updates, { new: true })
      .exec();
  }

  async updateMetrics(
    runId: string,
    metrics: {
      totalDurationMs?: number;
      avgLatencyMs?: number;
      totalTokensUsed?: number;
      estimatedCost?: number;
    },
  ): Promise<IRun | null> {
    return this.runModel
      .findByIdAndUpdate(runId, { metrics }, { new: true })
      .exec();
  }
}

@Injectable()
export class PromptRepository extends BaseRepository<IPrompt> {
  constructor(
    @InjectModel(tokens.Prompt)
    private readonly promptModel: Model<IPrompt>,
  ) {
    super(promptModel);
  }

  async findOrCreate(text: string): Promise<IPrompt> {
    let prompt = await this.promptModel.findOne({ text }).exec();
    if (!prompt) {
      prompt = await this.promptModel.create({ text });
    }
    return prompt;
  }

  async findByTexts(texts: string[]): Promise<IPrompt[]> {
    return this.promptModel.find({ text: { $in: texts } }).exec();
  }
}

@Injectable()
export class BrandRepository extends BaseRepository<IBrand> {
  constructor(
    @InjectModel(tokens.Brand)
    private readonly brandModel: Model<IBrand>,
  ) {
    super(brandModel);
  }

  async findOrCreate(name: string): Promise<IBrand> {
    let brand = await this.brandModel.findOne({ name }).exec();
    if (!brand) {
      brand = await this.brandModel.create({ name });
    }
    return brand;
  }

  async findByNames(names: string[]): Promise<IBrand[]> {
    return this.brandModel.find({ name: { $in: names } }).exec();
  }
}

@Injectable()
export class ResponseRepository extends BaseRepository<IResponse> {
  constructor(
    @InjectModel(tokens.Response)
    private readonly responseModel: Model<IResponse>,
  ) {
    super(responseModel);
  }

  async findByRun(runId: string): Promise<IResponse[]> {
    return this.responseModel.find({ runId }).exec();
  }

  async findByRunAndStatus(
    runId: string,
    status: string,
  ): Promise<IResponse[]> {
    return this.responseModel.find({ runId, status }).exec();
  }

  async countByRun(runId: string): Promise<number> {
    return this.responseModel.countDocuments({ runId }).exec();
  }
}

@Injectable()
export class BrandMentionRepository extends BaseRepository<IBrandMention> {
  constructor(
    @InjectModel(tokens.BrandMention)
    private readonly brandMentionModel: Model<IBrandMention>,
  ) {
    super(brandMentionModel);
  }

  async findByResponse(responseId: string): Promise<IBrandMention[]> {
    return this.brandMentionModel
      .find({ responseId })
      .populate('brandId')
      .exec();
  }

  async findByBrand(brandId: string): Promise<IBrandMention[]> {
    return this.brandMentionModel.find({ brandId }).exec();
  }

  async getAggregatedMetrics(runId: string): Promise<any[]> {
    const objectId = new mongoose.Types.ObjectId(runId);

    const result = await this.brandMentionModel.aggregate([
      {
        $lookup: {
          from: 'responses',
          localField: 'responseId',
          foreignField: '_id',
          as: 'response',
        },
      },
      {
        $unwind: '$response',
      },
      {
        $match: {
          'response.runId': objectId,
        },
      },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand',
        },
      },
      {
        $unwind: '$brand',
      },
      {
        $lookup: {
          from: 'prompts',
          localField: 'response.promptId',
          foreignField: '_id',
          as: 'prompt',
        },
      },
      {
        $unwind: '$prompt',
      },
      {
        $group: {
          _id: {
            brandId: '$brandId',
            brandName: '$brand.name',
            promptId: '$response.promptId',
            promptText: '$prompt.text',
            model: '$response.modelName',
          },
          mentioned: { $max: '$mentioned' },
          totalMentions: { $sum: '$mentionCount' },
          avgPosition: { $avg: '$positionIndex' },
        },
      },
      {
        $sort: { '_id.brandName': 1, '_id.promptText': 1 },
      },
    ]);

    return result;
  }
}
