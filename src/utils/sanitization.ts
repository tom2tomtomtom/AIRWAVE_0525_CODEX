import { SecurityEvents } from '@/lib/security/security-logger';
import { NextApiRequest } from 'next';

/**
 * Enhanced HTML escaping for XSS prevention
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return text.replace(/[&<>"'`=/]/g, s => map[s]);
}

/**
 * Basic input sanitization with XSS and injection protection
 */
export function sanitizeInput(input: string, req?: NextApiRequest): string {
  if (typeof input !== 'string') {
    return '';
  }

  const original = input;
  
  let sanitized = input
    .trim()
    // Remove control characters (null, tab, newline, etc.)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    // Remove potentially dangerous HTML/script content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers

  // Check for potential XSS attempts
  if (req && containsXSSAttempt(original)) {
    SecurityEvents.xssAttempt(req, original, 'user_input');
  }

  // Check for SQL injection patterns
  if (req && containsSQLInjection(original)) {
    SecurityEvents.sqlInjection(req, original, 'user_input');
  }

  return sanitized;
}

/**
 * Strict sanitization for user-generated content
 */
export function sanitizeUserContent(input: string, req?: NextApiRequest): string {
  if (typeof input !== 'string') {
    return '';
  }

  const original = input;
  
  let sanitized = input
    .trim()
    // Remove all HTML tags except safe ones
    .replace(/<(?!\/?(b|i|u|strong|em|p|br|ul|ol|li)\b)[^>]*>/gi, '')
    // Remove potentially dangerous attributes
    .replace(/\s(on\w+|style|class|id)\s*=\s*["'][^"']*["']/gi, '')
    // Remove script/style content
    .replace(/<(script|style)[^>]*>.*?<\/\1>/gi, '')
    // Remove dangerous protocols
    .replace(/(javascript|vbscript|data|file|about):/gi, 'blocked:')
    // Limit length to prevent DoS
    .slice(0, 10000);

  // Log potential attacks
  if (req) {
    if (containsXSSAttempt(original)) {
      SecurityEvents.xssAttempt(req, original, 'user_content');
    }
    if (containsSQLInjection(original)) {
      SecurityEvents.sqlInjection(req, original, 'user_content');
    }
  }

  return sanitized;
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string, req?: NextApiRequest): string {
  if (typeof filename !== 'string') {
    return '';
  }

  const original = filename;
  
  // Check for path traversal attempts
  if (req && containsPathTraversal(original)) {
    SecurityEvents.authFailure(req, 'unknown', `Path traversal attempt in filename: ${original}`);
  }

  return filename
    .replace(/[^\w\s.-]/g, '') // Keep only alphanumeric, spaces, dots, dashes
    .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
    .replace(/^\.+/, '') // Remove leading dots
    .trim()
    .slice(0, 255); // Limit length
}

/**
 * Sanitize SQL input (for dynamic queries - use parameterized queries instead when possible)
 */
export function sanitizeSQLInput(input: string, req?: NextApiRequest): string {
  if (typeof input !== 'string') {
    return '';
  }

  const original = input;
  
  // Check for SQL injection patterns
  if (req && containsSQLInjection(original)) {
    SecurityEvents.sqlInjection(req, original, 'sql_input');
  }

  return input
    .trim()
    // Remove dangerous SQL keywords and characters
    .replace(/(['";\\])/g, '\\$1') // Escape quotes and backslashes
    .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|UNION|INSERT|UPDATE)\b/gi, '')
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove SQL block comments
    .replace(/\*\//g, '')
    .slice(0, 1000); // Limit length
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  return email
    .trim()
    .toLowerCase()
    .replace(/[^\w@.-]/g, '') // Keep only valid email characters
    .slice(0, 254); // RFC 5321 limit
}

/**
 * Sanitize URL to prevent malicious redirects
 */
export function sanitizeURL(url: string, req?: NextApiRequest, allowedDomains?: string[]): string {
  if (typeof url !== 'string') {
    return '';
  }

  const original = url;
  
  try {
    const urlObj = new URL(url);
    
    // Check for dangerous protocols
    const dangerousProtocols = ['javascript', 'vbscript', 'data', 'file', 'ftp'];
    if (dangerousProtocols.includes(urlObj.protocol.replace(':', ''))) {
      if (req) {
        SecurityEvents.xssAttempt(req, original, 'url_protocol');
      }
      return '';
    }

    // Check allowed domains if specified
    if (allowedDomains && !allowedDomains.includes(urlObj.hostname)) {
      if (req) {
        SecurityEvents.authFailure(req, 'unknown', `Blocked URL to unauthorized domain: ${urlObj.hostname}`);
      }
      return '';
    }

    return urlObj.toString();
  } catch (error) {
    // Invalid URL
    if (req) {
      SecurityEvents.authFailure(req, 'unknown', `Invalid URL format: ${original}`);
    }
    return '';
  }
}

/**
 * Check for XSS attempt patterns
 */
function containsXSSAttempt(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /String\.fromCharCode/i,
    /document\.cookie/i,
    /window\.location/i,
    /alert\s*\(/i
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for SQL injection patterns
 */
function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b)/i,
    /('|(\\')|(;)|(\\)|(\/)(\*)|(\\*)(\/))/,
    /(\b(OR|AND)\b.{1,6}?(=|>|<|\!=|<>|<=|>=))/i,
    /(\b(OR|AND)\b\s.{1,3}?(=|>|<|\!=|<>|<=|>=))/i,
    /(HAVING|GROUP\s+BY|ORDER\s+BY)/i,
    /(\bUNION\b.{1,20}?\bSELECT\b)/i,
    /(\'\s*(OR|AND)\s*\'\w*\'\s*=\s*\'\w*)/i
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for path traversal attempts
 */
function containsPathTraversal(input: string): boolean {
  const pathTraversalPatterns = [
    /\.\./,
    /\.\\\.\\/, 
    /%2e%2e/i,
    /%252e%252e/i,
    /\\\.\\\./, 
    /\/\.\.\//,
    /\\\.\.\\/, 
    /%c0%ae/i,
    /%e0%80%ae/i
  ];

  return pathTraversalPatterns.some(pattern => pattern.test(input));
}

/**
 * Advanced content sanitization with whitelist approach
 */
export function sanitizeWithWhitelist(
  input: string, 
  allowedTags: string[] = [], 
  allowedAttributes: string[] = [],
  req?: NextApiRequest
): string {
  if (typeof input !== 'string') {
    return '';
  }

  const original = input;
  
  // Basic XSS check
  if (req && containsXSSAttempt(original)) {
    SecurityEvents.xssAttempt(req, original, 'whitelist_content');
  }

  // Remove all HTML tags except explicitly allowed ones
  let sanitized = input.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // Further sanitize allowed tags by removing dangerous attributes
      return match.replace(/\s(on\w+|style|class|id)\s*=\s*["'][^"']*["']/gi, (attrMatch, attrName) => {
        return allowedAttributes.includes(attrName.toLowerCase()) ? attrMatch : '';
      });
    }
    return '';
  });

  return sanitized.trim();
}
