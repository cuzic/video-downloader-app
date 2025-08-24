import { expect } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Type-safe assertion for mock function calls
 * @param mock Mock function to check
 * @param args Expected arguments
 */
export function expectMockCalled<T extends (...args: any[]) => any>(
  mock: T | Mock<T>,
  ...args: Parameters<T>
): void {
  expect(mock).toHaveBeenCalledWith(...args);
}

/**
 * Type-safe assertion for mock function call count
 * @param mock Mock function to check
 * @param times Expected number of calls
 */
export function expectMockCalledTimes<T extends (...args: any[]) => any>(
  mock: T | Mock<T>,
  times: number
): void {
  expect(mock).toHaveBeenCalledTimes(times);
}

/**
 * Type-safe assertion for last mock call
 * @param mock Mock function to check
 * @param args Expected arguments for last call
 */
export function expectLastMockCall<T extends (...args: any[]) => any>(
  mock: T | Mock<T>,
  ...args: Parameters<T>
): void {
  expect(mock).toHaveBeenLastCalledWith(...args);
}

/**
 * Type-safe assertion for nth mock call
 * @param mock Mock function to check
 * @param nth Call index (1-based)
 * @param args Expected arguments for nth call
 */
export function expectNthMockCall<T extends (...args: any[]) => any>(
  mock: T | Mock<T>,
  nth: number,
  ...args: Parameters<T>
): void {
  expect(mock).toHaveBeenNthCalledWith(nth, ...args);
}

/**
 * Type-safe assertion for mock not being called
 * @param mock Mock function to check
 */
export function expectMockNotCalled<T extends (...args: any[]) => any>(mock: T | Mock<T>): void {
  expect(mock).not.toHaveBeenCalled();
}

/**
 * Type-safe assertion for mock return value
 * @param mock Mock function to check
 * @param value Expected return value
 */
export function expectMockReturned<T extends (...args: any[]) => any>(
  mock: T | Mock<T>,
  value: ReturnType<T>
): void {
  expect(mock).toHaveReturnedWith(value);
}

/**
 * Type-safe assertion for mock resolved value (async)
 * @param mock Mock function to check
 * @param value Expected resolved value
 */
export async function expectMockResolved<T extends (...args: any[]) => Promise<any>>(
  mock: T | Mock<T>,
  value: Awaited<ReturnType<T>>
): Promise<void> {
  const result = await (mock as Mock).mock.results[0]?.value;
  expect(result).toEqual(value);
}

/**
 * Type-safe assertion for mock rejection (async)
 * @param mock Mock function to check
 * @param error Expected error
 */
export function expectMockRejected<T extends (...args: any[]) => Promise<any>>(
  mock: T | Mock<T>,
  error?: unknown
): void {
  const mockResult = (mock as Mock).mock.results[0];
  expect(mockResult?.type).toBe('throw');
  if (error !== undefined) {
    expect(mockResult?.value).toEqual(error);
  }
}

/**
 * Helper to get mock call arguments in a type-safe way
 * @param mock Mock function
 * @param callIndex Call index (0-based)
 * @returns Call arguments
 */
export function getMockCallArgs<T extends (...args: any[]) => any>(
  mock: T | Mock<T>,
  callIndex = 0
): Parameters<T> | undefined {
  return (mock as Mock).mock.calls[callIndex] as Parameters<T> | undefined;
}

/**
 * Helper to get all mock call arguments
 * @param mock Mock function
 * @returns Array of call arguments
 */
export function getAllMockCallArgs<T extends (...args: any[]) => any>(
  mock: T | Mock<T>
): Parameters<T>[] {
  return (mock as Mock).mock.calls as Parameters<T>[];
}

/**
 * Type-safe assertion for checking if mock was called with partial object match
 * @param mock Mock function to check
 * @param partial Partial object to match
 */
export function expectMockCalledWithPartial<T extends (arg: any) => any>(
  mock: T | Mock<T>,
  partial: Partial<Parameters<T>[0]>
): void {
  expect(mock).toHaveBeenCalledWith(expect.objectContaining(partial as any));
}

/**
 * Type-safe assertion for checking if any call matches predicate
 * @param mock Mock function to check
 * @param predicate Function to test each call
 */
export function expectMockCalledWithPredicate<T extends (...args: any[]) => any>(
  mock: T | Mock<T>,
  predicate: (...args: Parameters<T>) => boolean
): void {
  const calls = getAllMockCallArgs(mock);
  const hasMatch = calls.some((args) => predicate(...args));
  expect(hasMatch).toBe(true);
}
