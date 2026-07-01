import { Server, Socket } from 'socket.io';
import { Gift } from '../models/gift.model';
import { Call } from '../models/call.model';
import { HostEarnings } from '../models/hostEarnings.model';
import { EarningsTransaction } from '../models/earningsTransaction.model';
import { deductCoins } from '../services/walletService';
import { User } from '../models/user.model';
import mongoose from 'mongoose';

type AuthSocket = Socket & { userId: mongoose.Types.ObjectId; userType: 'caller' | 'host' };

export const registerGiftHandlers = (io: Server, socket: AuthSocket): void => {
  socket.on('gift:send', async ({ callId, giftId }: { callId: string; giftId: string }) => {
    try {
      const gift = await Gift.findOne({ _id: giftId, isActive: true });
      if (!gift) {
        socket.emit('gift:error', { error: 'Gift not found' });
        return;
      }

      // Validate against the real call: sender must be the caller on an active call,
      // and the host is derived from the call (never trusted from the client).
      const call = await Call.findById(callId);
      if (!call || call.status !== 'active' || call.callerId.toString() !== socket.userId.toString()) {
        socket.emit('gift:error', { error: 'INVALID_CALL' });
        return;
      }
      const hostId = call.hostId.toString();

      const result = await deductCoins(
        socket.userId,
        gift.costCoins,
        'gift_sent',
        `Gift: ${gift.name}`,
        new mongoose.Types.ObjectId(callId)
      );

      if (!result.success) {
        socket.emit('gift:error', { error: 'INSUFFICIENT_BALANCE' });
        return;
      }

      const hostEarnings = Math.floor(gift.costCoins * gift.hostSharePercent / 100);
      await HostEarnings.updateOne(
        { userId: new mongoose.Types.ObjectId(hostId) },
        { $inc: { balanceCoins: hostEarnings, totalEarnedCoins: hostEarnings } }
      );

      await EarningsTransaction.create({
        hostId: new mongoose.Types.ObjectId(hostId),
        type: 'gift_earning',
        amountCoins: hostEarnings,
        callId: new mongoose.Types.ObjectId(callId),
        description: `Gift: ${gift.name}`,
      });

      await Call.updateOne(
        { _id: callId },
        { $push: { giftsSent: { giftId: gift._id, giftName: gift.name, costCoins: gift.costCoins, hostEarnings, sentAt: new Date() } } }
      );

      const sender = await User.findById(socket.userId).select('displayName');

      socket.emit('gift:sent', {
        giftId: gift._id.toString(),
        coinsDeducted: gift.costCoins,
        newBalance: result.newBalance,
      });

      io.to(`user:${hostId}`).emit('gift:received', {
        giftId: gift._id.toString(),
        giftName: gift.name,
        animationKey: gift.animationKey,
        coinsEarned: hostEarnings,
        senderName: sender?.displayName ?? 'Someone',
      });
    } catch (error) {
      console.error('gift:send error:', error);
      socket.emit('gift:error', { error: 'Failed to send gift' });
    }
  });
};
