import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSetting extends Document {
  key: string;
  value: unknown;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const platformSettingSchema = new Schema<IPlatformSetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

export const PlatformSetting = mongoose.model<IPlatformSetting>('PlatformSetting', platformSettingSchema);
