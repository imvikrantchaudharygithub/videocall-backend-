import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  phone: string;
  email: string;
  displayName: string;
  userType: 'caller' | 'host';
  isGuest: boolean;
  isBanned: boolean;
  banReason?: string;
  fcmToken?: string;
  sessionId?: string;
  sessionExpiry?: Date;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  dateOfBirth?: Date;
  isAgeVerified: boolean;
  vipTier: number;
  vipExpiresAt?: Date;
  vipBadge: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    phone: { type: String, sparse: true, unique: true, trim: true },
    email: { type: String, default: '', trim: true },
    displayName: { type: String, required: true, trim: true },
    userType: { type: String, enum: ['caller', 'host'], required: true },
    isGuest: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String },
    fcmToken: { type: String },
    sessionId: { type: String, index: true },
    sessionExpiry: { type: Date },
    referralCode: { type: String, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dateOfBirth: { type: Date },
    isAgeVerified: { type: Boolean, default: false },
    vipTier: { type: Number, default: 0 },
    vipExpiresAt: { type: Date },
    vipBadge: { type: String, default: '' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ phone: 1 });
userSchema.index({ sessionId: 1 });
userSchema.index({ referralCode: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
