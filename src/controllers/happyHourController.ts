import { Request, Response } from 'express';
import { HappyHour } from '../models/happyHour.model';
import { getActiveHappyHour, getActiveEventTimeRemaining } from '../services/happyHourService';
import { errorResponse, successResponse } from '../types';

// ─── Public (Caller App) ──────────────────────────────────────────────────────

/** GET /api/happy-hour/active — get currently active happy hour (if any) */
export const getActiveEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getActiveEventTimeRemaining();
    if (!result) {
      res.json(successResponse({ active: false, event: null }));
      return;
    }
    res.json(successResponse({
      active: true,
      event: {
        _id: result.event._id,
        name: result.event.name,
        description: result.event.description,
        bonusPercent: result.event.bonusPercent,
        bannerColor: result.event.bannerColor,
        bannerIcon: result.event.bannerIcon,
        remainingSeconds: result.remainingSeconds,
      },
    }));
  } catch (error) {
    console.error('getActiveEvent error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Admin ─────────────────────────────────────────────────────────────────────

/** GET /api/admin/happy-hours — list all happy hours */
export const listHappyHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await HappyHour.find().sort({ createdAt: -1 });
    res.json(successResponse(events));
  } catch (error) {
    console.error('listHappyHours error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** POST /api/admin/happy-hours — create a happy hour event */
export const createHappyHour = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, description, bonusPercent, startTime, endTime,
      isRecurring, recurringDays, recurringStartHour, recurringStartMinute,
      recurringEndHour, recurringEndMinute, isActive, bannerColor, bannerIcon,
    } = req.body;

    if (!name || bonusPercent === undefined) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'name and bonusPercent are required'));
      return;
    }

    if (!isRecurring && (!startTime || !endTime)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'startTime and endTime required for non-recurring events'));
      return;
    }

    if (isRecurring && (!recurringDays || recurringDays.length === 0)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'recurringDays required for recurring events'));
      return;
    }

    const event = await HappyHour.create({
      name,
      description: description ?? '',
      bonusPercent,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      isRecurring: isRecurring ?? false,
      recurringDays: recurringDays ?? [],
      recurringStartHour: recurringStartHour ?? 0,
      recurringStartMinute: recurringStartMinute ?? 0,
      recurringEndHour: recurringEndHour ?? 0,
      recurringEndMinute: recurringEndMinute ?? 0,
      isActive: isActive ?? true,
      bannerColor: bannerColor ?? '#FF6B35',
      bannerIcon: bannerIcon ?? 'flash',
    });

    res.status(201).json(successResponse(event));
  } catch (error) {
    console.error('createHappyHour error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** PATCH /api/admin/happy-hours/:id — update a happy hour */
export const updateHappyHour = async (req: Request, res: Response): Promise<void> => {
  try {
    const update = { ...req.body };
    if (update.startTime) update.startTime = new Date(update.startTime);
    if (update.endTime) update.endTime = new Date(update.endTime);

    const event = await HappyHour.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!event) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Happy hour not found'));
      return;
    }
    res.json(successResponse(event));
  } catch (error) {
    console.error('updateHappyHour error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** DELETE /api/admin/happy-hours/:id — delete a happy hour */
export const deleteHappyHour = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await HappyHour.findByIdAndDelete(req.params.id);
    if (!event) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Happy hour not found'));
      return;
    }
    res.json(successResponse({ message: 'Happy hour deleted' }));
  } catch (error) {
    console.error('deleteHappyHour error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
