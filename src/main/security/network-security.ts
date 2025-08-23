import { net } from 'electron';
import { URL } from 'url';

/**
 * Network Security Manager
 */
export class NetworkSecurity {
  // Rate limiting
  private static requestCounts = new Map<string, { count: number; resetTime: number }>();
  private static readonly RATE_LIMIT = 100; // requests per minute
  private static readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms
  
  // Request timeout
  private static readonly REQUEST_TIMEOUT = 30 * 1000; // 30 seconds
  
  // Blocked patterns
  private static blockedPatterns = [
    // Local network addresses (SSRF prevention)
    /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/,
    /^localhost$/i,
    /^0\.0\.0\.0$/,
    /^\[::1\]$/,
    /^\[fc00::/,
    /^\[fe80::/,
    
    // File URLs
    /^file:/i,
    
    // Other internal protocols
    /^(about|chrome|chrome-extension|chrome-devtools):/i,
  ];
  
  // Domain whitelist (optional)
  private static whitelistedDomains = new Set<string>();
  
  // Domain blacklist
  private static blacklistedDomains = new Set<string>([
    // Add known malicious domains here
  ]);
  
  /**
   * Validate URL before processing
   */
  static isUrlSafe(url: string): { safe: boolean; reason?: string } {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { safe: false, reason: 'Invalid protocol' };
      }
      
      // Prefer HTTPS
      if (urlObj.protocol === 'http:' && !this.isLocalDevelopment(urlObj)) {
        console.warn(`HTTP URL detected, consider using HTTPS: ${url}`);
      }
      
      // Check for local/internal addresses
      const hostname = urlObj.hostname;
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(hostname)) {
          return { safe: false, reason: 'Internal/local address blocked (SSRF prevention)' };
        }
      }
      
      // Check blacklist
      if (this.blacklistedDomains.has(hostname)) {
        return { safe: false, reason: 'Domain is blacklisted' };
      }
      
      // Check whitelist if configured
      if (this.whitelistedDomains.size > 0 && !this.whitelistedDomains.has(hostname)) {
        return { safe: false, reason: 'Domain not in whitelist' };
      }
      
      // Check for suspicious patterns
      if (this.hasSuspiciousPatterns(url)) {
        return { safe: false, reason: 'Suspicious URL pattern detected' };
      }
      
      return { safe: true };
    } catch (error) {
      return { safe: false, reason: 'Invalid URL format' };
    }
  }
  
  /**
   * Check if URL is local development
   */
  private static isLocalDevelopment(urlObj: URL): boolean {
    return urlObj.hostname === 'localhost' && 
           urlObj.port === '5173' && 
           process.env.NODE_ENV === 'development';
  }
  
  /**
   * Check for suspicious patterns in URL
   */
  private static hasSuspiciousPatterns(url: string): boolean {
    const suspicious = [
      // Double URL encoding
      /%25/i,
      // Null bytes
      /%00/i,
      // Directory traversal
      /\.\./,
      // SQL injection patterns
      /('|(--|\/\*|\*\/|;))/i,
      // XSS patterns
      /(<script|javascript:|onerror=|onload=)/i,
    ];
    
    return suspicious.some(pattern => pattern.test(url));
  }
  
  /**
   * Check rate limiting
   */
  static checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const record = this.requestCounts.get(identifier);
    
    if (!record || now > record.resetTime) {
      // Create new record or reset expired one
      this.requestCounts.set(identifier, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return true;
    }
    
    if (record.count >= this.RATE_LIMIT) {
      console.warn(`Rate limit exceeded for ${identifier}`);
      return false;
    }
    
    record.count++;
    return true;
  }
  
  /**
   * Create secure request with timeout
   */
  static createSecureRequest(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      // Validate URL
      const validation = this.isUrlSafe(url);
      if (!validation.safe) {
        reject(new Error(`URL validation failed: ${validation.reason}`));
        return;
      }
      
      // Check rate limiting
      const urlObj = new URL(url);
      if (!this.checkRateLimit(urlObj.hostname)) {
        reject(new Error('Rate limit exceeded'));
        return;
      }
      
      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, options.timeout || this.REQUEST_TIMEOUT);
      
      // Create request
      const request = net.request({
        url,
        ...options,
      });
      
      // Handle response
      request.on('response', (response) => {
        clearTimeout(timeout);
        
        // Validate response
        if (!this.isResponseSafe(response)) {
          reject(new Error('Unsafe response detected'));
          return;
        }
        
        resolve(response);
      });
      
      // Handle error
      request.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      
      // Send request
      request.end();
    });
  }
  
  /**
   * Validate response headers for security
   */
  private static isResponseSafe(response: any): boolean {
    const headers = response.headers;
    
    // Check for security headers
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security',
    ];
    
    // Log missing security headers (informational)
    securityHeaders.forEach(header => {
      if (!headers[header]) {
        console.info(`Missing security header: ${header}`);
      }
    });
    
    // Check content type
    const contentType = headers['content-type'];
    if (contentType && contentType.includes('text/html')) {
      // Extra validation for HTML content
      console.warn('HTML content detected, ensure proper sanitization');
    }
    
    return true;
  }
  
  /**
   * Add domain to whitelist
   */
  static addWhitelistedDomain(domain: string): void {
    this.whitelistedDomains.add(domain.toLowerCase());
  }
  
  /**
   * Remove domain from whitelist
   */
  static removeWhitelistedDomain(domain: string): void {
    this.whitelistedDomains.delete(domain.toLowerCase());
  }
  
  /**
   * Add domain to blacklist
   */
  static addBlacklistedDomain(domain: string): void {
    this.blacklistedDomains.add(domain.toLowerCase());
  }
  
  /**
   * Remove domain from blacklist
   */
  static removeBlacklistedDomain(domain: string): void {
    this.blacklistedDomains.delete(domain.toLowerCase());
  }
  
  /**
   * Clear rate limit cache
   */
  static clearRateLimitCache(): void {
    this.requestCounts.clear();
  }
  
  /**
   * Get rate limit status for identifier
   */
  static getRateLimitStatus(identifier: string): { count: number; remaining: number; resetTime: number } | null {
    const record = this.requestCounts.get(identifier);
    if (!record) {
      return null;
    }
    
    return {
      count: record.count,
      remaining: Math.max(0, this.RATE_LIMIT - record.count),
      resetTime: record.resetTime,
    };
  }
}