import mongoose, { Document, Schema } from 'mongoose';

export interface ICallQueue extends Document {
  hostId: mongoose.Types.ObjectId;
  callerId: mongoose.Types.ObjectId;
  callType: 'video' | 'voice';
  position: number;
  status: 'waiting' | 'notified' | 'expired' | 'connected';
  createdAt: Date;
  expiresAt: Date;
}

const callQueueSchema = new Schema<ICallQueue>(
  {
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    callType: { type: String, enum: ['video', 'voice'], default: 'video' },
    position: { type: Number, required: true },
    status: { type: String, enum: ['waiting', 'notified', 'expired', 'connected'], default: 'waiting' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

callQueueSchema.index({ hostId: 1, status: 1 });
callQueueSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CallQueue = mongoose.model<ICallQueue>('CallQueue', callQueueSchema);
