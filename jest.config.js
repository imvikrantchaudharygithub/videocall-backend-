/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/jest.setup.ts'],
  testTimeout: 60000,
  transform: { '^.+\\.ts$': 'ts-jest' },
  // mongodb-memory-server + ioredis-mock keep the suite self-contained (no real DB/Redis).
};
