import Redis from 'ioredis';
import { ENV } from './env';

const redis = new Redis(ENV.REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err));

export default redis;
