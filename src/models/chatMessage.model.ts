import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage extends Document {
  callId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  message: string;
  isFiltered: boolean;
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    callId: { type: Schema.Types.ObjectId, ref: 'Call', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    isFiltered: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

chatMessageSchema.index({ callId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
