import { describe, it, expect } from 'vitest';
import { 
  sanitizeFilename,
  sanitizeString,
  sanitizePath,
  validateInput,
  urlSchema,
  downloadSpecSchema
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
      expect(urlSchema.safeParse('javascript:alert(1)').success).toBe(false);
      expect(urlSchema.safeParse('').success).toBe(false);
      expect(urlSchema.safeParse('ftp://example.com').success).toBe(false); // Only HTTP/HTTPS allowed
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
      expect(sanitizeFilename('normal-file_name.mp4')).toBe('normal-file_name.mp4');
    });

    it('should handle control characters', () => {
      // \x00 and \x1f are removed, \x7f (DEL) is not in the regex range
      expect(sanitizeFilename('file\x00\x1f\x7f.txt')).toBe('file__\x7f.txt');
    });

    it('should preserve file extension when truncating', () => {
      const longName = 'a'.repeat(300) + '.mp4';
      const result = sanitizeFilename(longName, 255);
      expect(result).toHaveLength(255);
      expect(result.endsWith('.mp4')).toBe(true);
    });

    it('should handle filenames without extensions', () => {
      const longName = 'a'.repeat(300);
      const result = sanitizeFilename(longName, 255);
      expect(result).toHaveLength(255);
      expect(result).toBe('a'.repeat(255));
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML-like characters', () => {
      expect(sanitizeString('<script>alert("test")</script>')).toBe('scriptalert("test")/script');
    });

    it('should remove control characters', () => {
      expect(sanitizeString('hello\x00world\x1F!')).toBe('helloworld!');
    });

    it('should respect max length', () => {
      const longString = 'a'.repeat(2000);
      expect(sanitizeString(longString, 100)).toHaveLength(100);
    });
  });

  describe('sanitizePath', () => {
    it('should remove null bytes', () => {
      expect(sanitizePath('/path/to\x00/file')).toBe('/path/to/file');
    });

    it('should normalize slashes', () => {
      expect(sanitizePath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
    });

    it('should remove duplicate slashes', () => {
      expect(sanitizePath('//path//to///file')).toBe('/path/to/file');
    });
  });

  describe('validateInput', () => {
    it('should validate correct input', () => {
      const result = validateInput(downloadSpecSchema, {
        url: 'https://example.com/video.m3u8',
        outputPath: '/downloads/video.mp4',
        quality: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid input', () => {
      const result = validateInput(downloadSpecSchema, {
        url: 'not-a-url',
        outputPath: '/downloads/video.mp4',
      });
      expect(result.success).toBe(false);
    });
  });
});