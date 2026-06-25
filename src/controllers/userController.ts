import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { CallerProfile } from '../models/callerProfile.model';
import { HostProfile } from '../models/hostProfile.model';
import { CallerWallet } from '../models/callerWallet.model';
import { HostEarnings } from '../models/hostEarnings.model';
import { Call } from '../models/call.model';
import { errorResponse, successResponse } from '../types';

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-sessionId -sessionExpiry -passwordHash');
    if (!user) {
      res.status(404).json(errorResponse('NOT_FOUND', 'User not found'));
      return;
    }

    let profile = null;
    let balance = 0;

    if (user.userType === 'caller') {
      profile = await CallerProfile.findOne({ userId: user._id });
      const wallet = await CallerWallet.findOne({ userId: user._id });
      balance = wallet?.balanceCoins ?? 0;
    } else {
      profile = await HostProfile.findOne({ userId: user._id }).select('-bankDetails');
      const earnings = await HostEarnings.findOne({ userId: user._id });
      balance = earnings?.balanceCoins ?? 0;
    }

    res.json(successResponse({ user, profile, balance }));
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { displayName, email } = req.body;
    await User.updateOne(
      { _id: req.userId },
      { $set: { displayName, email } }
    );
    res.json(successResponse({ message: 'Profile updated' }));
  } catch (error) {
    console.error('updateMe error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File & { path: string };
    if (!file) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'No file uploaded'));
      return;
    }

    const avatarUrl = file.path;

    if (req.userType === 'caller') {
      await CallerProfile.updateOne({ userId: req.userId }, { $set: { avatarUrl } });
    } else {
      await HostProfile.updateOne({ userId: req.userId }, { $set: { avatarUrl } });
    }

    res.json(successResponse({ avatarUrl }));
  } catch (error) {
    console.error('uploadAvatar error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const updateFcmToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fcmToken } = req.body;
    await User.updateOne({ _id: req.userId }, { $set: { fcmToken } });
    res.json(successResponse({ message: 'FCM token updated' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const verifyAge = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateOfBirth } = req.body;
    if (!dateOfBirth) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Date of birth is required'));
      return;
    }

    const dob = new Date(dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      res.status(403).json(errorResponse('UNDERAGE', 'You must be 18 or older to use this service'));
      return;
    }

    await User.updateOne(
      { _id: req.userId },
      { $set: { dateOfBirth: dob, isAgeVerified: true } }
    );

    res.json(successResponse({ verified: true, age }));
  } catch (error) {
    console.error('verifyAge error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getMyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.userType === 'caller') {
      const profile = await CallerProfile.findOne({ userId: req.userId });
      const wallet = await CallerWallet.findOne({ userId: req.userId });
      res.json(successResponse({
        totalCallsMade: profile?.totalCallsMade ?? 0,
        totalCoinsSpent: profile?.totalCoinsSpent ?? 0,
        totalPurchasedCoins: wallet?.totalPurchasedCoins ?? 0,
        coinBalance: wallet?.balanceCoins ?? 0,
      }));
    } else {
      const hostProfile = await HostProfile.findOne({ userId: req.userId });
      const earnings = await HostEarnings.findOne({ userId: req.userId });
      const totalCalls = await Call.countDocuments({ hostId: req.userId, status: 'ended' });
      res.json(successResponse({
        totalCallsReceived: hostProfile?.totalCallsReceived ?? 0,
        totalCallMinutes: hostProfile?.totalCallMinutes ?? 0,
        totalEarnedCoins: earnings?.totalEarnedCoins ?? 0,
        earningsBalance: earnings?.balanceCoins ?? 0,
        totalCalls,
      }));
    }
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
