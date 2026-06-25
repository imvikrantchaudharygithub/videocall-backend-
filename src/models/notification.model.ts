import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: 'call' | 'system' | 'tier' | 'gift' | 'favourite_online' | 'withdrawal';
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ['call', 'system', 'tier', 'gift', 'favourite_online', 'withdrawal'],
      default: 'system',
    },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
