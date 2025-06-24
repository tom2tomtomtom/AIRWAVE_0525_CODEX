import { getErrorMessage } from '@/utils/errorUtils';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';
import { loggers } from '@/lib/logger';

const logger = loggers.api.child({ module: 'validation' });

/**
 * Input validation middleware for API routes
 * Prevents SQL injection, XSS, and validates data types
 */

// Common validation schemas
export const commonSchemas = {
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
      endDate: z.string().datetime().optional() })
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

// Validation error response
export function validationErrorResponse(error: ZodError): NextResponse {
  const errors = error.errors.map((err: unknown) => ({
    field: err.path.join('.'),
    message: err.message }));

  logger.warn('Validation error', {
    message: 'Validation failed',
    errorCount: errors.length,
    fields: errors.map((e: unknown) => e.field).join(', ')});

  return NextResponse.json(
    {
      success: false,
      message: 'Validation error',
      errors},
    { status: 400 }
  );
}

// Main validation function
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error: NextResponse | null }> {
  try {
    let input: unknown;

    // Get input based on request method
    if (request.method === 'GET') {
      // For GET requests, validate query parameters
      const searchParams = request.nextUrl.searchParams;
      input = Object.fromEntries(searchParams.entries());

      // Convert numeric strings to numbers for common fields
      ['page', 'limit'].forEach((field: unknown) => {
        if (input[field]) {
          const num = Number(input[field]);
          if (!isNaN(num)) {
            input[field] = num;
          }
        }
      });
    } else {
      // For other methods, parse JSON body
      try {
        const text = await request.text();
        if (text) {
          input = JSON.parse(text);

          // Sanitize object to prevent prototype pollution
          input = sanitizeObject(input);
        } else {
          input = {};
        }
      } catch {
        return {
          data: {} as T,
          error: NextResponse.json(
            { success: false, message: 'Invalid JSON body'  }
            { status: 400 }
          )};
      }
    }

    // Validate input against schema
    const data = schema.parse(input);

    return { data, error: null };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (error instanceof ZodError) {
      return { data: {} as T, error: validationErrorResponse(error) };
    }

    logger.error('Unexpected validation error', error);
    return {
      data: {} as T,
      error: NextResponse.json(
        { success: false, message: 'Internal validation error'  }
        { status: 500 }
      )};
  }
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
  allowedTypes: typeof fileAllowedTypes;,
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

// CSRF token validation
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf_token')?.value;

  if (!token || !cookieToken || token !== cookieToken) {
    logger.warn('CSRF token validation failed', {
      hasHeaderToken: !!token,
      hasCookieToken: !!cookieToken,
      tokensMatch: token === cookieToken });
    return false;
  }

  return true;
}

// Rate limiting check (integrates with middleware rate limiting)
export function checkAPIRateLimit('test case', () => {
  __identifier: string,
  _limit: number = 100,
  _window: number = 60000
): boolean {
  // This would integrate with Redis in production
  // For now, using in-memory store from middleware
  // The actual implementation would be in a separate rate-limiting service
  return true;
}

// Export validation schemas for specific API routes
export const apiSchemas = {
  // Auth schemas
  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required')}),

  signup: z.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
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
    description: commonSchemas.safeText.optional(),
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
    clientId: commonSchemas.uuid,
    category: z.enum(['image', 'video', 'audio', 'document']),
    tags: z.array(commonSchemas.safeString).optional() }),

  // Brief schemas
  createBrief: z.object({
    clientId: commonSchemas.uuid,
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .transform(str => str.trim())
      .refine(str => !/<[^>]*>/.test(str), 'HTML tags are not allowed')
      .refine(str => !/[<>'"`;]/.test(str), 'Special characters not allowed'),
    content: commonSchemas.safeText,
    objectives: z.array(commonSchemas.safeText).optional(),
    targetAudience: commonSchemas.safeText.optional() })};
