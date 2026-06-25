import mongoose, { Document, Schema } from 'mongoose';

export interface ILoginStreak extends Document {
  userId: mongoose.Types.ObjectId;
  currentStreak: number;
  lastClaimedAt: Date;
  totalClaimed: number;
  createdAt: Date;
  updatedAt: Date;
}

const loginStreakSchema = new Schema<ILoginStreak>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    currentStreak: { type: Number, default: 0, min: 0, max: 7 },
    lastClaimedAt: { type: Date },
    totalClaimed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

loginStreakSchema.index({ userId: 1 });

export const LoginStreak = mongoose.model<ILoginStreak>('LoginStreak', loginStreakSchema);
