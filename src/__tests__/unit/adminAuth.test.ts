import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { verifyAdminToken, requireSuperAdmin } from '../../middlewares/adminAuth';
import { generateAccessToken, generateAdminToken } from '../../utils/token';
import { ENV } from '../../config/env';

// admin id must be a real ObjectId (the middleware constructs one from the claim)
const ADMIN_ID = new mongoose.Types.ObjectId().toString();

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('QC-01: admin token secret is separate from the user secret', () => {
  it('user and admin tokens are signed with different secrets', () => {
    const userTok = generateAccessToken('u1', 'caller');
    const adminTok = generateAdminToken(ADMIN_ID, 'super_admin');
    // cross-verification must fail
    expect(() => jwt.verify(userTok, ENV.ADMIN_SECRET_KEY)).toThrow();
    expect(() => jwt.verify(adminTok, ENV.SECRET_KEY)).toThrow();
    // each verifies with its own secret
    expect(jwt.verify(adminTok, ENV.ADMIN_SECRET_KEY)).toMatchObject({ adminId: ADMIN_ID, role: 'super_admin' });
  });
});

describe('QC-01: verifyAdminToken middleware', () => {
  it('REJECTS a normal user access token (the original bypass)', () => {
    const req: any = { headers: { authorization: `Bearer ${generateAccessToken('u1', 'caller')}` } };
    const res = mockRes();
    const next = jest.fn();
    verifyAdminToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('REJECTS a missing/invalid authorization header', () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    verifyAdminToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('REJECTS a token signed with the right secret but missing admin claims', () => {
    const bad = jwt.sign({ foo: 'bar' }, ENV.ADMIN_SECRET_KEY);
    const req: any = { headers: { authorization: `Bearer ${bad}` } };
    const res = mockRes();
    const next = jest.fn();
    verifyAdminToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('ACCEPTS a genuine admin token and sets adminId/role', () => {
    const req: any = { headers: { authorization: `Bearer ${generateAdminToken(ADMIN_ID, 'super_admin')}` } };
    const res = mockRes();
    const next = jest.fn();
    verifyAdminToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.adminId).toBeDefined();
    expect(req.adminRole).toBe('super_admin');
  });
});

describe('requireSuperAdmin (withdrawals must be approved by a super admin)', () => {
  it('BLOCKS a support-role admin (403)', () => {
    const req: any = { adminRole: 'support' };
    const res = mockRes();
    const next = jest.fn();
    requireSuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('BLOCKS when no admin role is present (403)', () => {
    const req: any = {};
    const res = mockRes();
    const next = jest.fn();
    requireSuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('ALLOWS a super_admin', () => {
    const req: any = { adminRole: 'super_admin' };
    const res = mockRes();
    const next = jest.fn();
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
