import mongoose from 'mongoose';
import { CallerWallet } from '../models/callerWallet.model';
import { WalletTransaction } from '../models/walletTransaction.model';

export const addCoins = async (
  userId: mongoose.Types.ObjectId,
  coinsToAdd: number,
  type: 'credit_purchase' | 'refund' | 'referral_bonus' | 'welcome_bonus' | 'daily_bonus' | 'first_purchase_bonus' | 'vip_daily' | 'vip_bonus' | 'happy_hour_bonus',
  description: string,
  paymentOrderId?: mongoose.Types.ObjectId
): Promise<number> => {
  const wallet = await CallerWallet.findOneAndUpdate(
    { userId },
    {
      $inc: {
        balanceCoins: coinsToAdd,
        totalPurchasedCoins: type === 'credit_purchase' ? coinsToAdd : 0,
      },
    },
    { new: true, upsert: true }
  );

  const balanceAfter = wallet.balanceCoins;
  const balanceBefore = balanceAfter - coinsToAdd;

  await WalletTransaction.create({
    userId,
    type,
    amountCoins: coinsToAdd,
    balanceBefore,
    balanceAfter,
    paymentOrderId,
    description,
  });

  return balanceAfter;
};

export const deductCoins = async (
  userId: mongoose.Types.ObjectId,
  coinsToDeduct: number,
  type: 'call_deduction' | 'gift_sent',
  description: string,
  callId?: mongoose.Types.ObjectId
): Promise<{ newBalance: number; success: boolean }> => {
  const wallet = await CallerWallet.findOne({ userId });
  if (!wallet || wallet.balanceCoins < coinsToDeduct) {
    return { newBalance: wallet?.balanceCoins ?? 0, success: false };
  }

  const balanceBefore = wallet.balanceCoins;
  wallet.balanceCoins -= coinsToDeduct;
  wallet.totalSpentCoins += coinsToDeduct;
  await wallet.save();

  await WalletTransaction.create({
    userId,
    type,
    amountCoins: -coinsToDeduct,
    balanceBefore,
    balanceAfter: wallet.balanceCoins,
    callId,
    description,
  });

  return { newBalance: wallet.balanceCoins, success: true };
};

export const getBalance = async (userId: mongoose.Types.ObjectId): Promise<number> => {
  const wallet = await CallerWallet.findOne({ userId });
  return wallet?.balanceCoins ?? 0;
};
