import { Request, Response } from 'express';
import { EarningsTransaction } from '../models/earningsTransaction.model';
import { HostProfile } from '../models/hostProfile.model';
import { User } from '../models/user.model';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

/**
 * Get weekly leaderboard — top earning hosts for the current week.
 * Public for callers (featured placement) and hosts (see their rank).
 * GET /api/leaderboard/weekly?limit=10
 */
export const getWeeklyLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query as Record<string, string>;
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    // Calculate start of current week (Monday 00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    // Aggregate earnings this week (only positive earnings: call + gift + bonus)
    const leaderboard = await EarningsTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart },
          type: { $in: ['call_earning', 'gift_earning', 'bonus'] },
          amountCoins: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$hostId',
          weeklyCoins: { $sum: '$amountCoins' },
          callEarnings: {
            $sum: { $cond: [{ $eq: ['$type', 'call_earning'] }, '$amountCoins', 0] },
          },
          giftEarnings: {
            $sum: { $cond: [{ $eq: ['$type', 'gift_earning'] }, '$amountCoins', 0] },
          },
          totalTransactions: { $sum: 1 },
        },
      },
      { $sort: { weeklyCoins: -1 } },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'hostprofiles',
          localField: '_id',
          foreignField: 'userId',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      {
        $project: {
          _id: 0,
          hostId: '$_id',
          displayName: '$user.displayName',
          avatarUrl: '$profile.avatarUrl',
          isOnline: '$profile.isOnline',
          ratingAvg: '$profile.ratingAvg',
          currentTier: '$profile.currentTier',
          weeklyCoins: 1,
          callEarnings: 1,
          giftEarnings: 1,
          totalTransactions: 1,
        },
      },
    ]);

    // Add rank
    const ranked = leaderboard.map((entry, i) => ({ rank: i + 1, ...entry }));

    res.json(successResponse({
      weekStart: weekStart.toISOString(),
      weekEnd: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      leaderboard: ranked,
    }));
  } catch (error) {
    console.error('getWeeklyLeaderboard error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/**
 * Get the current user's rank in the weekly leaderboard.
 * GET /api/leaderboard/my-rank
 */
export const getMyRank = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    // Get all hosts' weekly earnings sorted
    const allEarnings = await EarningsTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart },
          type: { $in: ['call_earning', 'gift_earning', 'bonus'] },
          amountCoins: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$hostId',
          weeklyCoins: { $sum: '$amountCoins' },
        },
      },
      { $sort: { weeklyCoins: -1 } },
    ]);

    const userId = new mongoose.Types.ObjectId(req.userId);
    const myIndex = allEarnings.findIndex((e) => e._id.equals(userId));

    if (myIndex === -1) {
      res.json(successResponse({ rank: null, weeklyCoins: 0, totalParticipants: allEarnings.length }));
      return;
    }

    res.json(successResponse({
      rank: myIndex + 1,
      weeklyCoins: allEarnings[myIndex].weeklyCoins,
      totalParticipants: allEarnings.length,
    }));
  } catch (error) {
    console.error('getMyRank error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/**
 * Admin: Get leaderboard with more detail + historical weeks.
 * GET /api/admin/leaderboard?week=current&limit=20
 */
export const getAdminLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { week = 'current', limit = '20' } = req.query as Record<string, string>;
    const limitNum = Math.min(parseInt(limit) || 20, 100);

    let weekStart: Date;
    if (week === 'current') {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - mondayOffset);
      weekStart.setUTCHours(0, 0, 0, 0);
    } else if (week === 'previous') {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - mondayOffset - 7);
      weekStart.setUTCHours(0, 0, 0, 0);
    } else {
      // Expect ISO date string for a specific week start
      weekStart = new Date(week);
      if (isNaN(weekStart.getTime())) {
        res.status(400).json(errorResponse('INVALID_WEEK', 'Invalid week parameter'));
        return;
      }
    }

    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const leaderboard = await EarningsTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart, $lt: weekEnd },
          type: { $in: ['call_earning', 'gift_earning', 'bonus'] },
          amountCoins: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$hostId',
          weeklyCoins: { $sum: '$amountCoins' },
          callEarnings: {
            $sum: { $cond: [{ $eq: ['$type', 'call_earning'] }, '$amountCoins', 0] },
          },
          giftEarnings: {
            $sum: { $cond: [{ $eq: ['$type', 'gift_earning'] }, '$amountCoins', 0] },
          },
          bonusEarnings: {
            $sum: { $cond: [{ $eq: ['$type', 'bonus'] }, '$amountCoins', 0] },
          },
          totalTransactions: { $sum: 1 },
        },
      },
      { $sort: { weeklyCoins: -1 } },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'hostprofiles',
          localField: '_id',
          foreignField: 'userId',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      {
        $project: {
          _id: 0,
          hostId: '$_id',
          displayName: '$user.displayName',
          phone: '$user.phone',
          avatarUrl: '$profile.avatarUrl',
          isOnline: '$profile.isOnline',
          ratingAvg: '$profile.ratingAvg',
          currentTier: '$profile.currentTier',
          totalCallMinutes: '$profile.totalCallMinutes',
          weeklyCoins: 1,
          callEarnings: 1,
          giftEarnings: 1,
          bonusEarnings: 1,
          totalTransactions: 1,
        },
      },
    ]);

    const ranked = leaderboard.map((entry, i) => ({ rank: i + 1, ...entry }));

    // Get total participating hosts count
    const totalParticipants = await EarningsTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart, $lt: weekEnd },
          type: { $in: ['call_earning', 'gift_earning', 'bonus'] },
          amountCoins: { $gt: 0 },
        },
      },
      { $group: { _id: '$hostId' } },
      { $count: 'total' },
    ]);

    res.json(successResponse({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalParticipants: totalParticipants[0]?.total ?? 0,
      leaderboard: ranked,
    }));
  } catch (error) {
    console.error('getAdminLeaderboard error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
