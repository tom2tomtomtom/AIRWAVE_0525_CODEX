/**
 * Input Validation and Sanitization Utilities
 * Provides comprehensive input validation and sanitization for security
 */

import DOMPurify from 'isomorphic-dompurify';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  type?: 'string' | 'number' | 'email' | 'url' | 'uuid' | 'json';
  custom?: (value: unknown) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: { [key: string]: string };
  sanitizedData: { [key: string]: unknown };
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href'],
  });
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  // Security checks - reject dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /<img/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /DROP TABLE/i,
    /INSERT INTO/i,
    /DELETE FROM/i,
    /\r\n/,
    // eslint-disable-next-line no-control-regex
    /\x00/,
    /<>/,
  ];

  if (dangerousPatterns.some(pattern => pattern.test(email))) {
    return false;
  }

  // More comprehensive email validation
  // Must have exactly one @ symbol
  const atSymbols = email.split('@').length - 1;
  if (atSymbols !== 1) return false;

  // Split into local and domain parts
  const [localPart, domainPart] = email.split('@');

  // Check local part
  if (!localPart || localPart.length === 0) return false;
  if (localPart.includes(' ')) return false;

  // Check domain part
  if (!domainPart || domainPart.length === 0) return false;
  if (domainPart.includes(' ')) return false;
  if (!domainPart.includes('.')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  if (domainPart.includes('..')) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Reject javascript: protocol for security
    if (urlObj.protocol === 'javascript:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate file type by extension
 */
export function validateFileType(filename: string, allowedTypes: string[]): boolean {
  if (!filename) return false;
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  return allowedTypes.includes(extension);
}

/**
 * Validate file size
 */
export function validateFileSize(sizeInBytes: number, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeInBytes <= maxSizeBytes;
}

/**
 * Sanitize input (uses HTML sanitization for dangerous content)
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input);
}

/**
 * Validate URL (stricter than isValidUrl - only allows http/https)
 */
export function validateURL(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate email (alias for isValidEmail for backward compatibility)
 */
export function validateEmail(email: string): boolean {
  return isValidEmail(email);
}

/**
 * Validate password strength (simple boolean check)
 */
export function isPasswordValid(password: string): boolean {
  // At least 8 characters, one uppercase, one lowercase, one digit, one special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8}$/;
  return passwordRegex.test(password);
}

/**
 * Validate password strength with detailed feedback
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  if (!/[@$!%*?&#]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check if password is exactly a common weak password
  const commonWeakPasswords = [
    'password',
    'admin',
    'qwerty',
    '123456',
    'password123',
    'admin123',
    'qwerty123',
  ];
  const lowerPassword = password.toLowerCase();
  if (commonWeakPasswords.includes(lowerPassword)) {
    errors.push('Password contains common patterns');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate JSON string
 */
export function isValidJson(json: string): boolean {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate single field
 */
export function validateField(value: unknown, rule: ValidationRule): string | null {
  // Check required
  if (rule.required && (value === undefined || value === null || value === '')) {
    return 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return null;
  }

  // Type validation
  if (rule.type) {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return 'Must be a string';
        }
        break;
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return 'Must be a number';
        }
        break;
      case 'email':
        if (!isValidEmail(value as string)) {
          return 'Must be a valid email address';
        }
        break;
      case 'url':
        if (!isValidUrl(value as string)) {
          return 'Must be a valid URL';
        }
        break;
      case 'uuid':
        if (!isValidUuid(value as string)) {
          return 'Must be a valid UUID';
        }
        break;
      case 'json':
        if (!isValidJson(value as string)) {
          return 'Must be valid JSON';
        }
        break;
    }
  }

  // Length validation
  const stringValue = String(value);
  if (rule.minLength && stringValue.length < rule.minLength) {
    return `Must be at least ${rule.minLength} characters long`;
  }

  if (rule.maxLength && stringValue.length > rule.maxLength) {
    return `Must be no more than ${rule.maxLength} characters long`;
  }

  // Pattern validation
  if (rule.pattern && !rule.pattern.test(stringValue)) {
    return 'Invalid format';
  }

  // Custom validation
  if (rule.custom) {
    const result = rule.custom(value);
    if (result !== true) {
      return typeof result === 'string' ? result : 'Invalid value';
    }
  }

  return null;
}

/**
 * Validate data against schema
 */
export function validateData(data: unknown, schema: ValidationSchema): ValidationResult {
  const errors: { [key: string]: string } = {};
  const sanitizedData: { [key: string]: unknown } = {};

  // Validate each field in schema
  Object.keys(schema).forEach((key: string) => {
    const value = (data as Record<string, unknown>)[key];
    const rule = schema[key];

    if (rule) {
      const error = validateField(value, rule);
      if (error) {
        errors[key] = error;
      }
    }

    // Sanitize the value
    if (value !== undefined && value !== null) {
      if (typeof value === 'string') {
        sanitizedData[key] = sanitizeString(value);
      } else {
        sanitizedData[key] = value;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData,
  };
}

/**
 * Common validation schemas
 */
export const validationSchemas = {
  // User registration
  userRegistration: {
    email: {
      required: true,
      type: 'email' as const,
      maxLength: 255,
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    },
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 100,
    },
  },
  // User login
  login: {
    email: {
      required: true,
      type: 'email' as const,
      maxLength: 255,
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 128,
    },
  },
  // User signup
  signup: {
    email: {
      required: true,
      type: 'email' as const,
      maxLength: 255,
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    },
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 100,
    },
  },
  // Client creation
  clientCreation: {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 100,
    },
    industry: {
      required: false,
      type: 'string' as const,
      maxLength: 100,
    },
    description: {
      required: false,
      type: 'string' as const,
      maxLength: 1000,
    },
  },
  // Campaign creation
  campaignCreation: {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 200,
    },
    description: {
      required: false,
      type: 'string' as const,
      maxLength: 2000,
    },
    budget: {
      required: false,
      type: 'number' as const,
      custom: (value: number) => value >= 0 || 'Budget must be positive',
    },
  },
  // AI generation request
  aiGeneration: {
    prompt: {
      required: true,
      type: 'string' as const,
      minLength: 10,
      maxLength: 2000,
    },
    type: {
      required: true,
      type: 'string' as const,
      pattern: /^(text|image|video|voice)$/,
    },
    clientId: {
      required: true,
      type: 'string' as const,
      minLength: 1,
    },
    style: {
      required: false,
      type: 'string' as const,
      maxLength: 100,
    },
  },
};

/**
 * Middleware for request validation
 */
export function withValidation(
  schema: ValidationSchema,
  handler: (req: unknown, res: unknown) => Promise<void>
) {
  return async (req: unknown, res: unknown) => {
    const validation = validateData((req as any).body, schema);

    if (!validation.isValid) {
      return (res as any).status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validation.errors,
      });
    }

    // Replace request body with sanitized data
    (req as any).body = validation.sanitizedData;

    return handler(req, res);
  };
}

/**
 * Sanitize file upload data
 */
export function sanitizeFileData(file: unknown): {
  isValid: boolean;
  error?: string;
  sanitizedFile?: unknown;
} {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  // Check file size (10MB max)
  if ((file as any).size > 10 * 1024 * 1024) {
    return { isValid: false, error: 'File too large (max 10MB)' };
  }

  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mp3',
    'audio/wav',
    'application/pdf',
  ];

  if (!allowedTypes.includes((file as any).type)) {
    return { isValid: false, error: 'File type not allowed' };
  }

  // Sanitize filename
  const sanitizedName = (file as any).name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2}/g, '_')
    .toLowerCase();

  return {
    isValid: true,
    sanitizedFile: {
      ...file,
      name: sanitizedName,
    },
  };
}

/**
 * Validate UUID (alias for isValidUuid)
 */
export function validateUUID(uuid: string | null | undefined): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  return isValidUuid(uuid);
}

/**
 * Validate file upload for security
 */
export function validateFileUpload(file: { name: string; type: string; size: number }): {
  isValid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  // Check for executable file types
  const dangerousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.pif',
    '.scr',
    '.vbs',
    '.js',
    '.jar',
    '.app',
    '.dmg',
    '.pkg',
    '.deb',
    '.rpm',
  ];

  const fileName = file.name.toLowerCase();
  for (const ext of dangerousExtensions) {
    if (fileName.endsWith(ext)) {
      errors.push('File type not allowed for security reasons');
      break;
    }
  }

  // Check for path traversal attempts
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    errors.push('File name contains invalid path characters');
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push('File size exceeds maximum limit');
  }

  // Check MIME type
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'application/pdf',
    'text/plain',
    'text/csv',
  ];

  if (!allowedTypes.includes(file.type)) {
    errors.push('File type not allowed for security reasons');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : [],
  };
}

/**
 * Detect malicious patterns in input
 */
export function detectMaliciousPatterns(input: string): boolean {
  const patterns = [
    // SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b)/i,
    /'.*OR.*'/i,
    /1'='1/,

    // NoSQL injection patterns
    /\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin/,

    // LDAP injection patterns
    /[()&|*]/,

    // Template injection patterns
    /\{\{.*\}\}/,
    /<%.*%>/,
    /\${.*}/,

    // Command injection patterns
    /;.*&&|;.*\|\|/,
    /`.*`/,
    /\$\(.*\)/,
  ];

  return patterns.some(pattern => pattern.test(input));
}
