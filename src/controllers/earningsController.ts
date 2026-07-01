import { Request, Response } from 'express';
import { HostEarnings } from '../models/hostEarnings.model';
import { EarningsTransaction } from '../models/earningsTransaction.model';
import { PayoutRequest } from '../models/payoutRequest.model';
import { errorResponse, successResponse } from '../types';
import { MIN_WITHDRAWAL_COINS, COINS_PER_INR } from '../utils/constants';
import { istDateKey } from '../utils/time';
import mongoose from 'mongoose';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getEarningsSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const earnings = await HostEarnings.findOne({ userId: req.userId });

    // Period aggregates (today / this week / this month) from earning credits
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [agg] = await EarningsTransaction.aggregate([
      {
        $match: {
          hostId: new mongoose.Types.ObjectId(req.userId),
          type: { $in: ['call_earning', 'gift_earning', 'bonus'] },
        },
      },
      {
        $group: {
          _id: null,
          today: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, '$amountCoins', 0] } },
          week: { $sum: { $cond: [{ $gte: ['$createdAt', startOfWeek] }, '$amountCoins', 0] } },
          month: { $sum: { $cond: [{ $gte: ['$createdAt', startOfMonth] }, '$amountCoins', 0] } },
        },
      },
    ]);

    const balanceCoins = earnings?.balanceCoins ?? 0;
    const totalEarnedCoins = earnings?.totalEarnedCoins ?? 0;
    const totalWithdrawnCoins = earnings?.totalWithdrawnCoins ?? 0;

    res.json(successResponse({
      balanceCoins,
      balanceInr: balanceCoins / COINS_PER_INR,
      totalEarnedCoins,
      totalEarnedInr: totalEarnedCoins / COINS_PER_INR,
      totalWithdrawnCoins,
      totalWithdrawnInr: totalWithdrawnCoins / COINS_PER_INR,
      todayEarnedCoins: agg?.today ?? 0,
      todayEarnedInr: (agg?.today ?? 0) / COINS_PER_INR,
      weekEarnedCoins: agg?.week ?? 0,
      weekEarnedInr: (agg?.week ?? 0) / COINS_PER_INR,
      monthEarnedCoins: agg?.month ?? 0,
      monthEarnedInr: (agg?.month ?? 0) / COINS_PER_INR,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getEarningsHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      EarningsTransaction.find({ hostId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      EarningsTransaction.countDocuments({ hostId: req.userId }),
    ]);

    const withInr = transactions.map(t => ({
      ...t.toObject(),
      amountInr: t.amountCoins / COINS_PER_INR,
    }));

    res.json(successResponse(withInr, {
      page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// GET /api/earnings/daily?days=30 — per-day earnings for the host's dashboard chart.
// Buckets earning credits by IST calendar day and zero-fills every day in the window
// so the chart is continuous (oldest → newest).
export const getDailyEarnings = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10), 1), 90);
    // A touch of slack on the lower bound so no IST day at the edge is clipped by the UTC offset.
    const since = new Date(Date.now() - days * MS_PER_DAY);

    const rows = await EarningsTransaction.aggregate([
      {
        $match: {
          hostId: new mongoose.Types.ObjectId(req.userId),
          type: { $in: ['call_earning', 'gift_earning', 'bonus'] },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          coins: { $sum: '$amountCoins' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byDate = new Map<string, { coins: number; count: number }>();
    for (const r of rows) byDate.set(r._id as string, { coins: r.coins, count: r.count });

    const stats: { date: string; coins: number; inr: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = istDateKey(new Date(Date.now() - i * MS_PER_DAY));
      const coins = byDate.get(key)?.coins ?? 0;
      stats.push({ date: key, coins, inr: coins / COINS_PER_INR });
    }

    res.json(successResponse({ stats }));
  } catch (error) {
    console.error('getDailyEarnings error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const requestWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amountInr, method } = req.body;
    if (!amountInr || amountInr < 200) {
      res.status(400).json(errorResponse('MIN_WITHDRAWAL', 'Minimum withdrawal amount is ₹200'));
      return;
    }

    const amountCoins = amountInr * COINS_PER_INR;

    if (amountCoins < MIN_WITHDRAWAL_COINS) {
      res.status(400).json(errorResponse('MIN_WITHDRAWAL', `Minimum withdrawal is ₹${200}`));
      return;
    }

    // Atomic deduct: succeeds only if balance still covers the amount, so two
    // concurrent requests can't both pass and over-withdraw.
    const earnings = await HostEarnings.findOneAndUpdate(
      { userId: req.userId, balanceCoins: { $gte: amountCoins } },
      { $inc: { balanceCoins: -amountCoins } },
      { new: true }
    );
    if (!earnings) {
      res.status(402).json(errorResponse('INSUFFICIENT_BALANCE', 'Insufficient earnings balance'));
      return;
    }

    await EarningsTransaction.create({
      hostId: req.userId,
      type: 'withdrawal',
      amountCoins: -amountCoins,
      description: `Withdrawal request — ₹${amountInr}`,
    });

    const withdrawal = await PayoutRequest.create({
      hostId: req.userId,
      amountCoins,
      amountInr,
      method: method || 'bank_transfer',
    });

    res.json(successResponse({ withdrawalId: withdrawal._id, status: 'pending' }));
  } catch (error) {
    console.error('requestWithdrawal error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const withdrawals = await PayoutRequest.find({ hostId: req.userId }).sort({ requestedAt: -1 });
    res.json(successResponse(withdrawals));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getWithdrawalById = async (req: Request, res: Response): Promise<void> => {
  try {
    const withdrawal = await PayoutRequest.findOne({ _id: req.params.id, hostId: req.userId });
    if (!withdrawal) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Withdrawal not found'));
      return;
    }
    res.json(successResponse(withdrawal));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
