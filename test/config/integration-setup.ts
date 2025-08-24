/**
 * Integration test setup
 * Configures AWS SDK clients and test environment
 */

import { config } from 'aws-sdk';

// Set AWS region for tests
process.env.AWS_REGION = process.env.AWS_REGION || 'eu-north-1';

// Configure AWS SDK to use test credentials if running locally
if (!process.env.CI) {
  config.update({
    region: process.env.AWS_REGION,
    // Use local credentials for development
  });
}

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TEST_ENV = process.env.TEST_ENV || 'test';

// Mock console methods in tests to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Increase timeout for integration tests
jest.setTimeout(60000);