import mongoose, { Document, Schema } from 'mongoose';

export interface ITierRequirements {
  dailyMinHours: number;
  daysPerWeek: number;
  weeksRequired: number;
  minRating: number | null;
}

export interface IHostTier extends Document {
  tierLevel: number;
  name: string;
  color: string;
  videoRatePerMin: number;
  requirements: ITierRequirements;
}

const tierRequirementsSchema = new Schema<ITierRequirements>(
  {
    dailyMinHours: { type: Number, default: 0 },
    daysPerWeek: { type: Number, default: 0 },
    weeksRequired: { type: Number, default: 0 },
    minRating: { type: Number, default: null },
  },
  { _id: false }
);

const hostTierSchema = new Schema<IHostTier>(
  {
    tierLevel: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    color: { type: String, default: '#888888' },
    videoRatePerMin: { type: Number, required: true },
    requirements: { type: tierRequirementsSchema, default: {} },
  },
  { timestamps: true }
);

export const HostTier = mongoose.model<IHostTier>('HostTier', hostTierSchema);
