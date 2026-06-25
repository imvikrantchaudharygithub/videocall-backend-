import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      userId?: Types.ObjectId;
      userType?: 'caller' | 'host';
      adminId?: Types.ObjectId;
      adminRole?: 'super_admin' | 'support';
    }
  }
}

export {};
