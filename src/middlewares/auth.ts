import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { errorResponse } from '../types';
import mongoose from 'mongoose';

interface JwtPayload {
  userId: string;
  userType: 'caller' | 'host';
}

interface AuthRequest extends Request {
  userId?: mongoose.Types.ObjectId;
  userType?: 'caller' | 'host';
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ENV.SECRET_KEY) as JwtPayload;
    req.userId = new mongoose.Types.ObjectId(decoded.userId);
    req.userType = decoded.userType;
    next();
  } catch {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid or expired token'));
  }
};

export const requireCaller = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.userType !== 'caller') {
    res.status(403).json(errorResponse('FORBIDDEN', 'Caller access required'));
    return;
  }
  next();
};

export const requireHost = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.userType !== 'host') {
    res.status(403).json(errorResponse('FORBIDDEN', 'Host access required'));
    return;
  }
  next();
};
