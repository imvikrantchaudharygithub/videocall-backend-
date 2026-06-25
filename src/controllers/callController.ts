import { Request, Response } from 'express';
import { Call, ICall } from '../models/call.model';
import { HostProfile } from '../models/hostProfile.model';
import { CallerWallet } from '../models/callerWallet.model';
import { WalletTransaction } from '../models/walletTransaction.model';
import { HostEarnings } from '../models/hostEarnings.model';
import { EarningsTransaction } from '../models/earningsTransaction.model';
import { User } from '../models/user.model';
import { initiateCall, generateAgoraToken } from '../services/callService';
import { sendCallIncomingNotification } from '../services/notificationService';
import { updateWeeklyMinutes } from '../services/tierService';
import { getIO } from '../socket';
import redis from '../config/redis';
import { REDIS_KEYS, MIN_CALL_BILLING_SECONDS, CALL_RING_TIMEOUT_SECONDS, HOST_SHARE_PERCENT } from '../utils/constants';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

export const initiateCallHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hostId, callType } = req.body;
    if (!hostId || !callType) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'hostId and callType are required'));
      return;
    }

    const result = await initiateCall(
      req.userId!,
      new mongoose.Types.ObjectId(hostId),
      callType
    );

    if ('error' in result) {
      const statusMap: Record<string, number> = {
        HOST_OFFLINE: 400,
        INSUFFICIENT_BALANCE: 402,
        ALREADY_IN_CALL: 400,
      };
      res.status(statusMap[result.error] || 400).json(errorResponse(result.error, result.error));
      return;
    }

    const callerId = req.userId!.toString();
    const caller = await User.findById(req.userId).select('displayName');
    const callerName = caller?.displayName ?? 'Someone';

    try {
      getIO().to(`user:${hostId}`).emit('call:incoming', {
        callId: result.callId,
        callerId,
        callerName,
        callType,
      });
    } catch (err) {
      console.error('call:incoming emit failed:', err);
    }

    sendCallIncomingNotification(
      new mongoose.Types.ObjectId(hostId),
      callerName,
      result.callId,
      callType
    ).catch(err => console.error('FCM call notification failed:', err));

    // Ring timeout — mark missed if host never answers
    setTimeout(async () => {
      try {
        const call = await Call.findById(result.callId);
        if (call && call.status === 'ringing') {
          call.status = 'missed';
          call.endedAt = new Date();
          await call.save();
          const io = getIO();
          io.to(`user:${hostId}`).emit('call:cancelled', { callId: result.callId });
          io.to(`user:${callerId}`).emit('call:no-answer', { callId: result.callId });
          io.to(`user:${callerId}`).emit('call:ended', { callId: result.callId, endReason: 'missed' });
        }
      } catch (err) {
        console.error('ring timeout error:', err);
      }
    }, CALL_RING_TIMEOUT_SECONDS * 1000);

    res.json(successResponse({
      callId: result.callId,
      agoraToken: result.agoraToken,
      channelName: result.agoraChannelName,
      agoraChannelName: result.agoraChannelName,
      ratePerMinute: result.ratePerMinute,
      ratePerMin: result.ratePerMinute,
    }));
  } catch (error) {
    console.error('initiateCall error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const acceptCall = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const call = await Call.findById(id);
    if (!call || call.status !== 'ringing') {
      res.status(400).json(errorResponse('CALL_NOT_FOUND', 'Call not found or not ringing'));
      return;
    }
    if (call.hostId.toString() !== req.userId!.toString()) {
      res.status(403).json(errorResponse('FORBIDDEN', 'Not the host of this call'));
      return;
    }

    call.status = 'active';
    call.answeredAt = new Date();
    await call.save();

    await HostProfile.updateOne({ userId: req.userId }, { $set: { isBusy: true } });
    await redis.set(REDIS_KEYS.hostBusy(req.userId!.toString()), '1');

    const agoraToken = generateAgoraToken(call.agoraChannel, 0);

    try {
      getIO().to(`user:${call.callerId.toString()}`).emit('call:connected', {
        callId: id,
        agoraChannel: call.agoraChannel,
        startedAt: call.answeredAt.toISOString(),
      });
    } catch (err) {
      console.error('call:connected emit failed:', err);
    }

    res.json(successResponse({
      callId: id,
      status: 'active',
      agoraToken,
      channelName: call.agoraChannel,
    }));
  } catch (error) {
    console.error('acceptCall error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const declineCall = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const call = await Call.findOneAndUpdate(
      { _id: id, status: 'ringing' },
      { $set: { status: 'declined', endedAt: new Date() } },
      { new: true }
    );
    if (call) {
      try {
        const io = getIO();
        const callerRoom = `user:${call.callerId.toString()}`;
        io.to(callerRoom).emit('call:declined', { callId: id });
        io.to(callerRoom).emit('call:ended', { callId: id, endReason: 'declined' });
      } catch (err) {
        console.error('call:declined emit failed:', err);
      }
    }
    res.json(successResponse({ message: 'Call declined' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// Periodic billing tick from the caller app (every 5s during an active call)
export const billingTick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const call = await Call.findById(id);
    if (!call || call.status !== 'active') {
      res.status(400).json(errorResponse('CALL_NOT_ACTIVE', 'Call is not active'));
      return;
    }
    if (call.callerId.toString() !== req.userId!.toString()) {
      res.status(403).json(errorResponse('FORBIDDEN', 'Not the caller of this call'));
      return;
    }

    const coinsPerTick = Math.ceil(call.ratePerSecond * 5);
    const wallet = await CallerWallet.findOne({ userId: call.callerId });

    if (!wallet || wallet.balanceCoins < coinsPerTick) {
      await endActiveCall(call, 'insufficient_credits');
      res.json(successResponse({ remainingCoins: wallet?.balanceCoins ?? 0, callEnded: true }));
      return;
    }

    wallet.balanceCoins -= coinsPerTick;
    wallet.totalSpentCoins += coinsPerTick;
    await wallet.save();

    call.totalCostCoins += coinsPerTick;
    await call.save();

    res.json(successResponse({ remainingCoins: wallet.balanceCoins }));
  } catch (error) {
    console.error('billingTick error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const endCall = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const call = await Call.findById(id);
    if (!call || call.status !== 'active') {
      res.status(400).json(errorResponse('CALL_NOT_ACTIVE', 'Call is not active'));
      return;
    }

    const requesterId = req.userId!.toString();
    if (requesterId !== call.callerId.toString() && requesterId !== call.hostId.toString()) {
      res.status(403).json(errorResponse('FORBIDDEN', 'Not a participant of this call'));
      return;
    }

    const endReason = requesterId === call.callerId.toString() ? 'caller_ended' : 'host_ended';
    const summary = await endActiveCall(call, endReason);

    res.json(successResponse({
      callId: id,
      durationSeconds: summary.duration,
      totalCostCoins: summary.coinsDeducted,
      hostEarningsCoins: summary.hostEarnings,
    }));
  } catch (error) {
    console.error('endCall error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// Settles billing (3-min minimum, minus coins already taken by ticks), credits
// the host, frees them up, and notifies both parties.
const endActiveCall = async (
  call: ICall,
  endReason: 'caller_ended' | 'host_ended' | 'insufficient_credits'
): Promise<{ callId: string; duration: number; coinsDeducted: number; hostEarnings: number; endReason: string }> => {
  const endedAt = new Date();
  const durationSeconds = Math.floor((endedAt.getTime() - (call.answeredAt?.getTime() ?? endedAt.getTime())) / 1000);
  const billedSeconds = Math.max(durationSeconds, MIN_CALL_BILLING_SECONDS);
  const alreadyBilledCoins = call.totalCostCoins;
  const totalCostCoins = Math.max(Math.ceil((billedSeconds / 60) * call.ratePerMinute), alreadyBilledCoins);
  const hostEarningsCoins = Math.floor(totalCostCoins * (HOST_SHARE_PERCENT / 100));

  call.status = 'ended';
  call.endedAt = endedAt;
  call.durationSeconds = durationSeconds;
  call.totalCostCoins = totalCostCoins;
  call.hostEarningsCoins = hostEarningsCoins;
  call.platformEarningsCoins = totalCostCoins - hostEarningsCoins;
  call.endReason = endReason;
  await call.save();

  const remainingCharge = totalCostCoins - alreadyBilledCoins;
  let chargedNow = 0;
  const wallet = await CallerWallet.findOne({ userId: call.callerId });
  if (wallet && remainingCharge > 0) {
    chargedNow = Math.min(remainingCharge, wallet.balanceCoins);
    wallet.balanceCoins -= chargedNow;
    wallet.totalSpentCoins += chargedNow;
    await wallet.save();
  }

  // One transaction per call covering tick deductions + final settlement charge
  const totalCharged = alreadyBilledCoins + chargedNow;
  if (wallet && totalCharged > 0) {
    await WalletTransaction.create({
      userId: call.callerId,
      type: 'call_deduction',
      amountCoins: -totalCharged,
      balanceBefore: wallet.balanceCoins + totalCharged,
      balanceAfter: wallet.balanceCoins,
      callId: call._id,
      description: `${call.callType === 'video' ? 'Video' : 'Voice'} call — ${Math.max(Math.ceil(billedSeconds / 60), 1)} min`,
    });
  }

  await HostProfile.updateOne({ userId: call.hostId }, { $set: { isBusy: false } });
  await redis.del(REDIS_KEYS.hostBusy(call.hostId.toString()));

  await HostEarnings.updateOne(
    { userId: call.hostId },
    { $inc: { balanceCoins: hostEarningsCoins, totalEarnedCoins: hostEarningsCoins } },
    { upsert: true }
  );

  await EarningsTransaction.create({
    hostId: call.hostId,
    type: 'call_earning',
    amountCoins: hostEarningsCoins,
    callId: call._id,
    description: `Call earnings — ${Math.round(durationSeconds / 60)} min`,
  });

  try {
    await updateWeeklyMinutes(call.hostId, Math.round(durationSeconds / 60));
  } catch (err) {
    console.error('updateWeeklyMinutes failed:', err);
  }

  const summary = {
    callId: (call._id as mongoose.Types.ObjectId).toString(),
    duration: durationSeconds,
    coinsDeducted: totalCostCoins,
    hostEarnings: hostEarningsCoins,
    endReason,
  };

  try {
    const io = getIO();
    io.to(`user:${call.callerId.toString()}`).emit('call:ended', summary);
    io.to(`user:${call.hostId.toString()}`).emit('call:ended', summary);
  } catch (err) {
    console.error('call:ended emit failed:', err);
  }

  return summary;
};

export const switchCallType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newType } = req.body;
    await Call.updateOne({ _id: id, status: 'active' }, { $set: { callType: newType } });
    res.json(successResponse({ callId: id, callType: newType }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getCallHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {
      $or: [{ callerId: req.userId }, { hostId: req.userId }],
      status: { $in: ['ended', 'declined', 'missed'] },
    };

    const [calls, total] = await Promise.all([
      Call.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('callerId', 'displayName')
        .populate('hostId', 'displayName'),
      Call.countDocuments(filter),
    ]);

    res.json(successResponse(calls, {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getActiveCall = async (req: Request, res: Response): Promise<void> => {
  try {
    const call = await Call.findOne({
      $or: [{ callerId: req.userId }, { hostId: req.userId }],
      status: 'active',
    });
    res.json(successResponse(call));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getCallById = async (req: Request, res: Response): Promise<void> => {
  try {
    const call = await Call.findById(req.params.id)
      .populate('callerId', 'displayName')
      .populate('hostId', 'displayName');
    if (!call) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Call not found'));
      return;
    }
    res.json(successResponse(call));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
