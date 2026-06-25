import mongoose, { Document, Schema } from 'mongoose';

export interface ICallerWallet extends Document {
  userId: mongoose.Types.ObjectId;
  balanceCoins: number;
  totalPurchasedCoins: number;
  totalSpentCoins: number;
  hasUsedFirstPurchaseBonus: boolean;
  updatedAt: Date;
}

const callerWalletSchema = new Schema<ICallerWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balanceCoins: { type: Number, default: 0, min: 0 },
    totalPurchasedCoins: { type: Number, default: 0 },
    totalSpentCoins: { type: Number, default: 0 },
    hasUsedFirstPurchaseBonus: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

callerWalletSchema.index({ userId: 1 });

export const CallerWallet = mongoose.model<ICallerWallet>('CallerWallet', callerWalletSchema);
