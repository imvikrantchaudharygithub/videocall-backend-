import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/mongo';
import { VipPlan } from '../../models/vipPlan.model';
import { VipSubscription } from '../../models/vipSubscription.model';
import { CallerWallet } from '../../models/callerWallet.model';
import { claimVipDailyCoins } from '../../services/vipService';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const DAILY_COINS = 100;

const seedActiveSub = async () => {
  const userId = new mongoose.Types.ObjectId();
  const plan = await VipPlan.create({
    name: 'Gold', tier: 2, slug: 'gold', priceInr: 499, weeklyPriceInr: 149,
    dailyFreeCoins: DAILY_COINS,
  });
  await VipSubscription.create({
    userId, planId: plan._id, tier: 2, planName: 'Gold',
    status: 'active',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    dailyCoinsClaimed: null,
  });
  return userId;
};

describe('QC-20: VIP daily coin claim is single-credit', () => {
  it('credits once, then reports already-claimed on a second sequential claim', async () => {
    const userId = await seedActiveSub();

    const first = await claimVipDailyCoins(userId);
    expect(first.success).toBe(true);
    expect(first.coinsAwarded).toBe(DAILY_COINS);

    const second = await claimVipDailyCoins(userId);
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already claimed/i);

    const wallet = await CallerWallet.findOne({ userId });
    expect(wallet!.balanceCoins).toBe(DAILY_COINS); // credited exactly once
  });

  it('two concurrent claims credit the coins only once (race guard)', async () => {
    const userId = await seedActiveSub();

    const results = await Promise.all([claimVipDailyCoins(userId), claimVipDailyCoins(userId)]);
    const successes = results.filter((r) => r.success).length;
    expect(successes).toBe(1); // exactly one winner

    const wallet = await CallerWallet.findOne({ userId });
    expect(wallet!.balanceCoins).toBe(DAILY_COINS);
  });
});
