// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_DEV_SERVER_URL = undefined;

// Global test utilities - only set up for vitest environment
if (typeof vi !== 'undefined') {
  const { vi } = await import('vitest');

  // Use the manual mock from __mocks__ directory
  vi.mock('electron');

  (global as any).testUtils = {
    createMockEvent: () => ({
      sender: {
        send: vi.fn(),
      },
      reply: vi.fn(),
    }),
  };
}
