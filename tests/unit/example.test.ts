/**
 * Example unit test file
 * Run with: bun test or mise run test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('Example Unit Tests', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });

  it('should work with objects', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj).toEqual({ name: 'test', value: 42 });
    expect(obj.name).toBe('test');
  });

  it('should handle errors', () => {
    expect(() => {
      throw new Error('Test error');
    }).toThrow('Test error');
  });
});

describe('Math utilities', () => {
  it('should add numbers correctly', () => {
    const add = (a: number, b: number) => a + b;
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
    expect(add(0.1, 0.2)).toBeCloseTo(0.3);
  });

  it('should handle edge cases', () => {
    const divide = (a: number, b: number) => {
      if (b === 0) throw new Error('Division by zero');
      return a / b;
    };

    expect(divide(10, 2)).toBe(5);
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });
});