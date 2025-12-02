import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface IRun extends Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'partial'
    | 'cancelled';
  totalPrompts: number;
  completedPrompts: number;
  failedPrompts: number;
  startedAt?: Date;
  completedAt?: Date;
  idempotencyKey?: string;
  contentHash?: string;
  config: {
    brands: string[];
    models: string[];
    concurrencyLimit: number;
    retryAttempts: number;
    timeout: number;
    rateLimitPerSecond?: number;
    enableCircuitBreaker?: boolean;
  };
  metrics?: {
    totalDurationMs?: number;
    avgLatencyMs?: number;
    totalTokensUsed?: number;
    estimatedCost?: number;
  };
}

export const RunSchema = new Schema<IRun>(
  {
    notes: { type: String },
    status: {
      type: String,
      enum: [
        'pending',
        'running',
        'completed',
        'failed',
        'partial',
        'cancelled',
      ],
      default: 'pending',
    },
    totalPrompts: { type: Number, default: 0 },
    completedPrompts: { type: Number, default: 0 },
    failedPrompts: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    idempotencyKey: { type: String, index: true, sparse: true },
    contentHash: { type: String, index: true },
    config: {
      brands: [{ type: String }],
      models: [{ type: String }],
      concurrencyLimit: { type: Number, default: 5 },
      retryAttempts: { type: Number, default: 3 },
      timeout: { type: Number, default: 30000 },
      rateLimitPerSecond: { type: Number },
      enableCircuitBreaker: { type: Boolean, default: true },
    },
    metrics: {
      totalDurationMs: { type: Number },
      avgLatencyMs: { type: Number },
      totalTokensUsed: { type: Number },
      estimatedCost: { type: Number },
    },
  },
  { timestamps: true },
);
