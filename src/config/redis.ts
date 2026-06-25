import Redis from 'ioredis';
import { ENV } from './env';

const redis = new Redis(ENV.REDIS_URL, {
  lazyConnect: true,
  // null = never throw MaxRetriesPerRequestError. Without this, a missing/blipping
  // Redis exhausts the 20-retry limit and the unhandled rejection CRASHES the server.
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

redis.on('connect', () => console.log('✅ Redis connected'));
// Throttle error logging so a down Redis doesn't spam the logs, and never crash.
let lastRedisErrLog = 0;
redis.on('error', (err) => {
  const now = Date.now();
  if (now - lastRedisErrLog > 10000) {
    console.error('❌ Redis error:', (err as Error).message);
    lastRedisErrLog = now;
  }
});

export default redis;
