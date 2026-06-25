import mongoose from 'mongoose';
import { Conversation } from '../models/conversation.model';
import { DirectMessage } from '../models/directMessage.model';
import { HostProfile } from '../models/hostProfile.model';
import { getRandomAIMessage } from '../utils/aiMessageTemplates';
import { conversationService } from './conversationService';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const MAX_AI_PER_LOGIN = 5;
const MAX_UNREAD_CONVERSATIONS = 10;

export const aiChatService = {
  async generateAutoMessages(callerId: string): Promise<any[]> {
    const callerOid = new mongoose.Types.ObjectId(callerId);

    // Rate limit: check if caller has too many unread conversations
    const unreadCount = await conversationService.getTotalUnread(callerId, 'caller');
    if (unreadCount >= MAX_UNREAD_CONVERSATIONS) return [];

    // Get existing conversation host IDs for this caller (with recent AI messages)
    const recentCutoff = new Date(Date.now() - SIX_HOURS_MS);
    const recentConvos = await Conversation.find({
      callerId: callerOid,
      isAIActive: true,
      lastMessageBy: 'ai',
      lastMessageAt: { $gte: recentCutoff },
    }).select('hostId').lean();
    const recentHostIds = recentConvos.map(c => c.hostId.toString());

    // Also exclude conversations where host already took over
    const takenOverConvos = await Conversation.find({
      callerId: callerOid,
      isAIActive: false,
    }).select('hostId').lean();
    const takenOverHostIds = takenOverConvos.map(c => c.hostId.toString());

    const excludeHostIds = [...new Set([...recentHostIds, ...takenOverHostIds])];

    // Find random online hosts not already in conversation
    const onlineHosts = await HostProfile.aggregate([
      {
        $match: {
          isOnline: true,
          isApproved: true,
          approvalStatus: 'approved',
          userId: { $nin: excludeHostIds.map(id => new mongoose.Types.ObjectId(id)) },
        },
      },
      { $sample: { size: MAX_AI_PER_LOGIN } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: 1,
          avatarUrl: 1,
          currentTier: 1,
          isOnline: 1,
          displayName: '$user.displayName',
        },
      },
    ]);

    if (onlineHosts.length === 0) return [];

    const newConversations: any[] = [];

    for (const host of onlineHosts) {
      try {
        // Create or find conversation
        const conversation = await conversationService.findOrCreate(callerId, host.userId.toString());

        // Skip if conversation already has recent activity
        if (conversation.lastMessageAt && conversation.lastMessageAt > recentCutoff) continue;

        // Generate AI message
        const message = getRandomAIMessage();

        // Send as AI message (appears to come from host)
        const dm = await conversationService.sendMessage(
          conversation._id.toString(),
          host.userId.toString(),
          'ai',
          message,
          true // isAI
        );

        // Reset callerDeleted if it was soft-deleted
        if (conversation.callerDeleted) {
          await Conversation.updateOne({ _id: conversation._id }, { $set: { callerDeleted: false } });
        }

        newConversations.push({
          conversation: {
            ...conversation.toObject(),
            lastMessage: message,
            lastMessageAt: dm.createdAt,
            lastMessageBy: 'ai',
            callerUnread: (conversation.callerUnread || 0) + 1,
            isAIActive: true,
            callerDeleted: false,
          },
          hostProfile: {
            avatarUrl: host.avatarUrl,
            isOnline: host.isOnline,
            currentTier: host.currentTier,
          },
          hostName: host.displayName,
          message: dm,
        });
      } catch (err) {
        console.error(`AI message failed for host ${host.userId}:`, err);
      }
    }

    return newConversations;
  },
};
