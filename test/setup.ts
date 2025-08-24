import { jest } from '@jest/globals';

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Suppress console logs during tests (unless debugging)
  if (!process.env.DEBUG_TESTS) {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: console.error // Keep errors visible
    };
  }

  // Set AWS configuration for tests
  process.env.AWS_REGION = process.env.TEST_REGION || 'eu-north-1';
  
  // Ensure we don't accidentally hit production
  if (process.env.TEST_ENV === 'production') {
    throw new Error('Cannot run tests against production environment');
  }
  
  // Mock environment variables
  process.env.AUDIT_TABLE_NAME = 'test-audit-events-table';
  process.env.ENVIRONMENT = 'test';
  process.env.LOG_LEVEL = 'DEBUG';
});

// Global test teardown
afterAll(async () => {
  // Add any global cleanup here
});

export {};