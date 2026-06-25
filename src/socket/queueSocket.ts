import { Server, Socket } from 'socket.io';
import { CallQueue } from '../models/callQueue.model';
import { HostProfile } from '../models/hostProfile.model';
import { QUEUE_TIMEOUT_MINUTES, MAX_QUEUE_SIZE } from '../utils/constants';
import mongoose from 'mongoose';

type AuthSocket = Socket & { userId: mongoose.Types.ObjectId; userType: 'caller' | 'host' };

export const registerQueueHandlers = (io: Server, socket: AuthSocket): void => {
  socket.on('queue:join', async ({ hostId, callType }: { hostId: string; callType: 'video' | 'voice' }) => {
    try {
      const queueSize = await CallQueue.countDocuments({
        hostId: new mongoose.Types.ObjectId(hostId),
        status: 'waiting',
      });

      if (queueSize >= MAX_QUEUE_SIZE) {
        socket.emit('queue:expired', { hostId, reason: 'Queue is full' });
        return;
      }

      const position = queueSize + 1;
      const expiresAt = new Date(Date.now() + QUEUE_TIMEOUT_MINUTES * 60 * 1000);

      await CallQueue.create({
        hostId: new mongoose.Types.ObjectId(hostId),
        callerId: socket.userId,
        callType,
        position,
        expiresAt,
      });

      socket.emit('queue:joined', {
        hostId,
        position,
        estimatedWait: position * 5,
      });

      // Notify host of new queue size
      io.to(`user:${hostId}`).emit('queue:updated', { queueSize: position });

      // Auto-expire timeout
      setTimeout(async () => {
        const entry = await CallQueue.findOne({
          hostId: new mongoose.Types.ObjectId(hostId),
          callerId: socket.userId,
          status: 'waiting',
        });

        if (entry) {
          entry.status = 'expired';
          await entry.save();
          socket.emit('queue:expired', { hostId });
        }
      }, QUEUE_TIMEOUT_MINUTES * 60 * 1000);
    } catch (error) {
      console.error('queue:join error:', error);
    }
  });

  socket.on('queue:leave', async ({ hostId }: { hostId: string }) => {
    try {
      await CallQueue.updateOne(
        { hostId: new mongoose.Types.ObjectId(hostId), callerId: socket.userId, status: 'waiting' },
        { $set: { status: 'expired' } }
      );
      socket.emit('queue:left', { hostId });

      const newSize = await CallQueue.countDocuments({
        hostId: new mongoose.Types.ObjectId(hostId),
        status: 'waiting',
      });
      io.to(`user:${hostId}`).emit('queue:updated', { queueSize: newSize });
    } catch (error) {
      console.error('queue:leave error:', error);
    }
  });

  // When a call ends, notify next person in queue
  socket.on('call:ended-notify-queue', async ({ hostId }: { hostId: string }) => {
    try {
      const nextInQueue = await CallQueue.findOne({
        hostId: new mongoose.Types.ObjectId(hostId),
        status: 'waiting',
      }).sort({ position: 1 });

      if (nextInQueue) {
        nextInQueue.status = 'notified';
        await nextInQueue.save();

        io.to(`user:${nextInQueue.callerId.toString()}`).emit('queue:your-turn', {
          hostId,
        });
      }
    } catch (error) {
      console.error('queue:notify error:', error);
    }
  });

  void HostProfile;
};
