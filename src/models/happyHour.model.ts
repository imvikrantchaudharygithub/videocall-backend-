import mongoose, { Document, Schema } from 'mongoose';

export interface IHappyHour extends Document {
  name: string;
  description: string;
  bonusPercent: number;
  startTime: Date;
  endTime: Date;
  isRecurring: boolean;
  recurringDays: number[];       // 0=Sun, 1=Mon ... 6=Sat (for recurring daily events)
  recurringStartHour: number;    // e.g. 19 for 7 PM
  recurringStartMinute: number;  // e.g. 0
  recurringEndHour: number;      // e.g. 21 for 9 PM
  recurringEndMinute: number;    // e.g. 0
  isActive: boolean;
  bannerColor: string;
  bannerIcon: string;
  createdAt: Date;
  updatedAt: Date;
}

const happyHourSchema = new Schema<IHappyHour>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    bonusPercent: { type: Number, required: true, min: 1, max: 500 },
    startTime: { type: Date },
    endTime: { type: Date },
    isRecurring: { type: Boolean, default: false },
    recurringDays: [{ type: Number, min: 0, max: 6 }],
    recurringStartHour: { type: Number, default: 0 },
    recurringStartMinute: { type: Number, default: 0 },
    recurringEndHour: { type: Number, default: 0 },
    recurringEndMinute: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    bannerColor: { type: String, default: '#FF6B35' },
    bannerIcon: { type: String, default: 'flash' },
  },
  { timestamps: true }
);

happyHourSchema.index({ isActive: 1, startTime: 1, endTime: 1 });

export const HappyHour = mongoose.model<IHappyHour>('HappyHour', happyHourSchema);
