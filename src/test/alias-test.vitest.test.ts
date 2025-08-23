import { describe, it, expect } from 'vitest';
// Test path aliases work with Vitest
import { sanitizeFilename } from '@shared/validation';
import type { DownloadSpec } from '@shared/types';

describe('Path aliases work with Vitest', () => {
  it('should import from @shared alias', () => {
    const result = sanitizeFilename('test<>file.txt');
    expect(result).toBe('test__file.txt');
  });

  it('should resolve type imports from aliases', () => {
    const spec: DownloadSpec = {
      url: 'https://example.com/video.m3u8',
      type: 'hls',
    };
    expect(spec.url).toBe('https://example.com/video.m3u8');
  });
});
