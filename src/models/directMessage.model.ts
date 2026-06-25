import mongoose, { Document, Schema } from 'mongoose';

export interface IDirectMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderType: 'caller' | 'host' | 'ai';
  message: string;
  isAI: boolean;
  isFiltered: boolean;
  isRead: boolean;
  createdAt: Date;
}

const directMessageSchema = new Schema<IDirectMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderType: { type: String, enum: ['caller', 'host', 'ai'], required: true },
    message: { type: String, required: true },
    isAI: { type: Boolean, default: false },
    isFiltered: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

directMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const DirectMessage = mongoose.model<IDirectMessage>('DirectMessage', directMessageSchema);
