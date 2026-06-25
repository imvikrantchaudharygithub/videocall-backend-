import mongoose, { Document, Schema } from 'mongoose';

export interface IVipPaymentRecord {
  orderId: string;
  paymentId: string;
  amount: number;
  paidAt: Date;
  status: string;
}

export interface IVipSubscription extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  tier: number;
  planName: string;
  billingCycle: 'weekly' | 'monthly';
  status: 'active' | 'expired' | 'cancelled' | 'payment_pending';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  amountPaid: number;
  paymentHistory: IVipPaymentRecord[];
  dailyCoinsClaimed: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vipPaymentRecordSchema = new Schema<IVipPaymentRecord>(
  {
    orderId: { type: String, required: true },
    paymentId: { type: String, required: true },
    amount: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
    status: { type: String, default: 'paid' },
  },
  { _id: false }
);

const vipSubscriptionSchema = new Schema<IVipSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'VipPlan', required: true },
    tier: { type: Number, required: true },
    planName: { type: String, required: true },
    billingCycle: { type: String, enum: ['weekly', 'monthly'], default: 'monthly' },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'payment_pending'],
      default: 'payment_pending',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },
    razorpaySubscriptionId: { type: String, default: '' },
    razorpayPlanId: { type: String, default: '' },
    amountPaid: { type: Number, default: 0 },
    paymentHistory: [vipPaymentRecordSchema],
    dailyCoinsClaimed: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

vipSubscriptionSchema.index({ userId: 1, status: 1 });
vipSubscriptionSchema.index({ endDate: 1, status: 1 });

export const VipSubscription = mongoose.model<IVipSubscription>('VipSubscription', vipSubscriptionSchema);
