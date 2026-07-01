import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/mongo';
import { quickLoginService } from '../../services/authService';
import { User } from '../../models/user.model';
import { CallerWallet } from '../../models/callerWallet.model';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('quickLoginService (caller phone-only login)', () => {
  it('creates a new caller with a wallet and returns a token on first login', async () => {
    const r = await quickLoginService('+919999900001', 'caller');
    expect(r.isNewUser).toBe(true);
    expect(r.accessToken).toBeTruthy();
    expect(r.sessionId).toBeTruthy();

    const user = await User.findOne({ phone: '+919999900001' });
    expect(user).toBeTruthy();
    expect(user!.userType).toBe('caller');

    const wallet = await CallerWallet.findOne({ userId: user!._id });
    expect(wallet).toBeTruthy();
  });

  it('returns the existing account (isNewUser=false) on a second login', async () => {
    await quickLoginService('+919999900002', 'caller');
    const r2 = await quickLoginService('+919999900002', 'caller');
    expect(r2.isNewUser).toBe(false);

    // exactly one user for that phone — no duplicate accounts
    expect(await User.countDocuments({ phone: '+919999900002' })).toBe(1);
  });
});
