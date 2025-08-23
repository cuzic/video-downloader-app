import { describe, it, expect, beforeEach } from 'bun:test';
import { NetworkSecurity } from '../network-security';

describe('NetworkSecurity', () => {
  beforeEach(() => {
    NetworkSecurity.clearRateLimitCache();
  });

  describe('isUrlSafe', () => {
    it('should accept valid HTTPS URLs', () => {
      const result = NetworkSecurity.isUrlSafe('https://example.com/video.mp4');
      expect(result.safe).toBe(true);
    });

    it('should warn about HTTP URLs but allow them', () => {
      const result = NetworkSecurity.isUrlSafe('http://example.com/video.mp4');
      expect(result.safe).toBe(true);
    });

    it('should reject non-HTTP(S) protocols', () => {
      const result = NetworkSecurity.isUrlSafe('file:///etc/passwd');
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('Invalid protocol');
    });

    it('should reject local/internal addresses (SSRF prevention)', () => {
      const localUrls = [
        'http://127.0.0.1/test',
        'http://localhost/test',
        'http://192.168.1.1/test',
        'http://10.0.0.1/test',
        'http://172.16.0.1/test',
        'http://[::1]/test',
      ];

      localUrls.forEach((url) => {
        const result = NetworkSecurity.isUrlSafe(url);
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('SSRF prevention');
      });
    });

    it('should reject URLs with suspicious patterns', () => {
      const suspiciousUrls = [
        'https://example.com/<script>alert(1)</script>',
        'https://example.com/test?param=javascript:alert(1)',
        'https://example.com/../../../etc/passwd',
        'https://example.com/test%00.txt',
        "https://example.com/test'; DROP TABLE users--",
      ];

      suspiciousUrls.forEach((url) => {
        const result = NetworkSecurity.isUrlSafe(url);
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Suspicious URL pattern');
      });
    });

    it('should reject invalid URL formats', () => {
      const result = NetworkSecurity.isUrlSafe('not a url');
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('Invalid URL format');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const identifier = 'test-host';

      for (let i = 0; i < 10; i++) {
        expect(NetworkSecurity.checkRateLimit(identifier)).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', () => {
      const identifier = 'test-host';

      // Make maximum allowed requests
      for (let i = 0; i < 100; i++) {
        NetworkSecurity.checkRateLimit(identifier);
      }

      // Next request should be blocked
      expect(NetworkSecurity.checkRateLimit(identifier)).toBe(false);
    });

    it('should track different identifiers separately', () => {
      const id1 = 'host1';
      const id2 = 'host2';

      for (let i = 0; i < 50; i++) {
        expect(NetworkSecurity.checkRateLimit(id1)).toBe(true);
        expect(NetworkSecurity.checkRateLimit(id2)).toBe(true);
      }
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return null for unknown identifier', () => {
      expect(NetworkSecurity.getRateLimitStatus('unknown')).toBeNull();
    });

    it('should return correct status after requests', () => {
      const identifier = 'test-host';

      for (let i = 0; i < 10; i++) {
        NetworkSecurity.checkRateLimit(identifier);
      }

      const status = NetworkSecurity.getRateLimitStatus(identifier);
      expect(status).toBeTruthy();
      expect(status?.count).toBe(10);
      expect(status?.remaining).toBe(90);
    });
  });

  describe('domain management', () => {
    it('should handle whitelist correctly', () => {
      NetworkSecurity.addWhitelistedDomain('trusted.com');

      // When whitelist is configured, only whitelisted domains should be allowed
      const trusted = NetworkSecurity.isUrlSafe('https://trusted.com/test');
      const untrusted = NetworkSecurity.isUrlSafe('https://untrusted.com/test');

      expect(trusted.safe).toBe(true);
      expect(untrusted.safe).toBe(false);
      expect(untrusted.reason).toContain('not in whitelist');

      // Clean up
      NetworkSecurity.removeWhitelistedDomain('trusted.com');
    });

    it('should handle blacklist correctly', () => {
      NetworkSecurity.addBlacklistedDomain('malicious.com');

      const result = NetworkSecurity.isUrlSafe('https://malicious.com/test');
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('blacklisted');

      // Clean up
      NetworkSecurity.removeBlacklistedDomain('malicious.com');
    });
  });
});
