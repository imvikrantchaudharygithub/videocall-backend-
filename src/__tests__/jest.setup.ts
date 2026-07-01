// Runs before any module is imported.
// 1) Hermetic secrets so tests don't depend on the real .env.
process.env.SECRET_KEY = 'test_user_secret';
process.env.ADMIN_SECRET_KEY = 'test_admin_secret';
process.env.ENABLE_DEV_LOGIN = 'false';

// 2) Use an in-memory Redis everywhere (config/redis.ts imports 'ioredis').
jest.mock('ioredis', () => require('ioredis-mock'));
