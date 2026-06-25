import { Request, Response } from 'express';
import { PaymentPlan } from '../models/paymentPlan.model';
import { errorResponse, successResponse } from '../types';

// ─── Public ──────────────────────────────────────────────────────────────────

/** GET /api/payment-plans — public endpoint for payment website */
export const listPublicPaymentPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await PaymentPlan.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json(successResponse({ plans }));
  } catch (error) {
    console.error('listPublicPaymentPlans error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// ─── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/admin/payment-plans — list all plans (admin) */
export const listPaymentPlansAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await PaymentPlan.find().sort({ sortOrder: 1 });
    res.json(successResponse(plans));
  } catch (error) {
    console.error('listPaymentPlansAdmin error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** POST /api/admin/payment-plans — create a plan */
export const createPaymentPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, priceInr, baseCoins, bonusCoins = 0, isPopular, sortOrder, isActive } = req.body;

    if (!name || !priceInr || !baseCoins) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'name, priceInr, and baseCoins are required'));
      return;
    }

    const plan = await PaymentPlan.create({
      name,
      description: description ?? '',
      priceInr,
      baseCoins,
      bonusCoins,
      totalCoins: Number(baseCoins) + Number(bonusCoins),
      isPopular: isPopular ?? false,
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    res.status(201).json(successResponse(plan));
  } catch (error) {
    console.error('createPaymentPlan error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** PATCH /api/admin/payment-plans/:id — update a plan */
export const updatePaymentPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await PaymentPlan.findById(req.params.id);
    if (!existing) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Payment plan not found'));
      return;
    }

    const update = { ...req.body };

    // Recalculate totalCoins whenever base/bonus coins change
    if (update.baseCoins !== undefined || update.bonusCoins !== undefined) {
      const base  = update.baseCoins  !== undefined ? Number(update.baseCoins)  : existing.baseCoins;
      const bonus = update.bonusCoins !== undefined ? Number(update.bonusCoins) : existing.bonusCoins;
      update.totalCoins = base + bonus;
    }

    const plan = await PaymentPlan.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(successResponse(plan));
  } catch (error) {
    console.error('updatePaymentPlan error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

/** DELETE /api/admin/payment-plans/:id — delete a plan */
export const deletePaymentPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const plan = await PaymentPlan.findByIdAndDelete(req.params.id);
    if (!plan) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Payment plan not found'));
      return;
    }
    res.json(successResponse({ message: 'Payment plan deleted' }));
  } catch (error) {
    console.error('deletePaymentPlan error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
