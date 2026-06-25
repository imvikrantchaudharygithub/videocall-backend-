import mongoose from 'mongoose';
import razorpay from '../config/razorpay';
import { ENV } from '../config/env';
import { VipPlan, IVipPlan } from '../models/vipPlan.model';
import { VipSubscription } from '../models/vipSubscription.model';
import { User } from '../models/user.model';
import { addCoins } from './walletService';

/**
 * Get a user's active VIP subscription (if any)
 */
export const getActiveSubscription = async (userId: mongoose.Types.ObjectId) => {
  return VipSubscription.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() },
  }).populate('planId');
};

/**
 * Get VIP tier for a user (0 = none)
 */
export const getUserVipTier = async (userId: mongoose.Types.ObjectId): Promise<number> => {
  const sub = await VipSubscription.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() },
  });
  return sub?.tier ?? 0;
};

/**
 * Get VIP plan details for a user's active subscription
 */
export const getUserVipPlan = async (userId: mongoose.Types.ObjectId): Promise<IVipPlan | null> => {
  const sub = await VipSubscription.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() },
  });
  if (!sub) return null;
  return VipPlan.findById(sub.planId);
};

/**
 * Create a Razorpay order for VIP subscription purchase
 */
export const createVipOrder = async (
  userId: mongoose.Types.ObjectId,
  planId: string,
  billingCycle: 'weekly' | 'monthly'
) => {
  const plan = await VipPlan.findOne({ _id: planId, isActive: true });
  if (!plan) return null;

  const price = billingCycle === 'weekly' ? plan.weeklyPriceInr : plan.priceInr;
  const amountInPaise = price * 100;

  const rzpOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `vip_${userId.toString().slice(-8)}_${Date.now()}`,
    notes: {
      type: 'vip_subscription',
      planId: plan._id.toString(),
      tier: plan.tier.toString(),
      billingCycle,
    },
  });

  return {
    orderId: rzpOrder.id,
    amount: amountInPaise,
    currency: 'INR',
    key: ENV.RAZORPAY_KEY_ID,
    planName: plan.name,
    billingCycle,
  };
};

/**
 * Activate VIP subscription after successful payment
 */
export const activateVipSubscription = async (
  userId: mongoose.Types.ObjectId,
  planId: string,
  billingCycle: 'weekly' | 'monthly',
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<boolean> => {
  const plan = await VipPlan.findById(planId);
  if (!plan) return false;

  // Cancel any existing active subscription
  await VipSubscription.updateMany(
    { userId, status: 'active' },
    { $set: { status: 'expired' } }
  );

  const durationDays = billingCycle === 'weekly' ? 7 : 30;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const price = billingCycle === 'weekly' ? plan.weeklyPriceInr : plan.priceInr;

  await VipSubscription.create({
    userId,
    planId: plan._id,
    tier: plan.tier,
    planName: plan.name,
    billingCycle,
    status: 'active',
    startDate,
    endDate,
    autoRenew: true,
    razorpaySubscriptionId: razorpayOrderId,
    amountPaid: price,
    paymentHistory: [{
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      amount: price,
      paidAt: new Date(),
      status: 'paid',
    }],
  });

  // Update user model with VIP fields
  await User.findByIdAndUpdate(userId, {
    vipTier: plan.tier,
    vipExpiresAt: endDate,
    vipBadge: plan.badgeType,
  });

  return true;
};

/**
 * Claim daily free coins for VIP users
 */
export const claimVipDailyCoins = async (
  userId: mongoose.Types.ObjectId
): Promise<{ success: boolean; coinsAwarded: number; message: string }> => {
  const sub = await VipSubscription.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() },
  });

  if (!sub) {
    return { success: false, coinsAwarded: 0, message: 'No active VIP subscription' };
  }

  const plan = await VipPlan.findById(sub.planId);
  if (!plan || plan.dailyFreeCoins <= 0) {
    return { success: false, coinsAwarded: 0, message: 'No daily coins in your plan' };
  }

  // Check if already claimed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (sub.dailyCoinsClaimed && sub.dailyCoinsClaimed >= today) {
    return { success: false, coinsAwarded: 0, message: 'Daily coins already claimed today' };
  }

  // Credit coins
  await addCoins(userId, plan.dailyFreeCoins, 'vip_daily', `VIP daily coins — ${plan.name}`);

  // Update claim timestamp
  sub.dailyCoinsClaimed = new Date();
  await sub.save();

  return { success: true, coinsAwarded: plan.dailyFreeCoins, message: 'Daily coins claimed!' };
};

/**
 * Cancel VIP subscription auto-renewal
 */
export const cancelVipSubscription = async (
  userId: mongoose.Types.ObjectId
): Promise<boolean> => {
  const sub = await VipSubscription.findOne({ userId, status: 'active' });
  if (!sub) return false;

  sub.autoRenew = false;
  sub.cancelledAt = new Date();
  await sub.save();

  return true;
};

/**
 * Expire overdue subscriptions (run via cron or on-demand)
 */
export const expireOverdueSubscriptions = async (): Promise<number> => {
  const result = await VipSubscription.updateMany(
    { status: 'active', endDate: { $lte: new Date() } },
    { $set: { status: 'expired' } }
  );

  // Clear VIP fields on expired users
  if (result.modifiedCount > 0) {
    const expiredSubs = await VipSubscription.find({
      status: 'expired',
      endDate: { $lte: new Date() },
    }).select('userId');

    const userIds = expiredSubs.map(s => s.userId);
    await User.updateMany(
      { _id: { $in: userIds }, vipExpiresAt: { $lte: new Date() } },
      { $set: { vipTier: 0, vipBadge: '' } }
    );
  }

  return result.modifiedCount;
};

/**
 * Calculate bonus coins based on VIP tier
 */
export const calculateVipBonusCoins = async (
  userId: mongoose.Types.ObjectId,
  baseCoins: number
): Promise<number> => {
  const plan = await getUserVipPlan(userId);
  if (!plan || plan.bonusCoinPercent <= 0) return 0;
  return Math.floor(baseCoins * plan.bonusCoinPercent / 100);
};

/**
 * Calculate call rate discount based on VIP tier
 */
export const getCallRateDiscount = async (
  userId: mongoose.Types.ObjectId
): Promise<number> => {
  const plan = await getUserVipPlan(userId);
  return plan?.callRateDiscountPercent ?? 0;
};
