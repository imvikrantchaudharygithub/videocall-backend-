import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'credit_purchase' | 'call_deduction' | 'gift_sent' | 'refund' | 'referral_bonus' | 'welcome_bonus' | 'daily_bonus' | 'first_purchase_bonus' | 'vip_daily' | 'vip_bonus';
  amountCoins: number;
  balanceBefore: number;
  balanceAfter: number;
  callId?: mongoose.Types.ObjectId;
  paymentOrderId?: mongoose.Types.ObjectId;
  description: string;
  createdAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['credit_purchase', 'call_deduction', 'gift_sent', 'refund', 'referral_bonus', 'welcome_bonus', 'daily_bonus', 'first_purchase_bonus', 'vip_daily', 'vip_bonus', 'happy_hour_bonus'],
      required: true,
    },
    amountCoins: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    callId: { type: Schema.Types.ObjectId, ref: 'Call' },
    paymentOrderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder' },
    description: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
