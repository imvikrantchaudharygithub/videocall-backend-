import { Server, Socket } from 'socket.io';
import { ChatMessage } from '../models/chatMessage.model';
import { filterPhoneNumbers } from '../utils/phoneFilter';
import mongoose from 'mongoose';

type AuthSocket = Socket & { userId: mongoose.Types.ObjectId; userType: 'caller' | 'host' };

export const registerChatHandlers = (io: Server, socket: AuthSocket): void => {
  socket.on('chat:send', async ({ callId, message }: { callId: string; message: string }) => {
    try {
      const { filtered, wasFiltered } = filterPhoneNumbers(message);

      await ChatMessage.create({
        callId: new mongoose.Types.ObjectId(callId),
        senderId: socket.userId,
        message: filtered,
        isFiltered: wasFiltered,
      });

      // Broadcast to the other person in the call
      io.to(`call:${callId}`).except(socket.id).emit('chat:message', {
        callId,
        senderId: socket.userId.toString(),
        message: filtered,
        timestamp: new Date().toISOString(),
      });

      if (wasFiltered) {
        socket.emit('chat:filtered', { callId, original: message, filtered });
      } else {
        socket.emit('chat:message', {
          callId,
          senderId: socket.userId.toString(),
          message: filtered,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('chat:send error:', error);
    }
  });
};
