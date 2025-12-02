import mongoose, { Document, Model } from 'mongoose';

export class BaseRepository<T extends Document> {
  constructor(private readonly model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    const createdDocument = new this.model(data);
    return createdDocument.save();
  }

  async findAll(page: number = 1, limit: number = 10): Promise<T[]> {
    const skip = (page - 1) * limit;
    return this.model
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async countAll(): Promise<number> {
    return this.model.countDocuments().exec();
  }

  async findById(_id: mongoose.Types.ObjectId): Promise<T | null> {
    return this.model.findById(_id).exec() as Promise<T | null>;
  }

  async update(
    _id: mongoose.Types.ObjectId,
    data: Partial<T>,
  ): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(_id, data, { new: true })
      .exec() as Promise<T | null>;
  }

  async delete(_id: mongoose.Types.ObjectId): Promise<T | null> {
    return this.model.findByIdAndDelete(_id).exec() as Promise<T | null>;
  }
}
