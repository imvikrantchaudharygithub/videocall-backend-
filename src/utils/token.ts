import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { JWT_EXPIRY } from './constants';

export const generateAccessToken = (userId: string, userType: 'caller' | 'host'): string => {
  return jwt.sign({ userId, userType }, ENV.SECRET_KEY, { expiresIn: JWT_EXPIRY });
};

export const generateAdminToken = (adminId: string, role: 'super_admin' | 'support'): string => {
  return jwt.sign({ adminId, role }, ENV.ADMIN_SECRET_KEY, { expiresIn: JWT_EXPIRY });
};

export const verifyAccessToken = (token: string): { userId: string; userType: 'caller' | 'host' } | null => {
  try {
    return jwt.verify(token, ENV.SECRET_KEY) as { userId: string; userType: 'caller' | 'host' };
  } catch {
    return null;
  }
};
