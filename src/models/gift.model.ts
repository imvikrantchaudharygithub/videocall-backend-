import mongoose, { Document, Schema } from 'mongoose';

export interface IGift extends Document {
  name: string;
  iconUrl: string;
  animationKey: string;
  costCoins: number;
  hostSharePercent: number;
  category: 'basic' | 'premium' | 'luxury';
  isVipExclusive: boolean;
  requiredVipTier: number;
  isActive: boolean;
  sortOrder: number;
}

const giftSchema = new Schema<IGift>(
  {
    name: { type: String, required: true },
    iconUrl: { type: String, default: '' },
    animationKey: { type: String, default: '' },
    costCoins: { type: Number, required: true },
    hostSharePercent: { type: Number, required: true },
    category: { type: String, enum: ['basic', 'premium', 'luxury'], default: 'basic' },
    isVipExclusive: { type: Boolean, default: false },
    requiredVipTier: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Gift = mongoose.model<IGift>('Gift', giftSchema);
