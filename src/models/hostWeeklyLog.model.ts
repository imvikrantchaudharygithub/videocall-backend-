import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyMinutes {
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  sun: number;
}

export interface IHostWeeklyLog extends Document {
  hostId: mongoose.Types.ObjectId;
  weekStart: Date;
  dailyMinutes: IDailyMinutes;
  totalMinutes: number;
  metDailyTarget: number;
  qualified: boolean;
  createdAt: Date;
}

const dailyMinutesSchema = new Schema<IDailyMinutes>(
  {
    mon: { type: Number, default: 0 },
    tue: { type: Number, default: 0 },
    wed: { type: Number, default: 0 },
    thu: { type: Number, default: 0 },
    fri: { type: Number, default: 0 },
    sat: { type: Number, default: 0 },
    sun: { type: Number, default: 0 },
  },
  { _id: false }
);

const hostWeeklyLogSchema = new Schema<IHostWeeklyLog>(
  {
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    weekStart: { type: Date, required: true },
    dailyMinutes: { type: dailyMinutesSchema, default: {} },
    totalMinutes: { type: Number, default: 0 },
    metDailyTarget: { type: Number, default: 0 },
    qualified: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

hostWeeklyLogSchema.index({ hostId: 1, weekStart: -1 });

export const HostWeeklyLog = mongoose.model<IHostWeeklyLog>('HostWeeklyLog', hostWeeklyLogSchema);
