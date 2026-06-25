import { HostProfile } from '../models/hostProfile.model';
import { HostTier } from '../models/hostTier.model';
import { HostWeeklyLog } from '../models/hostWeeklyLog.model';
import { createNotification } from './notificationService';
import mongoose from 'mongoose';
import { VOICE_DISCOUNT_PERCENT } from '../utils/constants';

export const updateHostTier = async (hostId: mongoose.Types.ObjectId): Promise<void> => {
  const hostProfile = await HostProfile.findOne({ userId: hostId });
  if (!hostProfile) return;

  const tiers = await HostTier.find().sort({ tierLevel: -1 });
  const recentWeeks = await HostWeeklyLog.find({ hostId })
    .sort({ weekStart: -1 })
    .limit(4);

  for (const tier of tiers) {
    if (tier.tierLevel <= hostProfile.currentTier) continue;

    const { weeksRequired, dailyMinHours, daysPerWeek, minRating } = tier.requirements;

    if (recentWeeks.length < weeksRequired) continue;

    const qualifiedWeeks = recentWeeks.slice(0, weeksRequired).filter((week) => {
      const qualifiedDays = Object.values(week.dailyMinutes).filter(
        (mins) => mins >= dailyMinHours * 60
      ).length;
      return qualifiedDays >= daysPerWeek;
    });

    const ratingOk = !minRating || hostProfile.ratingAvg >= minRating;

    if (qualifiedWeeks.length >= weeksRequired && ratingOk) {
      const oldTier = hostProfile.currentTier;
      hostProfile.currentTier = tier.tierLevel;
      hostProfile.videoRatePerMin = tier.videoRatePerMin;
      hostProfile.voiceRatePerMin = Math.floor(tier.videoRatePerMin * (1 - VOICE_DISCOUNT_PERCENT / 100));
      await hostProfile.save();

      await createNotification(
        hostId,
        '🎉 Tier Promoted!',
        `Congratulations! You've been promoted to ${tier.name} tier.`,
        'tier',
        { oldTier, newTier: tier.tierLevel, tierName: tier.name }
      );
      break;
    }
  }
};

export const updateHostRatingAvg = async (
  hostId: mongoose.Types.ObjectId,
  newScore: number
): Promise<void> => {
  const profile = await HostProfile.findOne({ userId: hostId });
  if (!profile) return;

  const totalScore = profile.ratingAvg * profile.ratingCount + newScore;
  profile.ratingCount += 1;
  profile.ratingAvg = parseFloat((totalScore / profile.ratingCount).toFixed(2));
  await profile.save();
};

export const updateWeeklyMinutes = async (
  hostId: mongoose.Types.ObjectId,
  callDurationMinutes: number
): Promise<void> => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayNames: (keyof typeof weekDayMap)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayKey = dayNames[dayOfWeek];

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekDayMap = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 };

  const incKey = `dailyMinutes.${todayKey}`;
  await HostWeeklyLog.findOneAndUpdate(
    { hostId, weekStart },
    {
      $inc: { [incKey]: callDurationMinutes, totalMinutes: callDurationMinutes },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  void weekDayMap;
};
