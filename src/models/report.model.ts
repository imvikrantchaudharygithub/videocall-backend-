import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  reportedId: mongoose.Types.ObjectId;
  callId?: mongoose.Types.ObjectId;
  reason: string;
  details: string;
  status: 'open' | 'reviewed' | 'actioned';
  adminNote?: string;
  createdAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    callId: { type: Schema.Types.ObjectId, ref: 'Call' },
    reason: { type: String, required: true },
    details: { type: String, default: '' },
    status: { type: String, enum: ['open', 'reviewed', 'actioned'], default: 'open' },
    adminNote: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

reportSchema.index({ status: 1 });
reportSchema.index({ reporterId: 1 });

export const Report = mongoose.model<IReport>('Report', reportSchema);
