# Security Documentation

## Overview

This document outlines the comprehensive security measures implemented in the Video Downloader application to protect against common vulnerabilities and ensure safe operation.

## Security Architecture

### 1. Process Isolation

- **Context Isolation**: Enabled to ensure renderer processes cannot access Node.js APIs directly
- **Sandbox Mode**: All renderer processes run in a sandboxed environment
- **No Node Integration**: Node.js integration is completely disabled in renderer processes
- **IPC Validation**: All IPC communication is validated using Zod schemas

### 2. BrowserWindow Security Configuration

```typescript
webPreferences: {
  contextIsolation: true,          // Isolate context between main and renderer
  nodeIntegration: false,          // Disable Node.js in renderer
  sandbox: true,                   // Enable sandbox
  webSecurity: true,               // Enable web security
  allowRunningInsecureContent: false,  // Block insecure content
  experimentalFeatures: false,     // Disable experimental features
  webviewTag: false,              // Disable webview tag
  navigateOnDragDrop: false,      // Prevent navigation on drag-drop
}
```

### 3. Content Security Policy (CSP)

The application implements strict CSP headers with different policies for development and production:

**Production CSP**:
- `default-src 'self'` - Only allow resources from same origin
- `script-src 'self'` - Only allow scripts from same origin
- `connect-src 'self' https:` - Only allow HTTPS connections
- `frame-src 'none'` - Prevent iframe embedding
- Additional security headers: X-Frame-Options, X-Content-Type-Options, etc.

### 4. Path Validation

The `PathValidator` class provides comprehensive path security:

- **Absolute Path Requirement**: Only absolute paths are accepted
- **Directory Traversal Prevention**: Blocks `..` and `~` patterns
- **Null Byte Protection**: Prevents poison null byte attacks
- **Allowed Directories**: Restricts file operations to specific directories
- **Extension Validation**: Only allows safe file extensions
- **Filename Sanitization**: Removes dangerous characters from filenames

### 5. Network Security

The `NetworkSecurity` class implements:

- **URL Validation**: Validates all URLs before processing
- **SSRF Prevention**: Blocks local/internal network addresses
- **HTTPS Preference**: Warns about HTTP usage, enforces HTTPS where possible
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Domain Management**: Whitelist/blacklist functionality
- **Request Timeout**: Automatic timeout for network requests
- **Suspicious Pattern Detection**: Blocks URLs with injection attempts

### 6. DRM Protection

The `DRMDetector` class prevents downloading DRM-protected content:

- **Domain Blacklist**: Blocks known DRM-protected services
- **EME API Detection**: Detects Encrypted Media Extensions usage
- **Manifest Analysis**: Scans for DRM indicators in manifest files
- **User Notification**: Clear messaging when DRM content is detected
- **Audit Logging**: Logs all DRM detection events

### 7. Legal Compliance

The `LegalConsentManager` ensures legal compliance:

- **First Launch Consent**: Requires user agreement before first use
- **Terms Display**: Shows terms in user's language (Japanese/English)
- **Consent Storage**: Records consent timestamp and version
- **Disclaimer**: Clear disclaimer about educational/private use only
- **Version Tracking**: Re-prompts consent when terms change

### 8. Input Validation

All user inputs are validated using Zod schemas:

- **Type Safety**: Runtime type checking for all IPC messages
- **Sanitization**: Input sanitization for strings, paths, and filenames
- **Length Limits**: Maximum length enforcement for all inputs
- **Pattern Validation**: Regex validation for specific formats
- **Error Messages**: Clear validation error messages

## Security Best Practices

### For Developers

1. **Never expose Node.js APIs directly to renderer**
2. **Always validate inputs in both preload and main process**
3. **Use the PathValidator for all file operations**
4. **Check NetworkSecurity.isUrlSafe() before making requests**
5. **Keep CSP policies strict in production**
6. **Test security features with the provided test suites**

### For Users

1. **Only download content you have rights to access**
2. **Respect copyright laws and service terms**
3. **Keep the application updated for latest security patches**
4. **Report any security issues responsibly**

## Threat Model

### Protected Against

- ✅ Cross-Site Scripting (XSS)
- ✅ Remote Code Execution (RCE)
- ✅ Server-Side Request Forgery (SSRF)
- ✅ Directory Traversal
- ✅ Path Injection
- ✅ DRM Circumvention Attempts
- ✅ Unauthorized File System Access
- ✅ Malicious URL Navigation
- ✅ Permission Escalation

### Known Limitations

- Downloaded content security depends on source
- Cannot validate content ownership rights programmatically
- Rate limiting is per-session, not persistent

## Security Checklist

- [x] Context Isolation enabled
- [x] Node Integration disabled
- [x] Sandbox mode active
- [x] CSP implemented
- [x] Input validation on all IPC channels
- [x] Path validation for file operations
- [x] SSRF prevention measures
- [x] DRM detection active
- [x] Legal consent system
- [x] Rate limiting implemented
- [x] Security tests written
- [x] Documentation complete

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to the maintainers
3. Include detailed reproduction steps
4. Allow time for a patch before public disclosure

## Updates and Maintenance

Security measures are reviewed and updated regularly:

- Monthly dependency updates
- Quarterly security audits
- Immediate patches for critical vulnerabilities
- Regular updates to DRM detection patterns
- CSP policy reviews based on new threats

## Testing

Run security tests with:

```bash
bun test src/main/security
bun test src/shared/__tests__/validation.test.ts
```

## Resources

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)