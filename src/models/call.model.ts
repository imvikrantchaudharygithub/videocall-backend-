import mongoose, { Document, Schema } from 'mongoose';

export interface IGiftSent {
  giftId: mongoose.Types.ObjectId;
  giftName: string;
  costCoins: number;
  hostEarnings: number;
  sentAt: Date;
}

export interface ICall extends Document {
  callerId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  callType: 'video' | 'voice';
  agoraChannel: string;
  status: 'initiated' | 'ringing' | 'queued' | 'active' | 'ended' | 'declined' | 'missed' | 'failed';
  ratePerSecond: number;
  ratePerMinute: number;
  initiatedAt: Date;
  answeredAt?: Date;
  lastBilledAt?: Date;
  endedAt?: Date;
  durationSeconds: number;
  totalCostCoins: number;
  hostEarningsCoins: number;
  platformEarningsCoins: number;
  endReason?: 'caller_ended' | 'host_ended' | 'insufficient_credits' | 'network_drop' | 'system_timeout' | 'admin_force';
  giftsSent: IGiftSent[];
  createdAt: Date;
}

const giftSentSchema = new Schema<IGiftSent>(
  {
    giftId: { type: Schema.Types.ObjectId, ref: 'Gift' },
    giftName: { type: String },
    costCoins: { type: Number, default: 0 },
    hostEarnings: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const callSchema = new Schema<ICall>(
  {
    callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    callType: { type: String, enum: ['video', 'voice'], required: true },
    agoraChannel: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'queued', 'active', 'ended', 'declined', 'missed', 'failed'],
      default: 'initiated',
    },
    ratePerSecond: { type: Number, required: true },
    ratePerMinute: { type: Number, required: true },
    initiatedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date },
    lastBilledAt: { type: Date },
    endedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    totalCostCoins: { type: Number, default: 0 },
    hostEarningsCoins: { type: Number, default: 0 },
    platformEarningsCoins: { type: Number, default: 0 },
    endReason: {
      type: String,
      enum: ['caller_ended', 'host_ended', 'insufficient_credits', 'network_drop', 'system_timeout', 'admin_force'],
    },
    giftsSent: [giftSentSchema],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

callSchema.index({ callerId: 1 });
callSchema.index({ hostId: 1 });
callSchema.index({ status: 1 });
callSchema.index({ createdAt: -1 });

export const Call = mongoose.model<ICall>('Call', callSchema);
