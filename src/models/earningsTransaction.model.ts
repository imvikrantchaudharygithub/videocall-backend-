import mongoose, { Document, Schema } from 'mongoose';

export interface IEarningsTransaction extends Document {
  hostId: mongoose.Types.ObjectId;
  type: 'call_earning' | 'gift_earning' | 'withdrawal' | 'bonus';
  amountCoins: number;
  callId?: mongoose.Types.ObjectId;
  description: string;
  createdAt: Date;
}

const earningsTransactionSchema = new Schema<IEarningsTransaction>(
  {
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['call_earning', 'gift_earning', 'withdrawal', 'bonus'],
      required: true,
    },
    amountCoins: { type: Number, required: true },
    callId: { type: Schema.Types.ObjectId, ref: 'Call' },
    description: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

earningsTransactionSchema.index({ hostId: 1, createdAt: -1 });

export const EarningsTransaction = mongoose.model<IEarningsTransaction>('EarningsTransaction', earningsTransactionSchema);
