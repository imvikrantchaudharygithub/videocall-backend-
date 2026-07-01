import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/adminUser.model';
import { User } from '../models/user.model';
import { HostProfile } from '../models/hostProfile.model';
import { Call } from '../models/call.model';
import { PayoutRequest } from '../models/payoutRequest.model';
import { WalletTransaction } from '../models/walletTransaction.model';
import { Report } from '../models/report.model';
import { Gift } from '../models/gift.model';
import { HostTier } from '../models/hostTier.model';
import { CreditPack } from '../models/creditPack.model';
import { PlatformSetting } from '../models/platformSetting.model';
import { Notification } from '../models/notification.model';
import { CallerWallet } from '../models/callerWallet.model';
import { HostEarnings } from '../models/hostEarnings.model';
import { LoginStreak } from '../models/loginStreak.model';
import { generateAdminToken } from '../utils/token';
import { sendPushNotification } from '../services/notificationService';
import { createRazorpayPayout } from '../services/payoutService';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const admin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (!admin) {
      res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid credentials'));
      return;
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid credentials'));
      return;
    }

    const token = generateAdminToken(admin._id.toString(), admin.role);
    res.json(successResponse({ token, admin: { _id: admin._id, email: admin.email, role: admin.role } }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCallers, totalHosts, onlineHosts, activeCalls,
      todayCalls, todayRevenue, pendingApprovals, pendingWithdrawals,
    ] = await Promise.all([
      User.countDocuments({ userType: 'caller' }),
      User.countDocuments({ userType: 'host' }),
      HostProfile.countDocuments({ isOnline: true }),
      Call.countDocuments({ status: 'active' }),
      Call.countDocuments({ status: 'ended', createdAt: { $gte: today } }),
      Call.aggregate([
        { $match: { status: 'ended', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$platformEarningsCoins' } } },
      ]),
      HostProfile.countDocuments({ approvalStatus: 'pending' }),
      PayoutRequest.countDocuments({ status: 'pending' }),
    ]);

    res.json(successResponse({
      totalCallers, totalHosts, onlineHosts, activeCalls,
      todayCalls,
      todayRevenueCoin: todayRevenue[0]?.total ?? 0,
      pendingApprovals, pendingWithdrawals,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── User Management ─────────────────────────────────────────────────────────

const getUserList = async (req: Request, res: Response, userType: 'caller' | 'host'): Promise<void> => {
  const { page = '1', limit = '20', search, isBanned } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 100);

  const filter: Record<string, unknown> = { userType };
  if (search) filter.displayName = { $regex: search, $options: 'i' };
  if (isBanned !== undefined) filter.isBanned = isBanned === 'true';

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    User.countDocuments(filter),
  ]);

  res.json(successResponse(users, { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }));
};

export const listCallers = (req: Request, res: Response) => getUserList(req, res, 'caller');
export const listHosts = (req: Request, res: Response) => getUserList(req, res, 'host');

export const getUserDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json(errorResponse('NOT_FOUND', 'User not found')); return; }

    let profile = null;
    let balance = null;

    if (user.userType === 'caller') {
      profile = await HostProfile.findOne({ userId: user._id });
      balance = await CallerWallet.findOne({ userId: user._id });
    } else {
      profile = await HostProfile.findOne({ userId: user._id });
      balance = await HostEarnings.findOne({ userId: user._id });
    }

    res.json(successResponse({ user, profile, balance }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const banUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { banned, reason } = req.body;
    await User.updateOne({ _id: req.params.id }, { $set: { isBanned: banned, banReason: reason } });
    res.json(successResponse({ message: `User ${banned ? 'banned' : 'unbanned'}` }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const adjustBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { coins } = req.body;
    await CallerWallet.updateOne({ userId: req.params.id }, { $inc: { balanceCoins: coins } });
    res.json(successResponse({ message: 'Balance adjusted' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const changeHostTier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tier } = req.body;
    const tierData = await HostTier.findOne({ tierLevel: tier });
    if (!tierData) { res.status(404).json(errorResponse('NOT_FOUND', 'Tier not found')); return; }

    await HostProfile.updateOne(
      { userId: req.params.id },
      { $set: { currentTier: tier, videoRatePerMin: tierData.videoRatePerMin, voiceRatePerMin: Math.floor(tierData.videoRatePerMin * 0.9) } }
    );
    res.json(successResponse({ message: 'Tier updated' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Host Approval ────────────────────────────────────────────────────────────

export const getPendingHosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const hosts = await HostProfile.find({ approvalStatus: 'pending' })
      .populate('userId', 'displayName phone createdAt');
    res.json(successResponse(hosts));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const approveHost = async (req: Request, res: Response): Promise<void> => {
  try {
    await HostProfile.updateOne(
      { userId: req.params.id },
      { $set: { isApproved: true, approvalStatus: 'approved' } }
    );
    const id = req.params.id;
    const idStr = Array.isArray(id) ? id[0] : id;
    await sendPushNotification(
      new mongoose.Types.ObjectId(idStr),
      '🎉 Application Approved!',
      'Your host application has been approved. You can now go online and receive calls.'
    );
    res.json(successResponse({ message: 'Host approved' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const rejectHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    await HostProfile.updateOne(
      { userId: req.params.id },
      { $set: { isApproved: false, approvalStatus: 'rejected', rejectionReason: reason } }
    );
    res.json(successResponse({ message: 'Host rejected' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Calls ────────────────────────────────────────────────────────────────────

export const getActiveCalls = async (req: Request, res: Response): Promise<void> => {
  try {
    const calls = await Call.find({ status: 'active' })
      .populate('callerId', 'displayName')
      .populate('hostId', 'displayName');
    res.json(successResponse(calls));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getCallLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    const [calls, total] = await Promise.all([
      Call.find({}).sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('callerId', 'displayName')
        .populate('hostId', 'displayName'),
      Call.countDocuments(),
    ]);

    res.json(successResponse(calls, { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const forceEndCall = async (req: Request, res: Response): Promise<void> => {
  try {
    await Call.updateOne(
      { _id: req.params.id, status: 'active' },
      { $set: { status: 'ended', endedAt: new Date(), endReason: 'admin_force' } }
    );
    res.json(successResponse({ message: 'Call force-ended' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Revenue ─────────────────────────────────────────────────────────────────

export const getRevenueOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const revenueAgg = async (from: Date) =>
      Call.aggregate([
        { $match: { status: 'ended', createdAt: { $gte: from } } },
        { $group: { _id: null, coins: { $sum: '$platformEarningsCoins' }, calls: { $sum: 1 } } },
      ]);

    const [today, week, month, allTime] = await Promise.all([
      revenueAgg(todayStart),
      revenueAgg(weekStart),
      revenueAgg(monthStart),
      revenueAgg(new Date(0)),
    ]);

    res.json(successResponse({
      today: today[0] ?? { coins: 0, calls: 0 },
      week: week[0] ?? { coins: 0, calls: 0 },
      month: month[0] ?? { coins: 0, calls: 0 },
      allTime: allTime[0] ?? { coins: 0, calls: 0 },
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getAllTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({}).sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum).limit(limitNum)
        .populate('userId', 'displayName'),
      WalletTransaction.countDocuments(),
    ]);

    res.json(successResponse(transactions, { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Payouts ─────────────────────────────────────────────────────────────────

export const getPendingWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const withdrawals = await PayoutRequest.find({ status: 'pending' })
      .populate('hostId', 'displayName phone');
    res.json(successResponse(withdrawals));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const approveWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    // Atomic claim: only one approve call wins pending -> processing, preventing
    // a concurrent double-approve from firing two real Razorpay payouts.
    const withdrawal = await PayoutRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true }
    );
    if (!withdrawal) {
      res.status(400).json(errorResponse('ALREADY_PROCESSED', 'Withdrawal not found or already processed'));
      return;
    }

    // Trigger Razorpay Payout
    const payoutResult = await createRazorpayPayout(
      withdrawal.hostId,
      withdrawal.amountInr,
      withdrawal.method,
      withdrawal._id.toString()
    );

    if (payoutResult.success) {
      withdrawal.status = 'completed';
      withdrawal.razorpayPayoutId = payoutResult.payoutId;
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      // Update totalWithdrawnCoins (balanceCoins already deducted at request time)
      await HostEarnings.updateOne(
        { userId: withdrawal.hostId },
        { $inc: { totalWithdrawnCoins: withdrawal.amountCoins } }
      );
      res.json(successResponse({ message: 'Withdrawal approved and payout initiated', payoutId: payoutResult.payoutId }));
    } else {
      // Payout failed — refund coins back and reject
      await HostEarnings.updateOne(
        { userId: withdrawal.hostId },
        { $inc: { balanceCoins: withdrawal.amountCoins } }
      );
      withdrawal.status = 'rejected';
      withdrawal.adminNote = `Payout failed: ${payoutResult.error}`;
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      res.status(500).json(errorResponse('PAYOUT_FAILED', payoutResult.error || 'Payout processing failed'));
    }
  } catch (error) {
    console.error('approveWithdrawal error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const rejectWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const withdrawal = await PayoutRequest.findById(req.params.id);
    if (!withdrawal) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Withdrawal not found'));
      return;
    }
    if (withdrawal.status !== 'pending') {
      res.status(400).json(errorResponse('ALREADY_PROCESSED', 'Withdrawal already processed'));
      return;
    }

    // Refund coins back (deducted at request time)
    await HostEarnings.updateOne(
      { userId: withdrawal.hostId },
      { $inc: { balanceCoins: withdrawal.amountCoins } }
    );

    withdrawal.status = 'rejected';
    withdrawal.adminNote = reason;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    res.json(successResponse({ message: 'Withdrawal rejected and coins refunded' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Content Management ──────────────────────────────────────────────────────

export const listGiftsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const gifts = await Gift.find().sort({ sortOrder: 1 });
    res.json(successResponse(gifts));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const createGift = async (req: Request, res: Response): Promise<void> => {
  try {
    const gift = await Gift.create(req.body);
    res.status(201).json(successResponse(gift));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const updateGift = async (req: Request, res: Response): Promise<void> => {
  try {
    const gift = await Gift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(successResponse(gift));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const deleteGift = async (req: Request, res: Response): Promise<void> => {
  try {
    const gift = await Gift.findByIdAndDelete(req.params.id);
    if (!gift) { res.status(404).json(errorResponse('NOT_FOUND', 'Gift not found')); return; }
    res.json(successResponse({ message: 'Gift deleted' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const listTiers = async (req: Request, res: Response): Promise<void> => {
  try {
    const tiers = await HostTier.find().sort({ tierLevel: 1 });
    res.json(successResponse(tiers));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const updateTier = async (req: Request, res: Response): Promise<void> => {
  try {
    const tier = await HostTier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(successResponse(tier));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const listCoinPacksAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const packs = await CreditPack.find().sort({ sortOrder: 1 });
    res.json(successResponse(packs));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const createCoinPack = async (req: Request, res: Response): Promise<void> => {
  try {
    const pack = await CreditPack.create(req.body);
    res.status(201).json(successResponse(pack));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const updateCoinPack = async (req: Request, res: Response): Promise<void> => {
  try {
    const pack = await CreditPack.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(successResponse(pack));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const deleteCoinPack = async (req: Request, res: Response): Promise<void> => {
  try {
    const pack = await CreditPack.findByIdAndDelete(req.params.id);
    if (!pack) { res.status(404).json(errorResponse('NOT_FOUND', 'Coin pack not found')); return; }
    res.json(successResponse({ message: 'Coin pack deleted' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export const listReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('reporterId', 'displayName')
        .populate('reportedId', 'displayName'),
      Report.countDocuments(filter),
    ]);

    res.json(successResponse(reports, { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const actionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, adminNote } = req.body;
    await Report.updateOne({ _id: req.params.id }, { $set: { status, adminNote } });
    res.json(successResponse({ message: 'Report updated' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const broadcastNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, body, userType } = req.body;

    const filter: Record<string, unknown> = {};
    if (userType) filter.userType = userType;

    const users = await User.find(filter).select('_id');

    const notifications = users.map((u) => ({ userId: u._id, title, body, type: 'system' as const }));
    await Notification.insertMany(notifications);

    res.json(successResponse({ message: `Notification queued for ${users.length} users` }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getNotificationHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ type: 'system' })
      .sort({ createdAt: -1 }).limit(100);
    res.json(successResponse(notifications));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Referral Tracking ───────────────────────────────────────────────────────

export const getReferrals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const matchStage: Record<string, unknown> = { referredBy: { $ne: null } };

    const pipeline: mongoose.PipelineStage[] = [
      { $match: matchStage },
      { $sort: { createdAt: -1 as const } },
      {
        $lookup: {
          from: 'users',
          localField: 'referredBy',
          foreignField: '_id',
          as: 'referrer',
        },
      },
      { $unwind: '$referrer' },
      {
        $lookup: {
          from: 'wallettransactions',
          let: { referrerId: '$referredBy', referredId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$referrerId'] },
                    { $eq: ['$type', 'referral_bonus'] },
                  ],
                },
              },
            },
          ],
          as: 'bonusTransaction',
        },
      },
      {
        $project: {
          referredUser: '$displayName',
          referredUserId: '$_id',
          referrerName: '$referrer.displayName',
          referrerId: '$referrer._id',
          referrerCode: '$referrer.referralCode',
          bonusCoins: { $ifNull: [{ $arrayElemAt: ['$bonusTransaction.amountCoins', 0] }, 0] },
          status: {
            $cond: {
              if: { $gt: [{ $size: '$bonusTransaction' }, 0] },
              then: 'credited',
              else: 'pending',
            },
          },
          referredAt: '$createdAt',
        },
      },
    ];

    // Apply status filter if provided
    if (status === 'credited' || status === 'pending') {
      pipeline.push({ $match: { status } });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    pipeline.push({ $skip: skip }, { $limit: limitNum });

    const [referrals, countResult] = await Promise.all([
      User.aggregate(pipeline),
      User.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total ?? 0;

    res.json(successResponse(referrals, {
      page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum),
    }));
  } catch (error) {
    console.error('getReferrals error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── User Activity Stats ────────────────────────────────────────────────────

export const getUserActivityStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);

    const [
      active24h, active7d, active30d,
      onlineNow, newSignupsToday, newSignupsWeek,
      totalGuests, totalVerified, totalCallers, totalHosts,
    ] = await Promise.all([
      User.countDocuments({ lastLoginAt: { $gte: h24 } }),
      User.countDocuments({ lastLoginAt: { $gte: d7 } }),
      User.countDocuments({ lastLoginAt: { $gte: d30 } }),
      User.countDocuments({ 'sessionExpiry': { $gte: now } }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: weekStart } }),
      User.countDocuments({ isGuest: true }),
      User.countDocuments({ isGuest: false }),
      User.countDocuments({ userType: 'caller' }),
      User.countDocuments({ userType: 'host' }),
    ]);

    res.json(successResponse({
      active24h, active7d, active30d,
      onlineNow,
      newSignupsToday, newSignupsWeek,
      totalGuests, totalVerified,
      totalCallers, totalHosts,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── User Activity List ─────────────────────────────────────────────────────

export const getUserActivityList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search, userType, isGuest } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};
    if (search) filter.displayName = { $regex: search, $options: 'i' };
    if (userType) filter.userType = userType;
    if (isGuest !== undefined) filter.isGuest = isGuest === 'true';

    const [users, total] = await Promise.all([
      User.aggregate([
        { $match: filter },
        { $sort: { lastLoginAt: -1 as const } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: 'callerwallets',
            localField: '_id',
            foreignField: 'userId',
            as: 'wallet',
          },
        },
        {
          $lookup: {
            from: 'calls',
            let: { uid: '$_id' },
            pipeline: [
              { $match: { $expr: { $or: [{ $eq: ['$callerId', '$$uid'] }, { $eq: ['$hostId', '$$uid'] }] } } },
              { $count: 'count' },
            ],
            as: 'callStats',
          },
        },
        {
          $project: {
            displayName: 1, phone: 1, userType: 1, isGuest: 1, isBanned: 1,
            lastLoginAt: 1, createdAt: 1,
            isOnline: { $cond: { if: { $gte: ['$sessionExpiry', new Date()] }, then: true, else: false } },
            totalCalls: { $ifNull: [{ $arrayElemAt: ['$callStats.count', 0] }, 0] },
            totalSpent: { $ifNull: [{ $arrayElemAt: ['$wallet.totalSpentCoins', 0] }, 0] },
            coinBalance: { $ifNull: [{ $arrayElemAt: ['$wallet.balanceCoins', 0] }, 0] },
          },
        },
      ]),
      User.countDocuments(filter),
    ]);

    res.json(successResponse(users, { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }));
  } catch (error) {
    console.error('getUserActivityList error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await PlatformSetting.find();
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json(successResponse(settingsMap));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body as Record<string, unknown>;
    const ops = Object.entries(updates).map(([key, value]) =>
      PlatformSetting.updateOne({ key }, { $set: { value, updatedBy: req.adminId } }, { upsert: true })
    );
    await Promise.all(ops);
    res.json(successResponse({ message: 'Settings updated' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
