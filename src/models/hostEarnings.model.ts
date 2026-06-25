import mongoose, { Document, Schema } from 'mongoose';

export interface IHostEarnings extends Document {
  userId: mongoose.Types.ObjectId;
  balanceCoins: number;
  totalEarnedCoins: number;
  totalWithdrawnCoins: number;
  updatedAt: Date;
}

const hostEarningsSchema = new Schema<IHostEarnings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balanceCoins: { type: Number, default: 0, min: 0 },
    totalEarnedCoins: { type: Number, default: 0 },
    totalWithdrawnCoins: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

hostEarningsSchema.index({ userId: 1 });

export const HostEarnings = mongoose.model<IHostEarnings>('HostEarnings', hostEarningsSchema);
