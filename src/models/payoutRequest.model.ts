import mongoose, { Document, Schema } from 'mongoose';

export interface IPayoutRequest extends Document {
  hostId: mongoose.Types.ObjectId;
  amountCoins: number;
  amountInr: number;
  method: 'bank_transfer' | 'upi';
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  razorpayPayoutId?: string;
  adminNote?: string;
  requestedAt: Date;
  processedAt?: Date;
}

const payoutRequestSchema = new Schema<IPayoutRequest>(
  {
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountCoins: { type: Number, required: true },
    amountInr: { type: Number, required: true },
    method: { type: String, enum: ['bank_transfer', 'upi'], default: 'bank_transfer' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'completed', 'rejected'],
      default: 'pending',
    },
    razorpayPayoutId: { type: String },
    adminNote: { type: String },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: false }
);

payoutRequestSchema.index({ hostId: 1 });
payoutRequestSchema.index({ status: 1 });

export const PayoutRequest = mongoose.model<IPayoutRequest>('PayoutRequest', payoutRequestSchema);
