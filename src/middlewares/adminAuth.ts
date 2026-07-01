import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { errorResponse } from '../types';
import mongoose from 'mongoose';

interface AdminJwtPayload {
  adminId: string;
  role: 'super_admin' | 'support';
}

interface AdminRequest extends Request {
  adminId?: mongoose.Types.ObjectId;
  adminRole?: 'super_admin' | 'support';
}

export const verifyAdminToken = (req: AdminRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ENV.ADMIN_SECRET_KEY) as AdminJwtPayload;
    // Reject anything that isn't a genuine admin token (e.g. a user access token):
    // it must carry a valid adminId and a known admin role.
    if (!decoded || !decoded.adminId || (decoded.role !== 'super_admin' && decoded.role !== 'support')) {
      res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid admin token'));
      return;
    }
    req.adminId = new mongoose.Types.ObjectId(decoded.adminId);
    req.adminRole = decoded.role;
    next();
  } catch {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid or expired admin token'));
  }
};

export const requireSuperAdmin = (req: AdminRequest, res: Response, next: NextFunction): void => {
  if (req.adminRole !== 'super_admin') {
    res.status(403).json(errorResponse('FORBIDDEN', 'Super admin access required'));
    return;
  }
  next();
};
