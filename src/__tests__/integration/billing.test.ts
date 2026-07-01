// endActiveCall emits 'call:ended' via getIO(); stub it so settlement runs without Socket.io.
jest.mock('../../socket', () => ({ getIO: () => ({ to: () => ({ emit: () => undefined }) }) }));

import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/mongo';
import { Call } from '../../models/call.model';
import { CallerWallet } from '../../models/callerWallet.model';
import { HostEarnings } from '../../models/hostEarnings.model';
import { endActiveCall, billingTick } from '../../controllers/callController';
import { sweepStaleCalls } from '../../jobs/staleCallSweeper';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

let channelSeq = 0;
const makeActiveCall = async (opts: {
  rate: number;
  elapsedSec: number;
  callType?: 'video' | 'voice';
  balance?: number;
  alreadyBilled?: number;
  lastBilledSecAgo?: number;
}) => {
  const callerId = new mongoose.Types.ObjectId();
  const hostId = new mongoose.Types.ObjectId();
  await CallerWallet.create({ userId: callerId, balanceCoins: opts.balance ?? 1_000_000 });
  const call = await Call.create({
    callerId,
    hostId,
    callType: opts.callType ?? 'voice',
    agoraChannel: `ch_${Date.now()}_${channelSeq++}`,
    status: 'active',
    ratePerMinute: opts.rate,
    ratePerSecond: opts.rate / 60,
    answeredAt: new Date(Date.now() - opts.elapsedSec * 1000),
    lastBilledAt:
      opts.lastBilledSecAgo !== undefined ? new Date(Date.now() - opts.lastBilledSecAgo * 1000) : undefined,
    totalCostCoins: opts.alreadyBilled ?? 0,
  });
  return { call, callerId, hostId };
};

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('QC-10: billingTick charges actual elapsed time at the real rate (no per-tick overcharge)', () => {
  it('voice @54/min after ~65s charges ceil(65/60*54)=59, not a rounded-up per-tick total', async () => {
    const { call, callerId } = await makeActiveCall({ rate: 54, elapsedSec: 65, balance: 100000 });
    const req: any = { params: { id: call._id.toString() }, userId: callerId };
    await billingTick(req, mockRes());

    const wallet = await CallerWallet.findOne({ userId: callerId });
    expect(wallet!.balanceCoins).toBe(100000 - 59);
    const updated = await Call.findById(call._id);
    expect(updated!.totalCostCoins).toBe(59);
    expect(updated!.lastBilledAt).toBeTruthy();
  });

  it('only charges the delta since the last tick (no double charge)', async () => {
    // 120s elapsed, already billed 54 (the first minute). delta = ceil(120/60*54)-54 = 108-54 = 54
    const { call, callerId } = await makeActiveCall({ rate: 54, elapsedSec: 120, balance: 100000, alreadyBilled: 54 });
    const req: any = { params: { id: call._id.toString() }, userId: callerId };
    await billingTick(req, mockRes());
    const wallet = await CallerWallet.findOne({ userId: callerId });
    expect(wallet!.balanceCoins).toBe(100000 - 54);
  });
});

describe('endActiveCall settlement', () => {
  it('enforces the 3-minute minimum on a short call (QC-04 / business rule)', async () => {
    const { call, callerId, hostId } = await makeActiveCall({ rate: 54, elapsedSec: 10, balance: 100000 });
    const fresh = await Call.findById(call._id);
    await endActiveCall(fresh as any, 'caller_ended');

    const settled = await Call.findById(call._id);
    // 3-min floor: ceil(180/60 * 54) = 162
    expect(settled!.totalCostCoins).toBe(162);
    expect(settled!.hostEarningsCoins).toBe(Math.floor(162 * 0.3)); // 48
    expect(settled!.platformEarningsCoins).toBe(162 - 48);
    expect(settled!.status).toBe('ended');

    const wallet = await CallerWallet.findOne({ userId: callerId });
    expect(wallet!.balanceCoins).toBe(100000 - 162); // caller charged the full floor
    const earnings = await HostEarnings.findOne({ userId: hostId });
    expect(earnings!.balanceCoins).toBe(48);
  });

  it('does not double-charge when ticks already covered the cost', async () => {
    // 180s call where ticks already billed the correct 162; settlement must add nothing.
    const { call, callerId } = await makeActiveCall({ rate: 54, elapsedSec: 180, balance: 100000, alreadyBilled: 162 });
    const fresh = await Call.findById(call._id);
    await endActiveCall(fresh as any, 'caller_ended');
    const wallet = await CallerWallet.findOne({ userId: callerId });
    expect(wallet!.balanceCoins).toBe(100000); // remaining charge = 162 - 162 = 0, so unchanged
  });
});

describe('QC-06: stale-call sweeper', () => {
  it('force-settles an active call whose client went silent', async () => {
    // lastBilledAt 60s ago (> STALE_CALL_SECONDS=30) → should be settled
    const { call, hostId } = await makeActiveCall({ rate: 54, elapsedSec: 120, lastBilledSecAgo: 60 });
    const settledCount = await sweepStaleCalls();
    expect(settledCount).toBe(1);

    const after = await Call.findById(call._id);
    expect(after!.status).toBe('ended');
    expect(after!.endReason).toBe('system_timeout');
    const earnings = await HostEarnings.findOne({ userId: hostId });
    expect(earnings!.balanceCoins).toBeGreaterThan(0); // host credited at settlement
  });

  it('leaves a freshly-ticked active call alone', async () => {
    const { call } = await makeActiveCall({ rate: 54, elapsedSec: 20, lastBilledSecAgo: 2 });
    const settledCount = await sweepStaleCalls();
    expect(settledCount).toBe(0);
    const after = await Call.findById(call._id);
    expect(after!.status).toBe('active');
  });
});
