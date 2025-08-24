/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Universal mock utilities that work with both Bun and Vitest test runners
 */

// Type augmentation for global test runners
declare global {
  interface Window {
    vi?: any;
    jest?: any;
  }
}

interface MockFunction {
  (...args: any[]): any;
  mock: {
    calls: any[][];
    results: Array<{ type: 'return' | 'throw'; value: any }>;
  };
  mockClear(): void;
  mockReset(): void;
  mockImplementation(fn: (...args: any[]) => any): MockFunction;
  mockImplementationOnce(fn: (...args: any[]) => any): MockFunction;
  mockReturnValue(value: any): MockFunction;
  mockReturnValueOnce(value: any): MockFunction;
  mockResolvedValue(value: any): MockFunction;
  mockResolvedValueOnce(value: any): MockFunction;
  mockRejectedValue(value: any): MockFunction;
  mockRejectedValueOnce(value: any): MockFunction;
}

/**
 * Creates a mock function that tracks calls and can be configured
 * Works with both Bun's jest.fn and Vitest's vi.fn
 */
export function createMockFn(implementation?: (...args: any[]) => any): MockFunction {
  // Check if we're in Vitest environment
  if (typeof (globalThis as any).vi !== 'undefined') {
    return (globalThis as any).vi.fn(implementation) as MockFunction;
  }

  // Check if we're in Bun environment with jest compatibility
  if (
    typeof (globalThis as any).jest !== 'undefined' &&
    typeof (globalThis as any).jest.fn === 'function'
  ) {
    return (globalThis as any).jest.fn(implementation) as MockFunction;
  }

  // Fallback: Create a simple mock function for Bun
  const mockData = {
    calls: [] as any[][],
    results: [] as Array<{ type: 'return' | 'throw'; value: any }>,
    implementations: [] as Array<(...args: any[]) => any>,
    returnValues: [] as any[],
    returnValuesOnce: [] as any[],
    resolvedValues: [] as any[],
    resolvedValuesOnce: [] as any[],
    rejectedValues: [] as any[],
    rejectedValuesOnce: [] as any[],
  };

  let defaultImplementation = implementation;

  const mockFn = function (...args: any[]) {
    mockData.calls.push(args);

    // Check for one-time implementations
    if (mockData.implementations.length > 0) {
      const impl = mockData.implementations.shift();
      if (!impl) return undefined;
      try {
        const result = impl(...args);
        mockData.results.push({ type: 'return', value: result });
        return result;
      } catch (error) {
        mockData.results.push({ type: 'throw', value: error });
        throw error;
      }
    }

    // Check for one-time return values
    if (mockData.returnValuesOnce.length > 0) {
      const value = mockData.returnValuesOnce.shift();
      mockData.results.push({ type: 'return', value });
      return value;
    }

    // Check for one-time resolved values
    if (mockData.resolvedValuesOnce.length > 0) {
      const value = mockData.resolvedValuesOnce.shift();
      const promise = Promise.resolve(value);
      mockData.results.push({ type: 'return', value: promise });
      return promise;
    }

    // Check for one-time rejected values
    if (mockData.rejectedValuesOnce.length > 0) {
      const value = mockData.rejectedValuesOnce.shift();
      const promise = Promise.reject(value);
      mockData.results.push({ type: 'return', value: promise });
      return promise;
    }

    // Check for persistent return values
    if (mockData.returnValues.length > 0) {
      const value = mockData.returnValues[0];
      mockData.results.push({ type: 'return', value });
      return value;
    }

    // Check for persistent resolved values
    if (mockData.resolvedValues.length > 0) {
      const value = mockData.resolvedValues[0];
      const promise = Promise.resolve(value);
      mockData.results.push({ type: 'return', value: promise });
      return promise;
    }

    // Check for persistent rejected values
    if (mockData.rejectedValues.length > 0) {
      const value = mockData.rejectedValues[0];
      const promise = Promise.reject(value);
      mockData.results.push({ type: 'return', value: promise });
      return promise;
    }

    // Use default implementation
    if (defaultImplementation) {
      try {
        const result = defaultImplementation(...args);
        mockData.results.push({ type: 'return', value: result });
        return result;
      } catch (error) {
        mockData.results.push({ type: 'throw', value: error });
        throw error;
      }
    }

    // Return undefined by default
    mockData.results.push({ type: 'return', value: undefined });
    return undefined;
  } as MockFunction;

  // Add mock property
  Object.defineProperty(mockFn, 'mock', {
    get() {
      return {
        calls: mockData.calls,
        results: mockData.results,
      };
    },
  });

  // Add mock methods
  mockFn.mockClear = function () {
    mockData.calls = [];
    mockData.results = [];
    return mockFn;
  };

  mockFn.mockReset = function () {
    mockData.calls = [];
    mockData.results = [];
    mockData.implementations = [];
    mockData.returnValues = [];
    mockData.returnValuesOnce = [];
    mockData.resolvedValues = [];
    mockData.resolvedValuesOnce = [];
    mockData.rejectedValues = [];
    mockData.rejectedValuesOnce = [];
    defaultImplementation = undefined;
    return mockFn;
  };

  mockFn.mockImplementation = function (fn: (...args: any[]) => any) {
    defaultImplementation = fn;
    return mockFn;
  };

  mockFn.mockImplementationOnce = function (fn: (...args: any[]) => any) {
    mockData.implementations.push(fn);
    return mockFn;
  };

  mockFn.mockReturnValue = function (value: any) {
    mockData.returnValues = [value];
    return mockFn;
  };

  mockFn.mockReturnValueOnce = function (value: any) {
    mockData.returnValuesOnce.push(value);
    return mockFn;
  };

  mockFn.mockResolvedValue = function (value: any) {
    mockData.resolvedValues = [value];
    return mockFn;
  };

  mockFn.mockResolvedValueOnce = function (value: any) {
    mockData.resolvedValuesOnce.push(value);
    return mockFn;
  };

  mockFn.mockRejectedValue = function (value: any) {
    mockData.rejectedValues = [value];
    return mockFn;
  };

  mockFn.mockRejectedValueOnce = function (value: any) {
    mockData.rejectedValuesOnce.push(value);
    return mockFn;
  };

  return mockFn;
}

/**
 * Helper to check if we're in Vitest environment
 */
export function isVitest(): boolean {
  return typeof (globalThis as any).vi !== 'undefined';
}

/**
 * Helper to check if we're in Bun test environment
 */
export function isBunTest(): boolean {
  return (
    typeof (globalThis as any).Bun !== 'undefined' &&
    (typeof (globalThis as any).jest !== 'undefined' ||
      typeof (globalThis as any).test !== 'undefined')
  );
}
