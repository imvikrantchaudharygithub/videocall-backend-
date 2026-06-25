import { Request, Response } from 'express';
import { Rating } from '../models/rating.model';
import { Call } from '../models/call.model';
import { updateHostRatingAvg } from '../services/tierService';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

export const submitRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callId, score, review } = req.body;

    const existing = await Rating.findOne({ callId });
    if (existing) {
      res.status(400).json(errorResponse('DUPLICATE_RATING', 'You have already rated this call'));
      return;
    }

    const call = await Call.findOne({ _id: callId, callerId: req.userId, status: 'ended' });
    if (!call) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Call not found'));
      return;
    }

    await Rating.create({
      callId: new mongoose.Types.ObjectId(callId),
      callerId: req.userId,
      hostId: call.hostId,
      score,
      review,
    });

    await updateHostRatingAvg(call.hostId, score);

    res.json(successResponse({ message: 'Rating submitted' }));
  } catch (error) {
    console.error('submitRating error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getHostRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = req.params.hostId;
    const hostIdStr = Array.isArray(hostId) ? hostId[0] : hostId;
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);

    const [ratings, total] = await Promise.all([
      Rating.find({ hostId: new mongoose.Types.ObjectId(hostIdStr) })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Rating.countDocuments({ hostId: new mongoose.Types.ObjectId(hostIdStr) }),
    ]);

    res.json(successResponse(ratings, {
      page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
