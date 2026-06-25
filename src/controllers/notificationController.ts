import { Request, Response } from 'express';
import { Notification } from '../models/notification.model';
import { errorResponse, successResponse } from '../types';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);

    const [notifications, total] = await Promise.all([
      Notification.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments({ userId: req.userId }),
    ]);

    res.json(successResponse(notifications, {
      page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateOne({ _id: req.params.id, userId: req.userId }, { $set: { isRead: true } });
    res.json(successResponse({ message: 'Marked as read' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ userId: req.userId, isRead: false }, { $set: { isRead: true } });
    res.json(successResponse({ message: 'All notifications marked as read' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
