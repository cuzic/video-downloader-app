// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_DEV_SERVER_URL = undefined;

// Make this file a module
export {};

// Global test utilities - only set up for vitest environment
void (async () => {
  if (typeof vi !== 'undefined') {
    const { vi } = await import('vitest');

    // Use the manual mock from __mocks__ directory
    vi.mock('electron');

    (global as unknown as any).testUtils = {
      createMockEvent: () => ({
        sender: {
          send: vi.fn(),
        },
        reply: vi.fn(),
      }),
    };
  }
})();
