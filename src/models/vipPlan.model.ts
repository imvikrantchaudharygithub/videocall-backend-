import mongoose, { Document, Schema } from 'mongoose';

export interface IVipPlan extends Document {
  name: string;
  tier: number;
  slug: string;
  description: string;
  priceInr: number;
  weeklyPriceInr: number;
  durationDays: number;
  bonusCoinPercent: number;
  dailyFreeCoins: number;
  queueSkipPositions: number;
  visibilityMultiplier: number;
  callRateDiscountPercent: number;
  exclusiveGiftCount: number;
  adFree: boolean;
  badgeType: string;
  colorHex: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const vipPlanSchema = new Schema<IVipPlan>(
  {
    name: { type: String, required: true },
    tier: { type: Number, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    priceInr: { type: Number, required: true },
    weeklyPriceInr: { type: Number, required: true },
    durationDays: { type: Number, default: 30 },
    bonusCoinPercent: { type: Number, default: 0 },
    dailyFreeCoins: { type: Number, default: 0 },
    queueSkipPositions: { type: Number, default: 0 },
    visibilityMultiplier: { type: Number, default: 1 },
    callRateDiscountPercent: { type: Number, default: 0 },
    exclusiveGiftCount: { type: Number, default: 0 },
    adFree: { type: Boolean, default: true },
    badgeType: { type: String, default: '' },
    colorHex: { type: String, default: '#C0C0C0' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const VipPlan = mongoose.model<IVipPlan>('VipPlan', vipPlanSchema);
