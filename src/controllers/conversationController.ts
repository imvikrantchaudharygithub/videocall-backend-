import { Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { Conversation } from '../models/conversation.model';

const routeParam = (value: string | string[]): string =>
  Array.isArray(value) ? value[0] : value;

export const conversationController = {
  async getConversations(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const userType = (req as any).userType;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await conversationService.getConversations(userId, userType, page, limit);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getMessages(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const userType = (req as any).userType;
      const id = routeParam(req.params.id);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const result = await conversationService.getMessages(id, userId, userType, page, limit);
      res.json({ success: true, data: result });
    } catch (err: any) {
      const code = err.message === 'FORBIDDEN' ? 403 : err.message === 'NOT_FOUND' ? 404 : 500;
      res.status(code).json({ success: false, message: err.message });
    }
  },

  async startConversation(req: Request, res: Response) {
    try {
      const callerId = (req as any).userId;
      const { hostId } = req.body;
      if (!hostId) return res.status(400).json({ success: false, message: 'hostId required' });
      const conversation = await conversationService.findOrCreate(callerId, hostId);
      res.json({ success: true, data: conversation });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async markRead(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const userType = (req as any).userType;
      const id = routeParam(req.params.id);
      await conversationService.markRead(id, userId, userType);
      res.json({ success: true });
    } catch (err: any) {
      const code = err.message === 'FORBIDDEN' ? 403 : err.message === 'NOT_FOUND' ? 404 : 500;
      res.status(code).json({ success: false, message: err.message });
    }
  },

  async deleteConversation(req: Request, res: Response) {
    try {
      const callerId = (req as any).userId;
      const id = routeParam(req.params.id);
      await conversationService.callerDelete(id, callerId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const userType = (req as any).userType;
      const total = await conversationService.getTotalUnread(userId, userType);
      res.json({ success: true, data: { unread: total } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Admin
  async adminGetConversations(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const total = await Conversation.countDocuments();
      const conversations = await Conversation.find()
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('callerId', 'displayName')
        .populate('hostId', 'displayName')
        .lean();
      res.json({ success: true, data: { conversations, total, page, limit } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};
