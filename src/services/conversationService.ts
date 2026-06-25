import mongoose from 'mongoose';
import { Conversation, IConversation } from '../models/conversation.model';
import { DirectMessage, IDirectMessage } from '../models/directMessage.model';
import { filterSensitiveContent } from '../utils/phoneFilter';

export const conversationService = {
  // Find or create a conversation between caller and host
  async findOrCreate(callerId: string, hostId: string): Promise<IConversation> {
    let conversation = await Conversation.findOne({
      callerId: new mongoose.Types.ObjectId(callerId),
      hostId: new mongoose.Types.ObjectId(hostId),
    });
    if (!conversation) {
      conversation = await Conversation.create({
        callerId: new mongoose.Types.ObjectId(callerId),
        hostId: new mongoose.Types.ObjectId(hostId),
        isAIActive: true,
      });
    }
    return conversation;
  },

  // Get conversations for a user (caller or host view)
  async getConversations(userId: string, userType: 'caller' | 'host', page = 1, limit = 20) {
    const query: any = userType === 'caller'
      ? { callerId: new mongoose.Types.ObjectId(userId), callerDeleted: { $ne: true } }
      : { hostId: new mongoose.Types.ObjectId(userId) };

    // For hosts: only show conversations with at least one real user message
    if (userType === 'host') {
      const convoIdsWithRealMessages = await DirectMessage.distinct('conversationId', {
        senderType: 'caller',
        isAI: false,
      });
      query._id = { $in: convoIdsWithRealMessages };
    }

    const total = await Conversation.countDocuments(query);
    const conversations = await Conversation.find(query)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(userType === 'caller' ? 'hostId' : 'callerId', 'displayName')
      .lean();

    // Populate host profile data (avatar, online status, tier) for caller view
    if (userType === 'caller') {
      const { HostProfile } = await import('../models/hostProfile.model');
      const hostIds = conversations.map((c: any) => c.hostId._id || c.hostId);
      const profiles = await HostProfile.find({ userId: { $in: hostIds } })
        .select('userId avatarUrl isOnline isBusy currentTier')
        .lean();
      const profileMap = new Map(profiles.map(p => [p.userId.toString(), p]));
      conversations.forEach((c: any) => {
        const hId = (c.hostId._id || c.hostId).toString();
        c.hostProfile = profileMap.get(hId) || null;
      });
    }

    return { conversations, total, page, limit };
  },

  // Get messages for a conversation
  async getMessages(conversationId: string, userType: 'caller' | 'host', page = 1, limit = 30) {
    const query: any = { conversationId: new mongoose.Types.ObjectId(conversationId) };

    // Hosts don't see AI messages
    if (userType === 'host') {
      query.isAI = { $ne: true };
    }

    const total = await DirectMessage.countDocuments(query);
    const messages = await DirectMessage.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { messages: messages.reverse(), total, page, limit };
  },

  // Send a direct message
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderType: 'caller' | 'host' | 'ai',
    message: string,
    isAI = false
  ): Promise<IDirectMessage> {
    const { filtered, wasFiltered } = filterSensitiveContent(message);

    const dm = await DirectMessage.create({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      senderId: new mongoose.Types.ObjectId(senderId),
      senderType,
      message: filtered,
      isAI,
      isFiltered: wasFiltered,
    });

    // Update conversation metadata
    const updateFields: any = {
      lastMessage: filtered,
      lastMessageAt: new Date(),
      lastMessageBy: senderType,
    };

    if (senderType === 'caller' || senderType === 'ai') {
      updateFields.$inc = { hostUnread: isAI ? 0 : 1, callerUnread: isAI ? 1 : 0 };
    } else if (senderType === 'host') {
      updateFields.$inc = { callerUnread: 1 };
      updateFields.isAIActive = false; // Host took over
    }

    const incFields = updateFields.$inc;
    delete updateFields.$inc;
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: updateFields, ...(incFields ? { $inc: incFields } : {}) }
    );

    return dm;
  },

  // Mark conversation as read
  async markRead(conversationId: string, userType: 'caller' | 'host') {
    const update = userType === 'caller'
      ? { callerUnread: 0 }
      : { hostUnread: 0 };
    await Conversation.updateOne({ _id: conversationId }, { $set: update });

    // Mark individual messages as read
    const senderFilter = userType === 'caller'
      ? { senderType: { $in: ['host', 'ai'] } }
      : { senderType: 'caller' };
    await DirectMessage.updateMany(
      { conversationId: new mongoose.Types.ObjectId(conversationId), isRead: false, ...senderFilter },
      { $set: { isRead: true } }
    );
  },

  // Soft delete for caller
  async callerDelete(conversationId: string, callerId: string) {
    await Conversation.updateOne(
      { _id: conversationId, callerId: new mongoose.Types.ObjectId(callerId) },
      { $set: { callerDeleted: true } }
    );
  },

  // Get total unread count for a user
  async getTotalUnread(userId: string, userType: 'caller' | 'host'): Promise<number> {
    const field = userType === 'caller' ? 'callerUnread' : 'hostUnread';
    const match = userType === 'caller'
      ? { callerId: new mongoose.Types.ObjectId(userId), callerDeleted: { $ne: true } }
      : { hostId: new mongoose.Types.ObjectId(userId) };
    const result = await Conversation.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: `$${field}` } } },
    ]);
    return result[0]?.total || 0;
  },
};
