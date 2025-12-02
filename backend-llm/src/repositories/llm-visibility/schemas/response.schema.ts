import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface IResponse extends Document {
  _id: mongoose.Types.ObjectId;
  runId: mongoose.Types.ObjectId;
  promptId: mongoose.Types.ObjectId;
  modelName: string;
  provider: string;
  latencyMs: number;
  rawText: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
  status: 'success' | 'failed' | 'timeout' | 'rate_limited';
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  timestamp: Date;
}

export const ResponseSchema = new Schema<IResponse>(
  {
    runId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Run',
      index: true,
    },
    promptId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Prompt',
      index: true,
    },
    modelName: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    latencyMs: { type: Number, required: true },
    rawText: { type: String },
    tokenUsage: {
      promptTokens: { type: Number },
      completionTokens: { type: Number },
      totalTokens: { type: Number },
    },
    metadata: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['success', 'failed', 'timeout', 'rate_limited'],
      required: true,
    },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ResponseSchema.index({ runId: 1, status: 1 });
ResponseSchema.index({ runId: 1, promptId: 1, modelName: 1 });
