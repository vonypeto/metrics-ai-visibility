import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface IBrandMention extends Document {
  _id: mongoose.Types.ObjectId;
  responseId: mongoose.Types.ObjectId;
  brandId: mongoose.Types.ObjectId;
  mentioned: boolean;
  positionIndex?: number;
  mentionCount: number;
  context?: string;
  createdAt: Date;
}

export const BrandMentionSchema = new Schema<IBrandMention>(
  {
    responseId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Response',
      index: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Brand',
      index: true,
    },
    mentioned: { type: Boolean, required: true },
    positionIndex: { type: Number },
    mentionCount: { type: Number, default: 0 },
    context: { type: String },
  },
  { timestamps: true },
);

// Composite indexes
BrandMentionSchema.index({ responseId: 1, brandId: 1 }, { unique: true });
BrandMentionSchema.index({ brandId: 1, mentioned: 1 });
