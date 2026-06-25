import mongoose, { Document, Schema } from 'mongoose';

export interface IBankDetails {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  upiId: string;
}

export interface IHostProfile extends Document {
  userId: mongoose.Types.ObjectId;
  bio: string;
  avatarUrl: string;
  photoUrls: string[];
  languages: string[];
  tags: string[];
  isApproved: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  isOnline: boolean;
  isBusy: boolean;
  currentTier: number;
  videoRatePerMin: number;
  voiceRatePerMin: number;
  rateOverride?: number;
  weeklyCallMinutes: number;
  totalCallMinutes: number;
  totalCallsReceived: number;
  ratingAvg: number;
  ratingCount: number;
  bankDetails: IBankDetails;
  agencyId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bankDetailsSchema = new Schema<IBankDetails>(
  {
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
    upiId: { type: String, default: '' },
  },
  { _id: false }
);

const hostProfileSchema = new Schema<IHostProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bio: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    photoUrls: [{ type: String }],
    languages: [{ type: String }],
    tags: [{ type: String }],
    isApproved: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String },
    isOnline: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },
    currentTier: { type: Number, default: 1 },
    videoRatePerMin: { type: Number, default: 10 },
    voiceRatePerMin: { type: Number, default: 9 },
    rateOverride: { type: Number },
    weeklyCallMinutes: { type: Number, default: 0 },
    totalCallMinutes: { type: Number, default: 0 },
    totalCallsReceived: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    bankDetails: { type: bankDetailsSchema, default: {} },
    agencyId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

hostProfileSchema.index({ userId: 1 });
hostProfileSchema.index({ isApproved: 1, isOnline: 1 });
hostProfileSchema.index({ ratingAvg: -1 });

export const HostProfile = mongoose.model<IHostProfile>('HostProfile', hostProfileSchema);
