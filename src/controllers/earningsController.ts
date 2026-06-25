import { Request, Response } from 'express';
import { HostEarnings } from '../models/hostEarnings.model';
import { EarningsTransaction } from '../models/earningsTransaction.model';
import { PayoutRequest } from '../models/payoutRequest.model';
import { errorResponse, successResponse } from '../types';
import { MIN_WITHDRAWAL_COINS, COINS_PER_INR } from '../utils/constants';
import mongoose from 'mongoose';

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

export const requestWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amountInr, method } = req.body;
    if (!amountInr || amountInr < 200) {
      res.status(400).json(errorResponse('MIN_WITHDRAWAL', 'Minimum withdrawal amount is ₹200'));
      return;
    }

    const amountCoins = amountInr * COINS_PER_INR;
    const earnings = await HostEarnings.findOne({ userId: req.userId });

    if (!earnings || earnings.balanceCoins < amountCoins) {
      res.status(402).json(errorResponse('INSUFFICIENT_BALANCE', 'Insufficient earnings balance'));
      return;
    }

    if (amountCoins < MIN_WITHDRAWAL_COINS) {
      res.status(400).json(errorResponse('MIN_WITHDRAWAL', `Minimum withdrawal is ₹${200}`));
      return;
    }

    // Deduct coins immediately to prevent double-spending
    earnings.balanceCoins -= amountCoins;
    await earnings.save();

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
