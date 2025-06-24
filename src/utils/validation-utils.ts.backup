import { z } from 'zod';

// Common validation schemas that can be tested independently
export const validationSchemas = {
  // ID validation (UUIDs)
  uuid: z.string().uuid('Invalid ID format'),

  // Email validation
  email: z.string().email('Invalid email format').toLowerCase(),

  // Password validation (minimum security requirements)
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  // Safe string (prevents XSS)
  safeString: z
    .string()
    .transform(str => str.trim())
    .refine(str => !/<[^>]*>/.test(str), 'HTML tags are not allowed')
    .refine(str => !/[<>'"`;]/.test(str), 'Special characters not allowed'),

  // Safe text (allows some formatting but prevents XSS)
  safeText: z
    .string()
    .transform(str => str.trim())
    .refine(
      str => !/<script|<iframe|<object|<embed|javascript:|on\w+=/i.test(str),
      'Potentially dangerous content detected'
    ),

  // URL validation
  url: z
    .string()
    .url('Invalid URL format')
    .refine(
      url => url.startsWith('http://') || url.startsWith('https://'),
      'URL must start with http:// or https://'
    ),

  // File path validation (prevents directory traversal)
  filePath: z
    .string()
    .refine(path => !path.includes('..') && !path.includes('~'), 'Invalid file path'),

  // Pagination
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')}),

  // Date range
  dateRange: z
    .object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()})
    .refine(
      data =>
        !data.startDate || !data.endDate || new Date(data.startDate) <= new Date(data.endDate),
      'Start date must be before end date'
    )};

// Sanitize string to prevent SQL injection
export function sanitizeSQLString(input: string): string {
  // Remove or escape potentially dangerous characters
  return input
    .replace(/['";\\]/g, '') // Remove quotes and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comments
    .replace(/\*\//g, '')
    .replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '') // Remove SQL keywords
    .trim();
}

// Sanitize object keys to prevent prototype pollution
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const cleaned = {} as Record<string, unknown> & Record<string, unknown> & T;

  for (const [key, value] of Object.entries(obj)) {
    if (!dangerous.includes(key)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        cleaned[key as keyof T] = sanitizeObject(value);
      } else {
        cleaned[key as keyof T] = value;
      }
    }
  }

  return cleaned;
}

// File upload validation
const fileAllowedTypes = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]};

const fileMaxSizes = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 50 * 1024 * 1024, // 50MB
  document: 20 * 1024 * 1024, // 20MB
};

// Define file validation object separately to avoid self-referential issues
interface FileValidation {
  allowedTypes: typeof fileAllowedTypes;
  maxSizes: typeof fileMaxSizes;
  validate(
    file: { type: string; size: number; name: string  },
  category: keyof typeof fileAllowedTypes
  ): boolean;
}

export const fileValidation: FileValidation = {
  // Allowed file types by category
  allowedTypes: fileAllowedTypes,

  // Maximum file sizes (in bytes)
  maxSizes: fileMaxSizes,

  // Validate file
  validate(
    file: { type: string; size: number; name: string  },
  category: keyof typeof fileAllowedTypes
  ) {
    const allowedTypes = fileAllowedTypes[category];
    const maxSize = fileMaxSizes[category];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed for ${category}`);
    }

    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
    }

    // Check file extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'image/svg+xml': ['svg'],
      'video/mp4': ['mp4'],
      'video/quicktime': ['mov'],
      'video/x-msvideo': ['avi'],
      'video/x-ms-wmv': ['wmv'],
      'video/webm': ['webm'],
      'audio/mpeg': ['mp3'],
      'audio/wav': ['wav'],
      'audio/ogg': ['ogg'],
      'audio/mp4': ['m4a'],
      'application/pdf': ['pdf'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'text/plain': ['txt']};

    const validExtensions = expectedExtensions[file.type];
    if (validExtensions && extension && !validExtensions.includes(extension)) {
      throw new Error(`File extension .${extension} does not match MIME type ${file.type}`);
    }

    return true;
  }};

// Export validation schemas for specific API routes
export const apiValidationSchemas = {
  // Auth schemas
  login: z.object({
    email: validationSchemas.email,
    password: z.string().min(1, 'Password is required')}),

  signup: z.object({
    email: validationSchemas.email,
    password: validationSchemas.password,
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .transform(str => str.trim())
      .refine(str => !/<[^>]*>/.test(str), 'HTML tags are not allowed')
      .refine(str => !/[<>'"`;]/.test(str), 'Special characters not allowed')}),

  // Client schemas
  createClient: z.object({
    name: z
      .string()
      .min(2, 'Client name is required')
      .transform(str => str.trim())
      .refine(str => !/<[^>]*>/.test(str), 'HTML tags are not allowed')
      .refine(str => !/[<>'"`;]/.test(str), 'Special characters not allowed'),
    description: validationSchemas.safeText.optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
      .optional()}),

  // Asset schemas
  uploadAsset: z.object({
    clientId: validationSchemas.uuid,
    category: z.enum(['image', 'video', 'audio', 'document']),
    tags: z.array(validationSchemas.safeString).optional()}),

  // Brief schemas
  createBrief: z.object({
    clientId: validationSchemas.uuid,
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .transform(str => str.trim())
      .refine(str => !/<[^>]*>/.test(str), 'HTML tags are not allowed')
      .refine(str => !/[<>'"`;]/.test(str), 'Special characters not allowed'),
    content: validationSchemas.safeText,
    objectives: z.array(validationSchemas.safeText).optional(),
    targetAudience: validationSchemas.safeText.optional()})};

// Enhanced input sanitization functions
export const sanitization = {
  // HTML encode to prevent XSS
  htmlEncode(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Remove HTML tags completely
  stripHTML(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  },

  // Sanitize for safe JSON insertion
  sanitizeJSON(input: string): string {
    return input
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  },

  // Remove null bytes and control characters
  removeControlChars(input: string): string {
    // eslint-disable-next-line no-control-regex
    return input.replace(/[\x00-\x1F\x7F]/g, '');
  },

  // Normalize Unicode to prevent homograph attacks
  normalizeUnicode(input: string): string {
    return input.normalize('NFKC');
  },

  // Clean filename for safe storage
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace non-alphanumeric chars
      .replace(/\.{2}/g, '.') // Replace multiple dots
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .substring(0, 255); // Limit length
  },

  // Sanitize URL to prevent open redirect
  sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }

      // Block localhost and private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = parsed.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname.startsWith('127.') ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
        ) {
          throw new Error('Private IP not allowed');
        }
      }

      return parsed.href;
    } catch {
      throw new Error('Invalid URL');
    }
  },

  // Complete input sanitization for API inputs
  sanitizeInput(input: string, options: {},
  allowHTML?: boolean;
    maxLength?: number;
    removeControlChars?: boolean;
    normalizeUnicode?: boolean;
  } = {}): string {
    const {
      allowHTML = false,
      maxLength = 10000,
      removeControlChars = true,
      normalizeUnicode = true} = options;

    let sanitized = input;

    // Normalize Unicode
    if (normalizeUnicode) {
      sanitized = this.normalizeUnicode(sanitized);
    }

    // Remove control characters
    if (removeControlChars) {
      sanitized = this.removeControlChars(sanitized);
    }

    // Handle HTML
    if (!allowHTML) {
      sanitized = this.stripHTML(sanitized);
    } else {
      sanitized = this.htmlEncode(sanitized);
    }

    // Trim and limit length
    sanitized = sanitized.trim();
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }};

// Security validation helpers
export const securityValidation = {
  // Detect XSS patterns
  containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /vbscript:/i,
      /data:text\/html/i,
      /%3cscript/i,
      /%6a%61%76%61%73%63%72%69%70%74/i, // URL encoded javascript
      /&lt;script/i,
      /&gt;/i,
      /&#x3c;script/i,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  },

  // Detect SQL injection patterns
  containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*)+/i,
      /(';|--;|\/\*|\*\/)/i,
      /(\b(and|or)\b.*=.*)/i,
      /0x[0-9a-f]+/i, // Hex values
      /char\(/i,
      /concat\(/i,
      /group_concat\(/i,
      /information_schema/i,
      /load_file\(/i,
      /outfile\b/i,
      /dumpfile\b/i,
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  },

  // Detect path traversal patterns
  containsPathTraversal(input: string): boolean {
    const pathPatterns = [
      /\.\./,
      /~/,
      /%2e%2e/i,
      /%252e%252e/i,
      /\\.\\./, // Windows style
      /\.\.\\/,
      /\.\.\\\\/,
      /\.\.%2f/i,
      /\.\.%5c/i,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
    ];

    return pathPatterns.some(pattern => pattern.test(input));
  },

  // Detect prototype pollution patterns
  containsPrototypePollution(input: string): boolean {
    const pollutionPatterns = [
      /__proto__/,
      /constructor\s*\.\s*prototype/,
      /prototype\s*\.\s*constructor/,
      /%5f%5fproto%5f%5f/i, // URL encoded __proto__
      /\["__proto__"\]/,
      /\['__proto__'\]/,
    ];

    return pollutionPatterns.some(pattern => pattern.test(input));
  },

  // Detect command injection patterns
  containsCommandInjection(input: string): boolean {
    const commandPatterns = [
      /[;&|`$(){}]/,
      /\$\(/,
      /`[^`]*`/,
      /%24%28/i, // URL encoded $(
      /%60/i, // URL encoded backtick
      /\|\s*\w+/,
      /;\s*\w+/,
      /&&\s*\w+/,
      /\|\|\s*\w+/,
    ];

    return commandPatterns.some(pattern => pattern.test(input));
  },

  // Detect LDAP injection patterns
  containsLDAPInjection(input: string): boolean {
    const ldapPatterns = [
      /[*()\\]/,
      // eslint-disable-next-line no-control-regex
      /\x00/,
      /%00/i,
      /\(\|\(/,
      /\)\(\|/,
      /\*\)/,
      /\(\*/,
    ];

    return ldapPatterns.some(pattern => pattern.test(input));
  },

  // Detect NoSQL injection patterns
  containsNoSQLInjection(input: string): boolean {
    const nosqlPatterns = [
      /\$where/i,
      /\$regex/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$or/i,
      /\$and/i,
      /\$in/i,
      /\$nin/i,
      /\$exists/i,
      /\$not/i,
    ];

    return nosqlPatterns.some(pattern => pattern.test(input));
  },

  // General malicious pattern detection
  containsMaliciousPattern(input: string): boolean {
    return (
      this.containsXSS(input) ||
      this.containsSQLInjection(input) ||
      this.containsPathTraversal(input) ||
      this.containsPrototypePollution(input) ||
      this.containsCommandInjection(input) ||
      this.containsLDAPInjection(input) ||
      this.containsNoSQLInjection(input)
    );
  },

  // Validate and sanitize input comprehensively
  validateAndSanitize(input: string, options: {},
  allowHTML?: boolean;
    maxLength?: number;
    checkMalicious?: boolean;
    throwOnMalicious?: boolean;
  } = {}): { sanitized: string; isValid: boolean; warnings: string[] } {
    const {
      allowHTML = false,
      maxLength = 10000,
      checkMalicious = true,
      throwOnMalicious = false} = options;

    const warnings: string[] = [];
    let isValid = true;

    // Check for malicious patterns
    if (checkMalicious) {
      const checks = [
        { check: this.containsXSS(input), message: 'XSS patterns detected'  }
        { check: this.containsSQLInjection(input), message: 'SQL injection patterns detected'  }
        { check: this.containsPathTraversal(input), message: 'Path traversal patterns detected'  }
        { check: this.containsPrototypePollution(input), message: 'Prototype pollution patterns detected'  }
        { check: this.containsCommandInjection(input), message: 'Command injection patterns detected'  }
        { check: this.containsLDAPInjection(input), message: 'LDAP injection patterns detected'  }
        { check: this.containsNoSQLInjection(input), message: 'NoSQL injection patterns detected'  }
      ];

      for (const { check, message } of checks) {
        if (check) {
          warnings.push(message);
          isValid = false;
          
          if (throwOnMalicious) {
            throw new Error(`Security violation: ${message}`);
          }
        }
      }
    }

    // Sanitize the input
    const sanitized = sanitization.sanitizeInput(input, {
      allowHTML,
      maxLength,
      removeControlChars: true,
      normalizeUnicode: true});

    return { sanitized, isValid, warnings };
  }};
