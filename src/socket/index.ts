import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import redis from '../config/redis';
import { REDIS_KEYS } from '../utils/constants';
import { registerPresenceHandlers } from './presenceSocket';
import { registerChatHandlers } from './chatSocket';
import { registerGiftHandlers } from './giftSocket';
import { registerQueueHandlers } from './queueSocket';
import { registerDmHandlers } from './dmSocket';
import { aiChatService } from '../services/aiChatService';
import mongoose from 'mongoose';

interface AuthenticatedSocket extends Socket {
  userId?: mongoose.Types.ObjectId;
  userType?: 'caller' | 'host';
}

let io: Server;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // JWT Auth middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, ENV.SECRET_KEY) as { userId: string; userType: 'caller' | 'host' };
      socket.userId = new mongoose.Types.ObjectId(decoded.userId);
      socket.userType = decoded.userType;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!.toString();
    console.log(`✅ Socket connected: ${userId} (${socket.userType})`);

    // Join personal room
    socket.join(`user:${userId}`);

    // Track socket ID in Redis
    redis.set(REDIS_KEYS.userSocket(userId), socket.id, 'EX', 3600);

    // Register all event handlers
    registerPresenceHandlers(io, socket as AuthenticatedSocket & Required<Pick<AuthenticatedSocket, 'userId' | 'userType'>>);
    registerChatHandlers(io, socket as AuthenticatedSocket & Required<Pick<AuthenticatedSocket, 'userId' | 'userType'>>);
    registerGiftHandlers(io, socket as AuthenticatedSocket & Required<Pick<AuthenticatedSocket, 'userId' | 'userType'>>);
    registerQueueHandlers(io, socket as AuthenticatedSocket & Required<Pick<AuthenticatedSocket, 'userId' | 'userType'>>);
    registerDmHandlers(io, socket as AuthenticatedSocket & Required<Pick<AuthenticatedSocket, 'userId' | 'userType'>>);

    // Trigger AI auto-messages for callers
    if (socket.userType === 'caller') {
      aiChatService.generateAutoMessages(userId).then(newConversations => {
        newConversations.forEach(convo => {
          socket.emit('dm:new-conversation', convo);
        });
      }).catch(err => console.error('AI auto-message error:', err));
    }

    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${userId}`);
      await redis.del(REDIS_KEYS.userSocket(userId));

      if (socket.userType === 'host') {
        await redis.del(REDIS_KEYS.hostOnline(userId));
        const { HostProfile } = await import('../models/hostProfile.model');
        await HostProfile.updateOne({ userId: socket.userId }, { $set: { isOnline: false, isBusy: false } });
        io.emit('host:status-changed', { hostId: userId, isOnline: false });
      }
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};
