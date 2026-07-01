import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/mongo';
import { addCoins, deductCoins, getBalance } from '../../services/walletService';
import { CallerWallet } from '../../models/callerWallet.model';
import { WalletTransaction } from '../../models/walletTransaction.model';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('walletService — balance + ledger integrity', () => {
  it('addCoins increments balance (atomic $inc) and writes one ledger row', async () => {
    const userId = new mongoose.Types.ObjectId();
    await addCoins(userId, 500, 'welcome_bonus', 'welcome');
    expect(await getBalance(userId)).toBe(500);
    const txns = await WalletTransaction.find({ userId });
    expect(txns).toHaveLength(1);
    expect(txns[0].amountCoins).toBe(500);
    expect(txns[0].balanceAfter).toBe(500);
  });

  it('deductCoins succeeds, lowers balance, and writes a negative ledger row', async () => {
    const userId = new mongoose.Types.ObjectId();
    await CallerWallet.create({ userId, balanceCoins: 100 });
    const r = await deductCoins(userId, 30, 'gift_sent', 'gift');
    expect(r.success).toBe(true);
    expect(r.newBalance).toBe(70);
    const txns = await WalletTransaction.find({ userId });
    expect(txns).toHaveLength(1);
    expect(txns[0].amountCoins).toBe(-30);
  });

  it('deductCoins fails on insufficient balance and writes NO ledger row', async () => {
    const userId = new mongoose.Types.ObjectId();
    await CallerWallet.create({ userId, balanceCoins: 10 });
    const r = await deductCoins(userId, 50, 'gift_sent', 'gift');
    expect(r.success).toBe(false);
    expect(await getBalance(userId)).toBe(10);
    expect(await WalletTransaction.countDocuments({ userId })).toBe(0);
  });
});
