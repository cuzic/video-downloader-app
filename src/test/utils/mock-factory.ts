import { vi } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Creates a mock object with specified methods as vi.fn() mocks
 * @param methods Array of method names to mock
 * @returns Mock object with all specified methods as vi.fn()
 */
export function createMockWithMethods<T>(methods: readonly (keyof T)[]): T {
  const mock = {} as T;
  methods.forEach((method) => {
    (mock as any)[method] = vi.fn();
  });
  return mock;
}

/**
 * Creates a partial mock with only specified methods
 * @param methods Object with method names as keys and implementations as values
 * @returns Partial mock object
 */
export function createPartialMock<T>(methods: Partial<{ [K in keyof T]: T[K] | Mock }>): T {
  const mock = {} as T;
  Object.entries(methods).forEach(([key, value]) => {
    (mock as any)[key] = typeof value === 'function' ? value : vi.fn(value as any);
  });
  return mock;
}

/**
 * Type helper to extract mock type from a mocked object
 */
export type MockedObject<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? Mock<T[K]> : T[K];
};

/**
 * Creates a deep mock of an object with nested properties
 * @param structure Object structure to mock
 * @returns Deep mock object
 */
export function createDeepMock<T>(structure: DeepMockStructure<T>): T {
  const mock = {} as T;

  Object.entries(structure).forEach(([key, value]) => {
    if (value === 'function') {
      (mock as any)[key] = vi.fn();
    } else if (typeof value === 'object' && value !== null) {
      (mock as any)[key] = createDeepMock(value);
    } else {
      (mock as any)[key] = value;
    }
  });

  return mock;
}

type DeepMockStructure<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? 'function' | Mock
    : T[K] extends object
      ? DeepMockStructure<T[K]>
      : T[K];
};

/**
 * Creates a mock with chainable methods
 * @param methods Methods that should return 'this' for chaining
 * @returns Mock object with chainable methods
 */
export function createChainableMock<T>(methods: readonly (keyof T)[]): T {
  const mock = {} as T;
  methods.forEach((method) => {
    (mock as any)[method] = vi.fn().mockReturnValue(mock);
  });
  return mock;
}

/**
 * Creates a mock that tracks property access
 * @param properties Properties to track
 * @returns Mock object with tracked properties
 */
export function createPropertyMock<T>(
  properties: Partial<T>
): T & { __getters: Map<keyof T, Mock> } {
  const getters = new Map<keyof T, Mock>();
  const mock = { __getters: getters } as T & { __getters: Map<keyof T, Mock> };

  Object.entries(properties).forEach(([key, value]) => {
    const getter = vi.fn(() => value);
    getters.set(key as keyof T, getter);
    Object.defineProperty(mock, key, {
      get: getter,
      configurable: true,
    });
  });

  return mock;
}
