// Seeds a test caller + test host and prints ready-to-use JWTs,
// so the call flow can be exercised without going through OTP auth.
// Run: npx ts-node ./src/scripts/seedTestCall.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { HostProfile } from '../models/hostProfile.model';
import { CallerWallet } from '../models/callerWallet.model';
import { generateAccessToken } from '../utils/token';
import { ENV } from '../config/env';

const run = async () => {
  await mongoose.connect(ENV.MONGODB_URI);

  // migrate earlier test users to the formats the apps actually send:
  // caller app sends +91XXXXXXXXXX, host app sends bare XXXXXXXXXX
  await User.updateOne({ referralCode: 'TESTCALLER1' }, { $set: { phone: '+919111111111' } });
  await User.updateOne({ referralCode: 'TESTHOST1' }, { $set: { phone: '9222222222' } });

  const caller = await User.findOneAndUpdate(
    { phone: '+919111111111' },
    {
      $set: { displayName: 'Test Caller', userType: 'caller' },
      $setOnInsert: { referralCode: 'TESTCALLER1' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await CallerWallet.findOneAndUpdate(
    { userId: caller._id },
    { $set: { balanceCoins: 5000 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const host = await User.findOneAndUpdate(
    { phone: '9222222222' },
    {
      $set: { displayName: 'Test Host', userType: 'host' },
      $setOnInsert: { referralCode: 'TESTHOST1' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await HostProfile.findOneAndUpdate(
    { userId: host._id },
    { $set: { isApproved: true, isOnline: true, isBusy: false, videoRatePerMin: 60, voiceRatePerMin: 54 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(JSON.stringify({
    callerId: caller._id.toString(),
    hostId: host._id.toString(),
    callerToken: generateAccessToken(caller._id.toString(), 'caller'),
    hostToken: generateAccessToken(host._id.toString(), 'host'),
  }, null, 2));

  await mongoose.disconnect();
};

run().catch(err => { console.error(err); process.exit(1); });
