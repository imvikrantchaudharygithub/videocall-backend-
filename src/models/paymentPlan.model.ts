import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentPlan extends Document {
  name: string;
  description: string;
  priceInr: number;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

const paymentPlanSchema = new Schema<IPaymentPlan>(
  {
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    priceInr:    { type: Number, required: true },
    baseCoins:   { type: Number, required: true },
    bonusCoins:  { type: Number, default: 0 },
    totalCoins:  { type: Number, required: true },
    isPopular:   { type: Boolean, default: false },
    isActive:    { type: Boolean, default: true },
    sortOrder:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const PaymentPlan = mongoose.model<IPaymentPlan>('PaymentPlan', paymentPlanSchema);
