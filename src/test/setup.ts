import { vi } from 'vitest';

// Use the manual mock from __mocks__ directory
vi.mock('electron');

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_DEV_SERVER_URL = undefined;

// Global test utilities
(global as any).testUtils = {
  createMockEvent: () => ({
    sender: {
      send: vi.fn(),
    },
    reply: vi.fn(),
  }),
};