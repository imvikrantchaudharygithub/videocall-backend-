import { Request, Response } from 'express';
import crypto from 'crypto';
import { VipPlan } from '../models/vipPlan.model';
import { VipSubscription } from '../models/vipSubscription.model';
import { User } from '../models/user.model';
import { ENV } from '../config/env';
import {
  createVipOrder,
  activateVipSubscription,
  getActiveSubscription,
  claimVipDailyCoins,
  cancelVipSubscription,
  expireOverdueSubscriptions,
} from '../services/vipService';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';

// ─── Public (Caller App) ──────────────────────────────────────────────────────

/** GET /api/vip/plans — list active VIP plans */
export const listVipPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await VipPlan.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json(successResponse(plans));
  } catch (error) {
    console.error('listVipPlans error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** GET /api/vip/my-subscription — get current user's VIP status */
export const getMySubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const sub = await getActiveSubscription(req.userId!);
    if (!sub) {
      res.json(successResponse({ active: false, subscription: null }));
      return;
    }
    res.json(successResponse({ active: true, subscription: sub }));
  } catch (error) {
    console.error('getMySubscription error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** POST /api/vip/subscribe — create order for VIP subscription */
export const subscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;

    if (!planId) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'planId is required'));
      return;
    }

    if (!['weekly', 'monthly'].includes(billingCycle)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'billingCycle must be weekly or monthly'));
      return;
    }

    const order = await createVipOrder(req.userId!, planId, billingCycle);
    if (!order) {
      res.status(404).json(errorResponse('NOT_FOUND', 'VIP plan not found or inactive'));
      return;
    }

    res.json(successResponse(order));
  } catch (error) {
    console.error('subscribe error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** POST /api/vip/verify — verify payment and activate VIP */
export const verifyVipPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId, billingCycle = 'monthly' } = req.body;

    // Verify signature
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      res.status(400).json(errorResponse('PAYMENT_VERIFICATION_FAILED', 'Invalid payment signature'));
      return;
    }

    const activated = await activateVipSubscription(
      req.userId!,
      planId,
      billingCycle,
      razorpayOrderId,
      razorpayPaymentId
    );

    if (!activated) {
      res.status(400).json(errorResponse('ACTIVATION_FAILED', 'Could not activate VIP subscription'));
      return;
    }

    res.json(successResponse({ message: 'VIP subscription activated!', active: true }));
  } catch (error) {
    console.error('verifyVipPayment error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** POST /api/vip/claim-daily-coins — claim daily free coins */
export const claimDailyCoins = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await claimVipDailyCoins(req.userId!);
    if (!result.success) {
      res.status(400).json(errorResponse('CLAIM_FAILED', result.message));
      return;
    }
    res.json(successResponse(result));
  } catch (error) {
    console.error('claimDailyCoins error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** POST /api/vip/cancel — cancel auto-renewal */
export const cancel = async (req: Request, res: Response): Promise<void> => {
  try {
    const cancelled = await cancelVipSubscription(req.userId!);
    if (!cancelled) {
      res.status(404).json(errorResponse('NOT_FOUND', 'No active VIP subscription found'));
      return;
    }
    res.json(successResponse({ message: 'Auto-renewal cancelled. VIP remains active until expiry.' }));
  } catch (error) {
    console.error('cancel error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Admin ─────────────────────────────────────────────────────────────────────

/** GET /api/admin/vip/plans — list all VIP plans (admin) */
export const listVipPlansAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await VipPlan.find().sort({ sortOrder: 1 });
    res.json(successResponse(plans));
  } catch (error) {
    console.error('listVipPlansAdmin error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** POST /api/admin/vip/plans — create a VIP plan */
export const createVipPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, tier, slug, description, priceInr, weeklyPriceInr,
      bonusCoinPercent, dailyFreeCoins, queueSkipPositions,
      visibilityMultiplier, callRateDiscountPercent, exclusiveGiftCount,
      adFree, badgeType, colorHex, isActive, sortOrder,
    } = req.body;

    if (!name || tier === undefined || !slug || !priceInr || !weeklyPriceInr) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'name, tier, slug, priceInr, and weeklyPriceInr are required'));
      return;
    }

    const plan = await VipPlan.create({
      name, tier, slug, description: description ?? '',
      priceInr, weeklyPriceInr,
      bonusCoinPercent: bonusCoinPercent ?? 0,
      dailyFreeCoins: dailyFreeCoins ?? 0,
      queueSkipPositions: queueSkipPositions ?? 0,
      visibilityMultiplier: visibilityMultiplier ?? 1,
      callRateDiscountPercent: callRateDiscountPercent ?? 0,
      exclusiveGiftCount: exclusiveGiftCount ?? 0,
      adFree: adFree ?? true,
      badgeType: badgeType ?? '',
      colorHex: colorHex ?? '#C0C0C0',
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    res.status(201).json(successResponse(plan));
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json(errorResponse('DUPLICATE', 'A plan with this tier or slug already exists'));
      return;
    }
    console.error('createVipPlan error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** PATCH /api/admin/vip/plans/:id — update a VIP plan */
export const updateVipPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const plan = await VipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) {
      res.status(404).json(errorResponse('NOT_FOUND', 'VIP plan not found'));
      return;
    }
    res.json(successResponse(plan));
  } catch (error) {
    console.error('updateVipPlan error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** DELETE /api/admin/vip/plans/:id — delete a VIP plan */
export const deleteVipPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const plan = await VipPlan.findByIdAndDelete(req.params.id);
    if (!plan) {
      res.status(404).json(errorResponse('NOT_FOUND', 'VIP plan not found'));
      return;
    }
    res.json(successResponse({ message: 'VIP plan deleted' }));
  } catch (error) {
    console.error('deleteVipPlan error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** GET /api/admin/vip/subscribers — list VIP subscribers */
export const listVipSubscribers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) filter.status = status;

    const [subscribers, total] = await Promise.all([
      VipSubscription.find(filter)
        .populate('userId', 'displayName phone email')
        .populate('planId', 'name tier slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VipSubscription.countDocuments(filter),
    ]);

    res.json(successResponse(subscribers, {
      page, limit, total, pages: Math.ceil(total / limit),
    }));
  } catch (error) {
    console.error('listVipSubscribers error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** GET /api/admin/vip/revenue — VIP revenue stats */
export const getVipRevenue = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      activeCount,
      totalRevenue,
      monthlyRevenue,
      tierBreakdown,
    ] = await Promise.all([
      VipSubscription.countDocuments({ status: 'active', endDate: { $gt: new Date() } }),
      VipSubscription.aggregate([
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]),
      VipSubscription.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]),
      VipSubscription.aggregate([
        { $match: { status: 'active', endDate: { $gt: new Date() } } },
        { $group: { _id: '$tier', count: { $sum: 1 }, revenue: { $sum: '$amountPaid' } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json(successResponse({
      activeSubscribers: activeCount,
      totalRevenue: totalRevenue[0]?.total ?? 0,
      last30DaysRevenue: monthlyRevenue[0]?.total ?? 0,
      mrr: monthlyRevenue[0]?.total ?? 0,
      tierBreakdown,
    }));
  } catch (error) {
    console.error('getVipRevenue error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
