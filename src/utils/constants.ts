export const COINS_PER_INR = 60;
export const HOST_SHARE_PERCENT = 30;
export const PLATFORM_SHARE_PERCENT = 70;
export const VOICE_DISCOUNT_PERCENT = 10; // voice = video * 0.9
export const MIN_BALANCE_TO_CALL_SECONDS = 180; // 3 minutes
export const LOW_BALANCE_WARNING_SECONDS = 60;  // warn when < 60s left
export const SESSION_EXPIRY_DAYS = 30;
export const JWT_EXPIRY = '7d';
export const MAX_QUEUE_SIZE = 10;
export const QUEUE_TIMEOUT_MINUTES = 10;
export const CALL_RING_TIMEOUT_SECONDS = 30;
export const BILLING_TICK_INTERVAL_MS = 5000; // 5 seconds
export const MIN_CALL_BILLING_SECONDS = 180;  // 3 minutes minimum
export const STALE_CALL_SECONDS = 30;         // no billing tick for this long → caller gone, auto-settle
export const MAX_CALL_DURATION_SECONDS = 7200; // 2h hard cap, force-settle
export const CALL_SWEEP_INTERVAL_MS = 20000;  // how often the stale-call sweeper runs
export const MIN_WITHDRAWAL_COINS = 12000;    // ~₹200
export const WELCOME_BONUS_COINS = 500;       // Free coins on signup
export const REFERRAL_BONUS_COINS = 500;      // Coins credited to referrer on referred user's first purchase
export const FIRST_PURCHASE_BONUS_PERCENT = 20; // Extra 20% coins on first purchase
export const DAILY_STREAK_COINS = [50, 100, 150, 200, 250, 350, 500]; // Day 1-7 streak rewards

export const REDIS_KEYS = {
  hostOnline: (userId: string) => `host:online:${userId}`,
  hostBusy: (userId: string) => `host:busy:${userId}`,
  callActive: (callId: string) => `call:active:${callId}`,
  callBilling: (callId: string) => `call:billing:${callId}`,
  userSocket: (userId: string) => `user:socket:${userId}`,
  userSession: (sessionId: string) => `user:session:${sessionId}`,
  queue: (hostId: string) => `queue:${hostId}`,
  otpCode: (phone: string) => `otp:${phone}`,
};
