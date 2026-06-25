import { Server, Socket } from 'socket.io';
import { Call } from '../models/call.model';
import { HostProfile } from '../models/hostProfile.model';
import { CallerWallet } from '../models/callerWallet.model';
import { HostEarnings } from '../models/hostEarnings.model';
import { EarningsTransaction } from '../models/earningsTransaction.model';
import { deductCoins } from '../services/walletService';
import { generateAgoraToken, startBillingSession, endBillingSession } from '../services/callService';
import { sendCallIncomingNotification } from '../services/notificationService';
import { updateWeeklyMinutes } from '../services/tierService';
import { REDIS_KEYS, MIN_CALL_BILLING_SECONDS, BILLING_TICK_INTERVAL_MS } from '../utils/constants';
import redis from '../config/redis';
import { User } from '../models/user.model';
import mongoose from 'mongoose';

type AuthSocket = Socket & { userId: mongoose.Types.ObjectId; userType: 'caller' | 'host' };

const billingIntervals = new Map<string, NodeJS.Timeout>();

export const registerCallHandlers = (io: Server, socket: AuthSocket): void => {
  const userId = socket.userId.toString();

  socket.on('call:initiate', async ({ hostId, callType }: { hostId: string; callType: 'video' | 'voice' }) => {
    try {
      const { initiateCall } = await import('../services/callService');
      const result = await initiateCall(
        socket.userId,
        new mongoose.Types.ObjectId(hostId),
        callType
      );

      if ('error' in result) {
        socket.emit('call:error', { error: result.error });
        return;
      }

      socket.emit('call:initiated', {
        callId: result.callId,
        agoraChannel: result.agoraChannelName,
        agoraToken: result.agoraToken,
      });

      const caller = await User.findById(socket.userId).select('displayName');
      io.to(`user:${hostId}`).emit('call:incoming', {
        callId: result.callId,
        callerId: userId,
        callerName: caller?.displayName,
        caller: { name: caller?.displayName, id: userId },
        callType,
      });

      await sendCallIncomingNotification(
        new mongoose.Types.ObjectId(hostId),
        caller?.displayName ?? 'Someone',
        result.callId,
        callType
      );

      // 30-second timeout for no answer
      setTimeout(async () => {
        const call = await Call.findById(result.callId);
        if (call && call.status === 'ringing') {
          call.status = 'missed';
          call.endedAt = new Date();
          await call.save();
          socket.emit('call:no-answer', { callId: result.callId });
        }
      }, 30000);
    } catch (error) {
      console.error('call:initiate error:', error);
      socket.emit('call:error', { error: 'INITIATE_FAILED' });
    }
  });

  socket.on('call:accept', async ({ callId }: { callId: string }) => {
    try {
      const call = await Call.findById(callId);
      if (!call || call.status !== 'ringing') return;

      call.status = 'active';
      call.answeredAt = new Date();
      await call.save();

      await HostProfile.updateOne({ userId: socket.userId }, { $set: { isBusy: true } });
      await redis.set(REDIS_KEYS.hostBusy(userId), '1');

      // uid 0 = wildcard token; the host app joins with its own locally generated uid
      const hostToken = generateAgoraToken(call.agoraChannel, 0);

      const callData = {
        callId,
        agoraChannel: call.agoraChannel,
        agoraToken: hostToken,
        startedAt: call.answeredAt.toISOString(),
      };

      // Join both to call room
      socket.join(`call:${callId}`);
      io.to(`user:${call.callerId.toString()}`).emit('call:connected', callData);
      socket.emit('call:connected', callData);

      // Start billing session
      await startBillingSession(callId, call.callerId.toString(), userId, call.ratePerSecond);

      // Billing tick every 5 seconds
      let tickSeconds = 0;
      const interval = setInterval(async () => {
        tickSeconds += 5;
        const coinsPerTick = Math.ceil(call.ratePerSecond * 5);

        const wallet = await CallerWallet.findOne({ userId: call.callerId });
        if (!wallet || wallet.balanceCoins < coinsPerTick) {
          clearInterval(interval);
          billingIntervals.delete(callId);
          io.to(`call:${callId}`).emit('billing:auto-end', {
            callId,
            reason: 'insufficient_balance',
          });
          await finalizeCall(callId, call.callerId, call.hostId, io);
          return;
        }

        wallet.balanceCoins -= coinsPerTick;
        wallet.totalSpentCoins += coinsPerTick;
        await wallet.save();

        const hostEarningsTick = Math.floor(coinsPerTick * 0.30);

        io.to(`user:${call.callerId.toString()}`).emit('billing:tick', {
          callId,
          coinsDeducted: coinsPerTick,
          balance: wallet.balanceCoins,
          elapsed: tickSeconds,
        });

        io.to(`user:${userId}`).emit('billing:earnings-tick', {
          callId,
          earned: hostEarningsTick,
          totalEarned: hostEarningsTick,
        });

        if (wallet.balanceCoins < call.ratePerSecond * 60) {
          io.to(`user:${call.callerId.toString()}`).emit('billing:low-balance', {
            callId,
            balance: wallet.balanceCoins,
            secondsRemaining: Math.floor(wallet.balanceCoins / call.ratePerSecond),
          });
        }
      }, BILLING_TICK_INTERVAL_MS);

      billingIntervals.set(callId, interval);
    } catch (error) {
      console.error('call:accept error:', error);
    }
  });

  socket.on('call:decline', async ({ callId }: { callId: string }) => {
    try {
      await Call.updateOne({ _id: callId, status: 'ringing' }, { $set: { status: 'declined', endedAt: new Date() } });
      const call = await Call.findById(callId);
      if (call) {
        io.to(`user:${call.callerId.toString()}`).emit('call:declined', { callId });
      }
    } catch (error) {
      console.error('call:decline error:', error);
    }
  });

  socket.on('call:end', async ({ callId }: { callId: string }) => {
    try {
      const interval = billingIntervals.get(callId);
      if (interval) {
        clearInterval(interval);
        billingIntervals.delete(callId);
      }

      const call = await Call.findById(callId);
      if (!call || call.status !== 'active') return;

      const endedAt = new Date();
      const durationSeconds = Math.floor((endedAt.getTime() - (call.answeredAt?.getTime() ?? endedAt.getTime())) / 1000);
      const billedSeconds = Math.max(durationSeconds, MIN_CALL_BILLING_SECONDS);
      const totalCostCoins = Math.ceil((billedSeconds / 60) * call.ratePerMinute);
      const hostEarningsCoins = Math.floor(totalCostCoins * 0.30);
      const platformEarningsCoins = totalCostCoins - hostEarningsCoins;

      call.status = 'ended';
      call.endedAt = endedAt;
      call.durationSeconds = durationSeconds;
      call.totalCostCoins = totalCostCoins;
      call.hostEarningsCoins = hostEarningsCoins;
      call.platformEarningsCoins = platformEarningsCoins;
      call.endReason = userId === call.callerId.toString() ? 'caller_ended' : 'host_ended';
      await call.save();

      await HostProfile.updateOne({ userId: call.hostId }, { $set: { isBusy: false } });
      await redis.del(REDIS_KEYS.hostBusy(call.hostId.toString()));
      await endBillingSession(callId);

      await HostEarnings.updateOne(
        { userId: call.hostId },
        { $inc: { balanceCoins: hostEarningsCoins, totalEarnedCoins: hostEarningsCoins } }
      );

      await EarningsTransaction.create({
        hostId: call.hostId,
        type: 'call_earning',
        amountCoins: hostEarningsCoins,
        callId: call._id,
        description: `Call earnings — ${Math.round(durationSeconds / 60)} min`,
      });

      await updateWeeklyMinutes(call.hostId, Math.round(durationSeconds / 60));

      const summary = { callId, duration: durationSeconds, coinsDeducted: totalCostCoins, hostEarnings: hostEarningsCoins, endReason: call.endReason };
      io.to(`call:${callId}`).emit('call:ended', summary);
    } catch (error) {
      console.error('call:end error:', error);
    }
  });

  socket.on('call:switch-type', async ({ callId, newType }: { callId: string; newType: 'video' | 'voice' }) => {
    try {
      await Call.updateOne({ _id: callId, status: 'active' }, { $set: { callType: newType } });
      io.to(`call:${callId}`).emit('call:type-switched', { callId, callType: newType });
    } catch (error) {
      console.error('call:switch-type error:', error);
    }
  });
};

const finalizeCall = async (
  callId: string,
  callerId: mongoose.Types.ObjectId,
  hostId: mongoose.Types.ObjectId,
  io: Server
): Promise<void> => {
  const call = await Call.findById(callId);
  if (!call || call.status !== 'active') return;

  const endedAt = new Date();
  const durationSeconds = Math.max(
    Math.floor((endedAt.getTime() - (call.answeredAt?.getTime() ?? endedAt.getTime())) / 1000),
    MIN_CALL_BILLING_SECONDS
  );
  const totalCostCoins = Math.ceil((durationSeconds / 60) * call.ratePerMinute);
  const hostEarningsCoins = Math.floor(totalCostCoins * 0.30);

  call.status = 'ended';
  call.endedAt = endedAt;
  call.durationSeconds = durationSeconds;
  call.totalCostCoins = totalCostCoins;
  call.hostEarningsCoins = hostEarningsCoins;
  call.platformEarningsCoins = totalCostCoins - hostEarningsCoins;
  call.endReason = 'insufficient_credits';
  await call.save();

  await HostProfile.updateOne({ userId: hostId }, { $set: { isBusy: false } });
  await HostEarnings.updateOne(
    { userId: hostId },
    { $inc: { balanceCoins: hostEarningsCoins, totalEarnedCoins: hostEarningsCoins } }
  );
  await endBillingSession(callId);

  void callerId;
  void io;
};
