import { test, expect, describe } from 'bun:test';
import { withContext, getCid, getContext, enrich } from './context';
import { maskPIIString } from './formats';

describe('Logging Context', () => {
  test('should generate unique correlation IDs', () => {
    const cids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      withContext(() => {
        const cid = getCid();
        expect(cid).toBeTruthy();
        expect(typeof cid).toBe('string');
        cids.add(cid);
      });
    }

    expect(cids.size).toBe(100);
  });

  test('should maintain context through nested calls', () => {
    let outerCid: string | undefined;
    let innerCid: string | undefined;

    withContext(() => {
      outerCid = getCid();

      withContext(
        () => {
          innerCid = getCid();
        },
        { cid: 'custom-cid' }
      );
    });

    expect(outerCid).toBeTruthy();
    expect(innerCid).toBe('custom-cid');
    expect(outerCid).not.toBe(innerCid);
  });

  test('should enrich metadata with context', () => {
    withContext(() => {
      const enriched = enrich({ foo: 'bar' });

      expect(enriched).toHaveProperty('foo', 'bar');
      expect(enriched).toHaveProperty('cid');
      expect(typeof enriched.cid).toBe('string');
    });
  });

  test('should handle undefined context gracefully', () => {
    const context = getContext();
    expect(context).toBeUndefined();

    const cid = getCid();
    expect(cid).toBeUndefined();

    const enriched = enrich({ test: true });
    expect(enriched).toEqual({ test: true });
  });
});

describe('PII Masking', () => {
  test('should mask email addresses', () => {
    const input = 'Contact user@example.com for details';
    const masked = maskPIIString(input);
    expect(masked).toBe('Contact ***@***.*** for details');
  });

  test('should mask credit card numbers', () => {
    const inputs = ['4111111111111111', '4111-1111-1111-1111', '4111 1111 1111 1111'];

    inputs.forEach((input) => {
      const masked = maskPIIString(input);
      expect(masked).not.toContain('4111');
      expect(masked).toContain('****');
    });
  });

  test('should mask Social Security Numbers', () => {
    const inputs = ['123-45-6789', '123 45 6789', '123456789'];

    inputs.forEach((input) => {
      const masked = maskPIIString(input);
      expect(masked).toContain('***-**-****');
    });
  });

  test('should mask phone numbers', () => {
    const inputs = ['555-123-4567', '(555) 123-4567', '+1-555-123-4567', '555.123.4567'];

    inputs.forEach((input) => {
      const masked = maskPIIString(input);
      expect(masked).not.toContain('123');
      expect(masked).not.toContain('4567');
    });
  });

  test('should mask IP addresses', () => {
    const inputs = ['192.168.1.1', '10.0.0.1', '172.16.0.1'];

    inputs.forEach((input) => {
      const masked = maskPIIString(input);
      expect(masked).toBe('***.***.***');
    });
  });

  test('should handle objects with PII', () => {
    const obj = {
      email: 'test@example.com',
      phone: '555-123-4567',
      data: 'normal data',
    };

    const jsonStr = JSON.stringify(obj);
    const masked = maskPIIString(jsonStr);
    expect(masked).toContain('***@***.***');
    expect(masked).not.toContain('test@example.com');
    expect(masked).not.toContain('555-123-4567');
    expect(masked).toContain('normal data');
  });

  test('should not mask non-PII data', () => {
    const input = 'This is normal text with numbers 12345';
    const masked = maskPIIString(input);
    expect(masked).toBe(input);
  });
});
