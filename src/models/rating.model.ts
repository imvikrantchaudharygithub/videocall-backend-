import mongoose, { Document, Schema } from 'mongoose';

export interface IRating extends Document {
  callId: mongoose.Types.ObjectId;
  callerId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  score: number;
  review?: string;
  createdAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    callId: { type: Schema.Types.ObjectId, ref: 'Call', required: true, unique: true },
    callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

ratingSchema.index({ hostId: 1 });
ratingSchema.index({ callId: 1 });

export const Rating = mongoose.model<IRating>('Rating', ratingSchema);
