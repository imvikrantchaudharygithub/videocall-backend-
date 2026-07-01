import { Request, Response } from 'express';
import { LoginStreak } from '../models/loginStreak.model';
import { addCoins } from '../services/walletService';
import { DAILY_STREAK_COINS } from '../utils/constants';
import { istDayDiff } from '../utils/time';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

export const claimDailyBonus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    let streak = await LoginStreak.findOne({ userId });

    if (!streak) {
      streak = await LoginStreak.create({ userId, currentStreak: 0 });
    }

    const now = new Date();
    const lastClaimed = streak.lastClaimedAt;

    if (lastClaimed) {
      // Day boundary is IST midnight (India-first), not the server's UTC midnight.
      const diffDays = istDayDiff(now, new Date(lastClaimed));

      if (diffDays === 0) {
        res.status(400).json(errorResponse('ALREADY_CLAIMED', 'Daily bonus already claimed today'));
        return;
      }

      if (diffDays > 1) {
        // Streak broken — reset to day 1
        streak.currentStreak = 0;
      }
    }

    // Advance streak (0-indexed in array, so currentStreak 0 = Day 1)
    const streakDay = Math.min(streak.currentStreak, 6); // Cap at Day 7 (index 6)
    const coins = DAILY_STREAK_COINS[streakDay];

    const newBalance = await addCoins(userId, coins, 'daily_bonus', `Daily bonus — Day ${streakDay + 1} streak (${coins} coins)`);

    streak.currentStreak = streakDay + 1 >= 7 ? 0 : streakDay + 1; // Reset after Day 7
    streak.lastClaimedAt = now;
    streak.totalClaimed += coins;
    await streak.save();

    res.json(successResponse({
      coinsAwarded: coins,
      streakDay: streakDay + 1,
      nextStreakDay: streak.currentStreak + 1,
      nextReward: DAILY_STREAK_COINS[streak.currentStreak] ?? DAILY_STREAK_COINS[0],
      newBalance,
    }));
  } catch (error) {
    console.error('claimDailyBonus error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getDailyBonusStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const streak = await LoginStreak.findOne({ userId });

    if (!streak || !streak.lastClaimedAt) {
      res.json(successResponse({
        canClaim: true,
        currentStreak: 0,
        nextStreakDay: 1,
        nextReward: DAILY_STREAK_COINS[0],
        streakRewards: DAILY_STREAK_COINS,
      }));
      return;
    }

    const now = new Date();
    const diffDays = istDayDiff(now, new Date(streak.lastClaimedAt));

    const canClaim = diffDays >= 1;
    const activeStreak = diffDays > 1 ? 0 : streak.currentStreak;

    res.json(successResponse({
      canClaim,
      currentStreak: activeStreak,
      nextStreakDay: activeStreak + 1,
      nextReward: DAILY_STREAK_COINS[activeStreak] ?? DAILY_STREAK_COINS[0],
      lastClaimedAt: streak.lastClaimedAt,
      totalClaimed: streak.totalClaimed,
      streakRewards: DAILY_STREAK_COINS,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
