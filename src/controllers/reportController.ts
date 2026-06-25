import { Request, Response } from 'express';
import { Report } from '../models/report.model';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

export const submitReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportedId, callId, reason, details } = req.body;

    const report = await Report.create({
      reporterId: req.userId,
      reportedId: new mongoose.Types.ObjectId(reportedId),
      callId: callId ? new mongoose.Types.ObjectId(callId) : undefined,
      reason,
      details,
    });

    res.json(successResponse({ reportId: report._id, message: 'Report submitted' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getMyReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const reports = await Report.find({ reporterId: req.userId }).sort({ createdAt: -1 });
    res.json(successResponse(reports));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
