import { Request, Response } from 'express';
import { sendOTPService, verifyOTPService, fastLoginService, guestLoginService } from '../services/authService';
import { User } from '../models/user.model';
import { errorResponse, successResponse } from '../types';

export const sendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Phone number is required'));
      return;
    }
    const result = await sendOTPService(phone);
    if (!result.success) {
      res.status(500).json(errorResponse('OTP_SEND_FAILED', result.message));
      return;
    }
    res.json(successResponse({ message: result.message }));
  } catch (error) {
    console.error('sendOTP error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, userType } = req.body;
    if (!phone || !otp) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Phone and OTP are required'));
      return;
    }
    const result = await verifyOTPService(phone, otp, userType || 'caller');
    if (!result) {
      res.status(400).json(errorResponse('INVALID_OTP', 'Invalid or expired OTP'));
      return;
    }
    // host app reads `token`, caller app reads `accessToken` — return both
    res.json(successResponse({ ...result, token: result.accessToken }));
  } catch (error) {
    console.error('verifyOTP error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const fastLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'sessionId is required'));
      return;
    }
    const result = await fastLoginService(sessionId);
    if (!result) {
      res.status(401).json(errorResponse('SESSION_EXPIRED', 'Session expired or invalid'));
      return;
    }
    res.json(successResponse({ ...result, token: result.accessToken }));
  } catch (error) {
    console.error('fastLogin error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const guestLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.body;
    const result = await guestLoginService(deviceId);
    res.json(successResponse(result));
  } catch (error) {
    console.error('guestLogin error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    await User.updateOne(
      { _id: req.userId },
      { $unset: { sessionId: '', sessionExpiry: '' } }
    );
    res.json(successResponse({ message: 'Logged out successfully' }));
  } catch (error) {
    console.error('logout error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
