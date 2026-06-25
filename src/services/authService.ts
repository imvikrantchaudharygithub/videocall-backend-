import { v4 as uuidv4 } from 'uuid';
import redis from '../config/redis';
import { generateOTP, sendOTP } from '../utils/otp';
import { generateAccessToken } from '../utils/token';
import { SESSION_EXPIRY_DAYS, WELCOME_BONUS_COINS } from '../utils/constants';
import { addCoins } from './walletService';
import { User } from '../models/user.model';
import { CallerProfile } from '../models/callerProfile.model';
import { HostProfile } from '../models/hostProfile.model';
import { CallerWallet } from '../models/callerWallet.model';
import { HostEarnings } from '../models/hostEarnings.model';
import mongoose from 'mongoose';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

export const sendOTPService = async (phone: string): Promise<{ success: boolean; message: string }> => {
  const otp = generateOTP();
  await redis.set(`otp:${phone}`, otp, 'EX', OTP_EXPIRY_SECONDS);
  const sent = await sendOTP(phone, otp);
  if (!sent) return { success: false, message: 'Failed to send OTP' };
  return { success: true, message: 'OTP sent successfully' };
};

export const verifyOTPService = async (
  phone: string,
  otp: string,
  userType: 'caller' | 'host' = 'caller'
): Promise<{
  accessToken: string;
  sessionId: string;
  user: { _id: mongoose.Types.ObjectId; displayName: string; phone: string; userType: string; coinBalance?: number };
  isNewUser: boolean;
} | null> => {
  const storedOtp = await redis.get(`otp:${phone}`);
  if (!storedOtp || storedOtp !== otp) return null;

  await redis.del(`otp:${phone}`);

  let isNewUser = false;
  let user = await User.findOne({ phone });

  if (!user) {
    isNewUser = true;
    const referralCode = uuidv4().substring(0, 8).toUpperCase();
    user = await User.create({
      phone,
      displayName: `User${Math.floor(Math.random() * 10000)}`,
      userType,
      referralCode,
    });

    if (userType === 'caller') {
      await CallerProfile.create({ userId: user._id });
      await CallerWallet.create({ userId: user._id });
      // Welcome bonus for new callers
      if (WELCOME_BONUS_COINS > 0) {
        await addCoins(user._id, WELCOME_BONUS_COINS, 'welcome_bonus', `Welcome bonus — ${WELCOME_BONUS_COINS} free coins`);
      }
    } else {
      await HostProfile.create({ userId: user._id });
      await HostEarnings.create({ userId: user._id });
    }
  }

  const sessionId = uuidv4();
  const sessionExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  user.sessionId = sessionId;
  user.sessionExpiry = sessionExpiry;
  user.lastLoginAt = new Date();
  await user.save();

  // Cache session in Redis
  await redis.set(`user:session:${sessionId}`, user._id.toString(), 'EX', SESSION_EXPIRY_DAYS * 24 * 60 * 60);

  const accessToken = generateAccessToken(user._id.toString(), user.userType);

  let coinBalance: number | undefined;
  if (user.userType === 'caller') {
    const wallet = await CallerWallet.findOne({ userId: user._id });
    coinBalance = wallet?.balanceCoins ?? 0;
  }

  // host app needs approval state + profile on the login response
  let hostExtras: Record<string, unknown> = {};
  if (user.userType === 'host') {
    const hp = await HostProfile.findOne({ userId: user._id });
    hostExtras = {
      isApproved: hp?.isApproved ?? false,
      isBanned: user.isBanned ?? false,
      profile: hp
        ? {
            bio: hp.bio,
            photos: hp.photoUrls,
            tier: hp.currentTier,
            videoRatePerMin: hp.videoRatePerMin,
            voiceRatePerMin: hp.voiceRatePerMin,
            averageRating: hp.ratingAvg,
            totalCalls: hp.totalCallsReceived,
            isOnline: hp.isOnline,
            isBusy: hp.isBusy,
            languages: hp.languages,
          }
        : undefined,
    };
  }

  return {
    accessToken,
    sessionId,
    user: {
      ...hostExtras,
      _id: user._id,
      displayName: user.displayName,
      phone: user.phone,
      userType: user.userType,
      coinBalance,
    },
    isNewUser,
  };
};

export const fastLoginService = async (sessionId: string): Promise<{
  accessToken: string;
  user: { _id: mongoose.Types.ObjectId; displayName: string; phone: string; userType: string; isGuest: boolean; coinBalance?: number };
} | null> => {
  const user = await User.findOne({
    sessionId,
    sessionExpiry: { $gt: new Date() },
  });

  if (!user) return null;

  const accessToken = generateAccessToken(user._id.toString(), user.userType);
  user.lastLoginAt = new Date();
  await user.save();

  let coinBalance: number | undefined;
  if (user.userType === 'caller') {
    const wallet = await CallerWallet.findOne({ userId: user._id });
    coinBalance = wallet?.balanceCoins ?? 0;
  }

  return {
    accessToken,
    user: {
      _id: user._id,
      displayName: user.displayName,
      phone: user.phone,
      userType: user.userType,
      isGuest: user.isGuest ?? false,
      coinBalance,
    },
  };
};

export const guestLoginService = async (deviceId?: string): Promise<{
  accessToken: string;
  sessionId: string;
  user: { _id: mongoose.Types.ObjectId; displayName: string; userType: string; isGuest: boolean; coinBalance: number };
  isNewUser: boolean;
}> => {
  let isNewUser = false;
  let user = deviceId ? await User.findOne({ phone: `guest_${deviceId}` }) : null;

  if (!user) {
    isNewUser = true;
    const guestId = deviceId || uuidv4();
    const referralCode = uuidv4().substring(0, 8).toUpperCase();
    user = await User.create({
      phone: `guest_${guestId}`,
      displayName: `Guest${Math.floor(Math.random() * 100000)}`,
      userType: 'caller',
      isGuest: true,
      referralCode,
    });

    await CallerProfile.create({ userId: user._id });
    await CallerWallet.create({ userId: user._id });

    // Welcome bonus
    if (WELCOME_BONUS_COINS > 0) {
      await addCoins(user._id, WELCOME_BONUS_COINS, 'welcome_bonus', `Welcome bonus — ${WELCOME_BONUS_COINS} free coins`);
    }
  }

  const sessionId = uuidv4();
  const sessionExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  user.sessionId = sessionId;
  user.sessionExpiry = sessionExpiry;
  user.lastLoginAt = new Date();
  await user.save();

  await redis.set(`user:session:${sessionId}`, user._id.toString(), 'EX', SESSION_EXPIRY_DAYS * 24 * 60 * 60);

  const accessToken = generateAccessToken(user._id.toString(), user.userType);

  const wallet = await CallerWallet.findOne({ userId: user._id });
  const coinBalance = wallet?.balanceCoins ?? 0;

  return {
    accessToken,
    sessionId,
    user: {
      _id: user._id,
      displayName: user.displayName,
      userType: user.userType,
      isGuest: true,
      coinBalance,
    },
    isNewUser,
  };
};
