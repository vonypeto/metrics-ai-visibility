import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface IPrompt extends Document {
  _id: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  category?: string;
  tags?: string[];
}

export const PromptSchema = new Schema<IPrompt>(
  {
    text: { type: String, required: true, index: true },
    category: { type: String },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

PromptSchema.index({ text: 1 }, { unique: true });
