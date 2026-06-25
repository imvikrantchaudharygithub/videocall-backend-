import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminUser extends Document {
  email: string;
  passwordHash: string;
  role: 'super_admin' | 'support';
  permissions: string[];
  createdAt: Date;
}

const adminUserSchema = new Schema<IAdminUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'support'], default: 'support' },
    permissions: [{ type: String }],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export const AdminUser = mongoose.model<IAdminUser>('AdminUser', adminUserSchema);
