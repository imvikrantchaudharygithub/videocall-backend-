import { Request, Response } from 'express';
import { CallerWallet } from '../models/callerWallet.model';
import { WalletTransaction } from '../models/walletTransaction.model';
import { CreditPack } from '../models/creditPack.model';
import { errorResponse, successResponse } from '../types';

export const getBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = await CallerWallet.findOne({ userId: req.userId });
    res.json(successResponse({ balanceCoins: wallet?.balanceCoins ?? 0 }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', type } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { userId: req.userId };
    if (type) filter.type = { $in: type.split('|') };

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      WalletTransaction.countDocuments(filter),
    ]);

    res.json(successResponse(transactions, {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getCoinPacks = async (req: Request, res: Response): Promise<void> => {
  try {
    const packs = await CreditPack.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json(successResponse(packs));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
