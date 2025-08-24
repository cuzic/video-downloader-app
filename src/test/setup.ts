/**
 * Universal test setup that works with both Bun and Vitest
 */
import { createMockFn, isVitest, isBunTest } from './mock-utils';

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_DEV_SERVER_URL = undefined;

// Setup mocks based on test runner
if (isVitest()) {
  // Vitest-specific setup
  const { vi } = await import('vitest');

  // Use the manual mock from __mocks__ directory
  vi.mock('electron');

  // Global test utilities for Vitest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).testUtils = {
    createMockEvent: () => ({
      sender: {
        send: vi.fn(),
      },
      reply: vi.fn(),
    }),
    createMockFn: vi.fn,
  };
} else if (isBunTest()) {
  // Bun-specific setup
  // For Bun, we need to use a different approach since it doesn't have vi.mock
  // We'll use Bun's mock system if available, or provide a fallback

  // Global test utilities for Bun
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).testUtils = {
    createMockEvent: () => ({
      sender: {
        send: createMockFn(),
      },
      reply: createMockFn(),
    }),
    createMockFn,
  };
}

// Common test utilities available for both runners
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).testHelpers = {
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  mockConsole: () => {
    const originalConsole = { ...console };
    const mocks = {
      log: createMockFn(),
      error: createMockFn(),
      warn: createMockFn(),
      info: createMockFn(),
    };

    Object.assign(console, mocks);

    return {
      mocks,
      restore: () => Object.assign(console, originalConsole),
    };
  },
};

// Make this file a module
export {};
