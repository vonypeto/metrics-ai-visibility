import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface IBrand extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  aliases?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const BrandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true, unique: true, index: true },
    aliases: [{ type: String }],
  },
  { timestamps: true },
);
