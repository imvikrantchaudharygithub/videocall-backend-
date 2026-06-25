import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentOrder extends Document {
  userId: mongoose.Types.ObjectId;
  packId: string;
  amountInr: number;
  coinsToAdd: number;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: 'created' | 'paid' | 'failed';
  createdAt: Date;
}

const paymentOrderSchema = new Schema<IPaymentOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    packId: { type: String, required: true },
    amountInr: { type: Number, required: true },
    coinsToAdd: { type: Number, required: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

paymentOrderSchema.index({ userId: 1 });
paymentOrderSchema.index({ razorpayOrderId: 1 });

export const PaymentOrder = mongoose.model<IPaymentOrder>('PaymentOrder', paymentOrderSchema);
