import 'dotenv/config';
import mongoose from 'mongoose';
import { CallerWallet } from '../models/callerWallet.model';
import { ENV } from '../config/env';
(async () => {
  await mongoose.connect(ENV.MONGODB_URI);
  const r = await CallerWallet.updateMany({}, { $set: { balanceCoins: 100000 } });
  console.log('wallets updated:', JSON.stringify(r));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
