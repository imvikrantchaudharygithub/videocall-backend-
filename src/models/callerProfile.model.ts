import mongoose, { Document, Schema } from 'mongoose';

export interface ICallerProfile extends Document {
  userId: mongoose.Types.ObjectId;
  avatarUrl: string;
  totalCallsMade: number;
  totalCoinsSpent: number;
  favouriteHosts: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const callerProfileSchema = new Schema<ICallerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    avatarUrl: { type: String, default: '' },
    totalCallsMade: { type: Number, default: 0 },
    totalCoinsSpent: { type: Number, default: 0 },
    favouriteHosts: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

callerProfileSchema.index({ userId: 1 });

export const CallerProfile = mongoose.model<ICallerProfile>('CallerProfile', callerProfileSchema);
