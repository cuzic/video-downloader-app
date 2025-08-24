// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_DEV_SERVER_URL = undefined;

// Only setup vitest-specific mocks if we're in vitest environment
if (typeof process.env.VITEST !== 'undefined') {
  const { vi } = await import('vitest');

  // Use the manual mock from __mocks__ directory
  vi.mock('electron');

  // Global test utilities
  (global as any).testUtils = {
    createMockEvent: () => ({
      sender: {
        send: vi.fn(),
      },
      reply: vi.fn(),
    }),
  };
}

// Make this file a module
export {};
