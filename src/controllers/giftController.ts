import { Request, Response } from 'express';
import { Gift } from '../models/gift.model';
import { Call } from '../models/call.model';
import { HostEarnings } from '../models/hostEarnings.model';
import { EarningsTransaction } from '../models/earningsTransaction.model';
import { deductCoins } from '../services/walletService';
import { getUserVipTier } from '../services/vipService';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

export const listGifts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userVipTier = await getUserVipTier(req.userId!);
    const gifts = await Gift.find({ isActive: true }).sort({ sortOrder: 1 });
    // Filter: show non-exclusive gifts + exclusive gifts the user qualifies for
    const filteredGifts = gifts.filter(g => !g.isVipExclusive || userVipTier >= g.requiredVipTier);
    res.json(successResponse(filteredGifts));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const sendGift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { giftId, hostId, callId } = req.body;

    const gift = await Gift.findOne({ _id: giftId, isActive: true });
    if (!gift) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Gift not found'));
      return;
    }

    const result = await deductCoins(
      req.userId!,
      gift.costCoins,
      'gift_sent',
      `Gift: ${gift.name}`,
      callId ? new mongoose.Types.ObjectId(callId) : undefined
    );

    if (!result.success) {
      res.status(402).json(errorResponse('INSUFFICIENT_BALANCE', 'Not enough coins to send this gift'));
      return;
    }

    const hostEarnings = Math.floor(gift.costCoins * gift.hostSharePercent / 100);

    await HostEarnings.updateOne(
      { userId: hostId },
      { $inc: { balanceCoins: hostEarnings, totalEarnedCoins: hostEarnings } }
    );

    await EarningsTransaction.create({
      hostId: new mongoose.Types.ObjectId(hostId),
      type: 'gift_earning',
      amountCoins: hostEarnings,
      callId: callId ? new mongoose.Types.ObjectId(callId) : undefined,
      description: `Gift received: ${gift.name}`,
    });

    if (callId) {
      await Call.updateOne(
        { _id: callId },
        {
          $push: {
            giftsSent: {
              giftId: gift._id,
              giftName: gift.name,
              costCoins: gift.costCoins,
              hostEarnings,
              sentAt: new Date(),
            },
          },
        }
      );
    }

    res.json(successResponse({
      success: true,
      coinsDeducted: gift.costCoins,
      newBalance: result.newBalance,
    }));
  } catch (error) {
    console.error('sendGift error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
