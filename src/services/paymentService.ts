import crypto from 'crypto';
import razorpay from '../config/razorpay';
import { ENV } from '../config/env';
import { PaymentOrder } from '../models/paymentOrder.model';
import { CreditPack } from '../models/creditPack.model';
import { CallerWallet } from '../models/callerWallet.model';
import { User } from '../models/user.model';
import { addCoins } from './walletService';
import { calculateVipBonusCoins } from './vipService';
import { calculateHappyHourBonus } from './happyHourService';
import { REFERRAL_BONUS_COINS, FIRST_PURCHASE_BONUS_PERCENT } from '../utils/constants';
import mongoose from 'mongoose';

export const createPaymentOrder = async (
  userId: mongoose.Types.ObjectId,
  packId: string
): Promise<{ orderId: string; amount: number; currency: string; key: string } | null> => {
  const pack = await CreditPack.findOne({ packId, isActive: true });
  if (!pack) return null;

  const amountInPaise = pack.amountInr * 100;

  const rzpOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `cc_${userId.toString().slice(-8)}_${Date.now()}`,
  });

  await PaymentOrder.create({
    userId,
    packId,
    amountInr: pack.amountInr,
    coinsToAdd: pack.totalCoins,
    razorpayOrderId: rzpOrder.id,
  });

  return {
    orderId: rzpOrder.id,
    amount: amountInPaise,
    currency: 'INR',
    key: ENV.RAZORPAY_KEY_ID,
  };
};

export const verifyPayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): Promise<boolean> => {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === razorpaySignature;
};

export const processPaymentSuccess = async (
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<boolean> => {
  // Atomic claim: only one concurrent call (client verify vs webhook) wins the
  // 'created' -> 'paid' transition, preventing double coin-credit.
  const order = await PaymentOrder.findOneAndUpdate(
    { razorpayOrderId, status: 'created' },
    { $set: { status: 'paid', razorpayPaymentId } },
    { new: true }
  );
  if (!order) return false;

  await addCoins(
    order.userId,
    order.coinsToAdd,
    'credit_purchase',
    `Coin pack purchase — ${order.coinsToAdd} coins`,
    order._id
  );

  // VIP bonus: extra coins based on VIP tier
  const vipBonus = await calculateVipBonusCoins(order.userId, order.coinsToAdd);
  if (vipBonus > 0) {
    await addCoins(
      order.userId,
      vipBonus,
      'vip_bonus',
      `VIP bonus — ${vipBonus} extra coins on purchase`
    );
  }

  // Happy Hour bonus: time-based bonus coins
  const happyHourResult = await calculateHappyHourBonus(order.coinsToAdd);
  if (happyHourResult && happyHourResult.bonus > 0) {
    await addCoins(
      order.userId,
      happyHourResult.bonus,
      'happy_hour_bonus',
      `${happyHourResult.eventName} — ${happyHourResult.bonus} bonus coins`
    );
  }

  // First-purchase bonus: extra 20% coins on first-ever purchase
  const wallet = await CallerWallet.findOne({ userId: order.userId });
  if (wallet && !wallet.hasUsedFirstPurchaseBonus) {
    const bonusCoins = Math.floor(order.coinsToAdd * FIRST_PURCHASE_BONUS_PERCENT / 100);
    await addCoins(
      order.userId,
      bonusCoins,
      'first_purchase_bonus',
      `First purchase bonus — ${FIRST_PURCHASE_BONUS_PERCENT}% extra (${bonusCoins} coins)`
    );
    wallet.hasUsedFirstPurchaseBonus = true;
    await wallet.save();

    // Referral completion: credit referrer when referred user makes first purchase
    const user = await User.findById(order.userId);
    if (user?.referredBy) {
      await addCoins(
        user.referredBy,
        REFERRAL_BONUS_COINS,
        'referral_bonus',
        `Referral bonus — ${user.displayName} made their first purchase`
      );
    }
  }

  return true;
};

export const verifyWebhookSignature = (body: string, signature: string): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
};
