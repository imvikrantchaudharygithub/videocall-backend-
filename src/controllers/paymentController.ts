import { Request, Response } from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  processPaymentSuccess,
  verifyWebhookSignature,
} from '../services/paymentService';
import { errorResponse, successResponse } from '../types';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { packId } = req.body;
    if (!packId) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'packId is required'));
      return;
    }

    const order = await createPaymentOrder(req.userId!, packId);
    if (!order) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Coin pack not found'));
      return;
    }

    res.json(successResponse(order));
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const verifyPaymentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const isValid = await verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      res.status(400).json(errorResponse('PAYMENT_VERIFICATION_FAILED', 'Invalid payment signature'));
      return;
    }

    const success = await processPaymentSuccess(razorpayOrderId, razorpayPaymentId);
    if (!success) {
      res.status(400).json(errorResponse('ORDER_NOT_FOUND', 'Order not found or already processed'));
      return;
    }

    res.json(successResponse({ message: 'Payment verified and coins credited' }));
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);

    if (!verifyWebhookSignature(body, signature)) {
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    const { event, payload } = req.body;

    if (event === 'payment.captured') {
      const { order_id, id: paymentId } = payload.payment.entity;
      await processPaymentSuccess(order_id, paymentId);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
