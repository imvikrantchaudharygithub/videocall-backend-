import { Server, Socket } from 'socket.io';
import redis from '../config/redis';
import { HostProfile } from '../models/hostProfile.model';
import { CallerProfile } from '../models/callerProfile.model';
import { createNotification } from '../services/notificationService';
import { REDIS_KEYS } from '../utils/constants';
import mongoose from 'mongoose';

type AuthSocket = Socket & { userId: mongoose.Types.ObjectId; userType: 'caller' | 'host' };

export const registerPresenceHandlers = (io: Server, socket: AuthSocket): void => {
  const userId = socket.userId.toString();

  socket.on('host:go-online', async () => {
    if (socket.userType !== 'host') return;
    try {
      await redis.set(REDIS_KEYS.hostOnline(userId), '1', 'EX', 90);
      await HostProfile.updateOne({ userId: socket.userId }, { $set: { isOnline: true } });
      socket.join('hosts:online');

      socket.emit('host:online-confirmed', { onlineAt: new Date().toISOString() });
      io.emit('host:status-changed', { hostId: userId, isOnline: true });

      // Notify callers who favourited this host
      const profile = await HostProfile.findOne({ userId: socket.userId });
      if (profile) {
        const { CallerProfile: CP } = await import('../models/callerProfile.model');
        const callers = await CP.find({ favouriteHosts: socket.userId }).select('userId');
        for (const caller of callers) {
          await createNotification(
            caller.userId,
            '⭐ Favourite Host Online',
            `Your favourite host is now online!`,
            'favourite_online',
            { hostId: userId }
          );
        }
      }
    } catch (error) {
      console.error('host:go-online error:', error);
    }
  });

  socket.on('host:go-offline', async () => {
    if (socket.userType !== 'host') return;
    try {
      await redis.del(REDIS_KEYS.hostOnline(userId));
      await HostProfile.updateOne({ userId: socket.userId }, { $set: { isOnline: false } });
      socket.leave('hosts:online');

      socket.emit('host:offline-confirmed', {});
      io.emit('host:status-changed', { hostId: userId, isOnline: false });
    } catch (error) {
      console.error('host:go-offline error:', error);
    }
  });

  socket.on('heartbeat', async () => {
    // Refresh TTL for host online status
    if (socket.userType === 'host') {
      await redis.expire(REDIS_KEYS.hostOnline(userId), 90);
    }
    socket.emit('heartbeat:ack', {});
  });

  void CallerProfile; // suppress unused import
};
