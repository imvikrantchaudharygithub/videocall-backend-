import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/mongo';
import { EarningsTransaction } from '../../models/earningsTransaction.model';
import { getDailyEarnings } from '../../controllers/earningsController';
import { istDateKey } from '../../utils/time';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const MS_DAY = 24 * 60 * 60 * 1000;

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('GET /earnings/daily (getDailyEarnings)', () => {
  it('returns a zero-filled series with today’s credits bucketed by IST day', async () => {
    const hostId = new mongoose.Types.ObjectId();

    // Two earning credits today, plus one backdated 3 days ago (raw insert to control createdAt).
    await EarningsTransaction.create({ hostId, type: 'call_earning', amountCoins: 300 });
    await EarningsTransaction.create({ hostId, type: 'gift_earning', amountCoins: 200 });
    const threeDaysAgo = new Date(Date.now() - 3 * MS_DAY);
    await EarningsTransaction.collection.insertOne({
      hostId, type: 'call_earning', amountCoins: 90,
      description: '', createdAt: threeDaysAgo, updatedAt: threeDaysAgo,
    });

    const req: any = { query: { days: '30' }, userId: hostId.toString() };
    const res = mockRes();
    await getDailyEarnings(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    const stats = payload.data.stats as { date: string; coins: number; inr: number }[];

    expect(stats).toHaveLength(30);
    // ordered oldest → newest, last entry is today (IST)
    expect(stats[stats.length - 1].date).toBe(istDateKey(new Date()));

    const today = stats.find((s) => s.date === istDateKey(new Date()))!;
    expect(today.coins).toBe(500); // 300 + 200
    expect(today.inr).toBeCloseTo(500 / 60); // COINS_PER_INR = 60

    const back = stats.find((s) => s.date === istDateKey(threeDaysAgo))!;
    expect(back.coins).toBe(90);

    // withdrawals are excluded and untouched days are zero
    const untouched = stats.find((s) => s.date === istDateKey(new Date(Date.now() - 10 * MS_DAY)))!;
    expect(untouched.coins).toBe(0);
  });

  it('clamps the days window to [1, 90]', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const req: any = { query: { days: '9999' }, userId: hostId.toString() };
    const res = mockRes();
    await getDailyEarnings(req, res);
    const stats = res.json.mock.calls[0][0].data.stats;
    expect(stats).toHaveLength(90);
  });
});
