import { Request, Response } from 'express';
import { CallQueue } from '../models/callQueue.model';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';
import { QUEUE_TIMEOUT_MINUTES, MAX_QUEUE_SIZE } from '../utils/constants';
import { getUserVipPlan } from '../services/vipService';

export const joinQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hostId, callType } = req.body;

    const queueSize = await CallQueue.countDocuments({ hostId: new mongoose.Types.ObjectId(hostId), status: 'waiting' });
    if (queueSize >= MAX_QUEUE_SIZE) {
      res.status(400).json(errorResponse('QUEUE_FULL', 'Host queue is full'));
      return;
    }

    // VIP queue priority: skip positions based on plan
    let position = queueSize + 1;
    const vipPlan = await getUserVipPlan(req.userId!);
    if (vipPlan && vipPlan.queueSkipPositions !== 0) {
      if (vipPlan.queueSkipPositions === -1) {
        position = 1; // Always first
      } else {
        position = Math.max(1, position - vipPlan.queueSkipPositions);
      }
    }
    const expiresAt = new Date(Date.now() + QUEUE_TIMEOUT_MINUTES * 60 * 1000);

    const entry = await CallQueue.create({
      hostId: new mongoose.Types.ObjectId(hostId),
      callerId: req.userId,
      callType: callType || 'video',
      position,
      expiresAt,
    });

    res.json(successResponse({
      queueId: entry._id,
      position,
      estimatedWaitMinutes: position * 5,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const leaveQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = req.params.hostId;
    const hostIdStr = Array.isArray(hostId) ? hostId[0] : hostId;
    await CallQueue.updateOne(
      { hostId: new mongoose.Types.ObjectId(hostIdStr), callerId: req.userId, status: 'waiting' },
      { $set: { status: 'expired' } }
    );
    res.json(successResponse({ message: 'Left queue' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getQueuePosition = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = req.params.hostId;
    const hostIdStr = Array.isArray(hostId) ? hostId[0] : hostId;
    const entry = await CallQueue.findOne({
      hostId: new mongoose.Types.ObjectId(hostIdStr),
      callerId: req.userId,
      status: 'waiting',
    });

    if (!entry) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Not in queue'));
      return;
    }

    res.json(successResponse({ position: entry.position, expiresAt: entry.expiresAt }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
