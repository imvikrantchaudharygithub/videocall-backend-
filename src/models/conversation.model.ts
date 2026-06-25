import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  callerId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  lastMessage: string;
  lastMessageAt: Date;
  lastMessageBy: 'caller' | 'host' | 'ai';
  callerUnread: number;
  hostUnread: number;
  isAIActive: boolean;
  callerDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageBy: { type: String, enum: ['caller', 'host', 'ai'], default: 'ai' },
    callerUnread: { type: Number, default: 0 },
    hostUnread: { type: Number, default: 0 },
    isAIActive: { type: Boolean, default: true },
    callerDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationSchema.index({ callerId: 1, hostId: 1 }, { unique: true });
conversationSchema.index({ callerId: 1, lastMessageAt: -1 });
conversationSchema.index({ hostId: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
