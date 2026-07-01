import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { conversationService } from '../services/conversationService';
import { Conversation } from '../models/conversation.model';

interface AuthSocket extends Socket {
  userId: mongoose.Types.ObjectId;
  userType: 'caller' | 'host';
}

export const registerDmHandlers = (io: Server, socket: AuthSocket) => {
  // Send a direct message
  socket.on('dm:send', async (data: { conversationId: string; message: string }) => {
    try {
      const { conversationId, message } = data;
      if (!conversationId || !message?.trim()) return;

      // Verify sender is participant
      const convo = await Conversation.findById(conversationId).lean();
      if (!convo) return;

      const userId = socket.userId.toString();
      const isParticipant =
        convo.callerId.toString() === userId || convo.hostId.toString() === userId;
      if (!isParticipant) return;

      const senderType = socket.userType;
      const dm = await conversationService.sendMessage(
        conversationId,
        userId,
        senderType,
        message.trim()
      );

      // Emit to other participant
      const recipientId = senderType === 'caller'
        ? convo.hostId.toString()
        : convo.callerId.toString();

      io.to(`user:${recipientId}`).emit('dm:receive', {
        conversationId,
        messageId: dm._id,
        senderId: userId,
        senderType,
        message: dm.message,
        createdAt: dm.createdAt,
      });

      // Confirm to sender
      socket.emit('dm:sent', {
        conversationId,
        messageId: dm._id,
        message: dm.message,
        isFiltered: dm.isFiltered,
        createdAt: dm.createdAt,
      });

      // Send push notification if recipient is offline
      try {
        const redis = (await import('../config/redis')).default;
        const { REDIS_KEYS } = await import('../utils/constants');
        const recipientSocket = await redis.get(REDIS_KEYS.userSocket(recipientId));
        if (!recipientSocket) {
          // Recipient offline — send push notification
          const { User } = await import('../models/user.model');
          const [sender, recipient] = await Promise.all([
            User.findById(userId).select('displayName').lean(),
            User.findById(recipientId).select('fcmToken').lean(),
          ]);
          if (recipient?.fcmToken && sender) {
            const { getMessaging } = await import('firebase-admin/messaging');
            await getMessaging().send({
              token: recipient.fcmToken,
              notification: {
                title: sender.displayName || 'New Message',
                body: dm.message.substring(0, 100),
              },
              data: {
                type: 'dm',
                conversationId,
                senderId: userId,
              },
            }).catch(() => {}); // Ignore FCM errors
          }
        }
      } catch {}
    } catch (err) {
      console.error('dm:send error:', err);
    }
  });

  // Typing indicators
  socket.on('dm:typing', async (data: { conversationId: string }) => {
    try {
      const convo = await Conversation.findById(data.conversationId).lean();
      if (!convo) return;
      const recipientId = socket.userType === 'caller'
        ? convo.hostId.toString()
        : convo.callerId.toString();
      io.to(`user:${recipientId}`).emit('dm:typing', {
        conversationId: data.conversationId,
        userId: socket.userId.toString(),
      });
    } catch {}
  });

  socket.on('dm:typing-stop', async (data: { conversationId: string }) => {
    try {
      const convo = await Conversation.findById(data.conversationId).lean();
      if (!convo) return;
      const recipientId = socket.userType === 'caller'
        ? convo.hostId.toString()
        : convo.callerId.toString();
      io.to(`user:${recipientId}`).emit('dm:typing-stop', {
        conversationId: data.conversationId,
        userId: socket.userId.toString(),
      });
    } catch {}
  });

  // Mark as read
  socket.on('dm:read', async (data: { conversationId: string }) => {
    try {
      await conversationService.markRead(data.conversationId, socket.userId.toString(), socket.userType);
      const convo = await Conversation.findById(data.conversationId).lean();
      if (!convo) return;
      const recipientId = socket.userType === 'caller'
        ? convo.hostId.toString()
        : convo.callerId.toString();
      io.to(`user:${recipientId}`).emit('dm:read', {
        conversationId: data.conversationId,
        userId: socket.userId.toString(),
      });
    } catch {}
  });
};
