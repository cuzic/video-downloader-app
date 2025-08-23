import { describe, it, expect } from 'vitest';
import {
  sanitizeFilename,
  sanitizePath,
  validateInput,
  urlSchema,
  downloadSpecSchema,
} from '../validation';

describe('validation utilities', () => {
  describe('urlSchema', () => {
    it('should validate correct URLs', () => {
      expect(urlSchema.safeParse('https://example.com').success).toBe(true);
      expect(urlSchema.safeParse('http://localhost:3000').success).toBe(true);
      expect(urlSchema.safeParse('https://example.com/path/to/video.m3u8').success).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(urlSchema.safeParse('not a url').success).toBe(false);
      expect(urlSchema.safeParse('').success).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
      expect(sanitizeFilename('normal-file_name.mp4')).toBe('normal-file_name.mp4');
    });
  });

  // sanitizeString tests removed - function no longer exists in validation.ts

  describe('sanitizePath', () => {
    it('should remove directory traversal patterns', () => {
      expect(sanitizePath('../../../etc/passwd')).toBe('etc/passwd');
    });

    it('should handle normal paths', () => {
      expect(sanitizePath('/path/to/file')).toBe('path/to/file');
    });
  });

  describe('validateInput', () => {
    it('should validate correct input', () => {
      const result = validateInput(downloadSpecSchema, {
        url: 'https://example.com/video.m3u8',
        type: 'video',
        saveDir: '/downloads',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid input', () => {
      const result = validateInput(downloadSpecSchema, {
        url: 'not-a-url',
        type: 'video',
        saveDir: '/downloads',
      });
      expect(result.success).toBe(false);
    });
  });
});
