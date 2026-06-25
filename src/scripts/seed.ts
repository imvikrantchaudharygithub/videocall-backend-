import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env';

// Models
import { HostTier } from '../models/hostTier.model';
import { Gift } from '../models/gift.model';
import { CreditPack } from '../models/creditPack.model';
import { PlatformSetting } from '../models/platformSetting.model';
import { AdminUser } from '../models/adminUser.model';

const run = async () => {
  await mongoose.connect(ENV.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // ─── Host Tiers ─────────────────────────────────────────────────────────────
  const tiers = [
    { tierLevel: 1, name: 'Starter', color: '#78909C', videoRatePerMin: 10, requirements: { dailyMinHours: 0, daysPerWeek: 0, weeksRequired: 0, minRating: null } },
    { tierLevel: 2, name: 'Bronze',  color: '#CD7F32', videoRatePerMin: 15, requirements: { dailyMinHours: 2, daysPerWeek: 4, weeksRequired: 2, minRating: null } },
    { tierLevel: 3, name: 'Silver',  color: '#C0C0C0', videoRatePerMin: 20, requirements: { dailyMinHours: 3, daysPerWeek: 5, weeksRequired: 3, minRating: 3.5 } },
    { tierLevel: 4, name: 'Gold',    color: '#FFD700', videoRatePerMin: 30, requirements: { dailyMinHours: 4, daysPerWeek: 5, weeksRequired: 4, minRating: 4.0 } },
    { tierLevel: 5, name: 'Platinum',color: '#E5E4E2', videoRatePerMin: 40, requirements: { dailyMinHours: 5, daysPerWeek: 6, weeksRequired: 4, minRating: 4.2 } },
    { tierLevel: 6, name: 'Diamond', color: '#B9F2FF', videoRatePerMin: 50, requirements: { dailyMinHours: 6, daysPerWeek: 6, weeksRequired: 6, minRating: 4.3 } },
    { tierLevel: 7, name: 'Elite',   color: '#9B59B6', videoRatePerMin: 60, requirements: { dailyMinHours: 7, daysPerWeek: 6, weeksRequired: 8, minRating: 4.4 } },
    { tierLevel: 8, name: 'Supreme', color: '#E74C3C', videoRatePerMin: 70, requirements: { dailyMinHours: 8, daysPerWeek: 7, weeksRequired: 8, minRating: 4.5 } },
    { tierLevel: 9, name: 'Crown',   color: '#F39C12', videoRatePerMin: 80, requirements: { dailyMinHours: 8, daysPerWeek: 7, weeksRequired: 12, minRating: 4.7 } },
  ];

  await HostTier.deleteMany({});
  await HostTier.insertMany(tiers);
  console.log(`✅ Seeded ${tiers.length} host tiers`);

  // ─── Gifts ───────────────────────────────────────────────────────────────────
  const gifts = [
    { name: 'Rose',        iconUrl: '', animationKey: 'rose',        costCoins: 500,    hostSharePercent: 20, category: 'basic',   sortOrder: 1 },
    { name: 'Heart',       iconUrl: '', animationKey: 'heart',       costCoins: 1200,   hostSharePercent: 25, category: 'basic',   sortOrder: 2 },
    { name: 'Teddy Bear',  iconUrl: '', animationKey: 'teddy',       costCoins: 3000,   hostSharePercent: 25, category: 'premium', sortOrder: 3 },
    { name: 'Diamond',     iconUrl: '', animationKey: 'diamond',     costCoins: 6000,   hostSharePercent: 30, category: 'premium', sortOrder: 4 },
    { name: 'Crown',       iconUrl: '', animationKey: 'crown',       costCoins: 12000,  hostSharePercent: 30, category: 'luxury',  sortOrder: 5 },
    { name: 'Sports Car',  iconUrl: '', animationKey: 'car',         costCoins: 30000,  hostSharePercent: 30, category: 'luxury',  sortOrder: 6 },
    { name: 'Villa',       iconUrl: '', animationKey: 'villa',       costCoins: 60000,  hostSharePercent: 30, category: 'luxury',  sortOrder: 7 },
    { name: 'Private Jet', iconUrl: '', animationKey: 'jet',         costCoins: 150000, hostSharePercent: 35, category: 'luxury',  sortOrder: 8 },
  ];

  await Gift.deleteMany({});
  await Gift.insertMany(gifts);
  console.log(`✅ Seeded ${gifts.length} gifts`);

  // ─── Coin Packs ──────────────────────────────────────────────────────────────
  const packs = [
    { packId: 'micro_49',  name: 'Micro Pack',    amountInr: 49,   coins: 2940,   bonusCoins: 0,     totalCoins: 2940,   sortOrder: 1 },
    { packId: 'micro_99',  name: 'Mini Pack',     amountInr: 99,   coins: 5940,   bonusCoins: 0,     totalCoins: 5940,   sortOrder: 2 },
    { packId: 'starter',   name: 'Starter Pack',  amountInr: 199,  coins: 11940,  bonusCoins: 0,     totalCoins: 11940,  sortOrder: 3 },
    { packId: 'popular',   name: 'Popular Pack',  amountInr: 499,  coins: 29940,  bonusCoins: 1560,  totalCoins: 31500,  sortOrder: 4 },
    { packId: 'value',     name: 'Value Pack',    amountInr: 999,  coins: 59940,  bonusCoins: 5060,  totalCoins: 65000,  sortOrder: 5 },
    { packId: 'premium',   name: 'Premium Pack',  amountInr: 2499, coins: 149940, bonusCoins: 18060, totalCoins: 168000, sortOrder: 6 },
  ];

  await CreditPack.deleteMany({});
  await CreditPack.insertMany(packs);
  console.log(`✅ Seeded ${packs.length} coin packs`);

  // ─── Platform Settings ───────────────────────────────────────────────────────
  const settings = [
    { key: 'coins_per_inr',               value: 60 },
    { key: 'host_share_percent',          value: 30 },
    { key: 'platform_share_percent',      value: 70 },
    { key: 'voice_discount_percent',      value: 10 },
    { key: 'low_balance_warning_seconds', value: 60 },
    { key: 'min_balance_to_call_seconds', value: 180 },
    { key: 'min_withdrawal_inr',          value: 200 },
    { key: 'session_expiry_days',         value: 30 },
    { key: 'max_queue_size',              value: 10 },
    { key: 'queue_timeout_minutes',       value: 10 },
    { key: 'call_ring_timeout_seconds',   value: 30 },
    { key: 'maintenance_mode',            value: false },
  ];

  for (const s of settings) {
    await PlatformSetting.updateOne({ key: s.key }, { $set: s }, { upsert: true });
  }
  console.log(`✅ Seeded ${settings.length} platform settings`);

  // ─── Default Admin ───────────────────────────────────────────────────────────
  const existingAdmin = await AdminUser.findOne({ email: 'admin@companicall.com' });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@123456', 12);
    await AdminUser.create({
      email: 'admin@companicall.com',
      passwordHash,
      role: 'super_admin',
      permissions: ['*'],
    });
    console.log('✅ Default admin created: admin@companicall.com / Admin@123456');
    console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!');
  } else {
    console.log('ℹ️  Admin already exists, skipping');
  }

  await mongoose.disconnect();
  console.log('\n🎉 Seed complete!');
};

run().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
