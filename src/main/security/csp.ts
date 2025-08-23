import { session } from 'electron';

/**
 * Content Security Policy configuration
 */
export const CSP_POLICIES = {
  development: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'http://localhost:*'],
    'style-src': ["'self'", "'unsafe-inline'", 'http://localhost:*'],
    'img-src': ["'self'", 'data:', 'https:', 'http://localhost:*'],
    'connect-src': ["'self'", 'https:', 'http://localhost:*', 'ws://localhost:*'],
    'font-src': ["'self'", 'data:'],
    'object-src': ["'none'"],
    'media-src': ["'self'", 'https:', 'blob:'],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  },
  production: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Allow inline styles for UI libraries
    'img-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", 'https:'],
    'font-src': ["'self'", 'data:'],
    'object-src': ["'none'"],
    'media-src': ["'self'", 'https:', 'blob:'],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
    'block-all-mixed-content': [],
  },
};

/**
 * Generate CSP header string from policy object
 */
function generateCSPString(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Apply Content Security Policy to the application
 */
export function applyCSP(): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const policy = isDevelopment ? CSP_POLICIES.development : CSP_POLICIES.production;
  const cspString = generateCSPString(policy);
  
  // Apply CSP to all sessions
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Content-Security-Policy': [cspString],
    };
    
    // Add additional security headers
    responseHeaders['X-Content-Type-Options'] = ['nosniff'];
    responseHeaders['X-Frame-Options'] = ['DENY'];
    responseHeaders['X-XSS-Protection'] = ['1; mode=block'];
    responseHeaders['Referrer-Policy'] = ['strict-origin-when-cross-origin'];
    responseHeaders['Permissions-Policy'] = [
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    ];
    
    callback({ responseHeaders });
  });
  
  // Log CSP violations in development
  if (isDevelopment) {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['csp-report:*'] },
      (details) => {
        console.warn('CSP Violation:', details.url);
      }
    );
  }
}

/**
 * Get CSP meta tag content for HTML
 */
export function getCSPMetaContent(): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const policy = isDevelopment ? CSP_POLICIES.development : CSP_POLICIES.production;
  return generateCSPString(policy);
}