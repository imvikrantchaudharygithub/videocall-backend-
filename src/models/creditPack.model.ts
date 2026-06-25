import mongoose, { Document, Schema } from 'mongoose';

export interface ICreditPack extends Document {
  packId: string;
  name: string;
  amountInr: number;
  coins: number;
  bonusCoins: number;
  totalCoins: number;
  isActive: boolean;
  sortOrder: number;
}

const creditPackSchema = new Schema<ICreditPack>(
  {
    packId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    amountInr: { type: Number, required: true },
    coins: { type: Number, required: true },
    bonusCoins: { type: Number, default: 0 },
    totalCoins: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const CreditPack = mongoose.model<ICreditPack>('CreditPack', creditPackSchema);
