/**
 * Comprehensive input validation and sanitization for workflow operations
 */

import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// File validation schemas
export const FileValidationSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid file name characters'),
  size: z
    .number()
    .min(1)
    .max(10 * 1024 * 1024), // 10MB max
  type: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ])});

// Brief data validation schema
export const BriefDataSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeText),
  objective: z.string().min(10).max(2000).transform(sanitizeText),
  targetAudience: z.string().min(10).max(1000).transform(sanitizeText),
  keyMessages: z.array(z.string().min(1).max(500).transform(sanitizeText)).max(10),
  platforms: z.array(z.string().min(1).max(50).transform(sanitizeText)).max(10),
  budget: z.string().max(100).transform(sanitizeText),
  timeline: z.string().max(200).transform(sanitizeText),
  product: z.string().max(500).transform(sanitizeText).optional(),
  service: z.string().max(500).transform(sanitizeText).optional(),
  valueProposition: z.string().max(1000).transform(sanitizeText).optional(),
  brandGuidelines: z.string().max(2000).transform(sanitizeText).optional(),
  requirements: z.array(z.string().min(1).max(500).transform(sanitizeText)).max(20).optional(),
  industry: z.string().max(100).transform(sanitizeText).optional(),
  competitors: z.array(z.string().min(1).max(200).transform(sanitizeText)).max(20).optional() });

// Motivation validation schema
export const MotivationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).transform(sanitizeText),
  description: z.string().min(10).max(1000).transform(sanitizeText),
  score: z.number().min(0).max(1),
  selected: z.boolean() });

// Copy variation validation schema
export const CopyVariationSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(2000).transform(sanitizeText),
  platform: z.string().min(1).max(50).transform(sanitizeText),
  selected: z.boolean() });

// Asset validation schema
export const AssetSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['image', 'video', 'copy', 'template']),
  url: z.string().url().optional(),
  content: z.string().max(5000).transform(sanitizeText).optional(),
  metadata: z.record(z.any()).optional(),
  selected: z.boolean() });

// Template validation schema
export const TemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).transform(sanitizeText),
  description: z.string().min(1).max(1000).transform(sanitizeText),
  thumbnail: z.string().url().optional(),
  category: z.string().min(1).max(100).transform(sanitizeText),
  selected: z.boolean() });

/**
 * Sanitize text input to prevent XSS and other injection attacks
 */
function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove any HTML tags and sanitize
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true });

  // Additional sanitization for common injection patterns
  let result = sanitized
    .replace(/[<>]/g, '') // Remove any remaining angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();

  // First remove SQL comments
  result = result.replace(/\/\*.*?\*\//g, ' '); // Remove /* */ comments
  result = result.replace(/--.*$/gm, ''); // Remove -- comments

  // Remove SQL injection patterns
  const sqlPatterns = [
    /\b(DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+SET|UNION\s+SELECT|SELECT\s+\*|CREATE\s+TABLE|ALTER\s+TABLE)\b/gi,
    /\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|FROM|WHERE|AND|OR)\b/gi, // Individual keywords
    /1'='1/g,
    /'.*?OR.*?'/gi,
  ];

  for (const pattern of sqlPatterns) {
    result = result.replace(pattern, ' '); // Replace with space to preserve length
  }

  // Remove template injection patterns
  const templatePatterns = [
    /\{\{.*?\}\}/g, // Mustache/Handlebars
    /<%.*?%>/g, // EJS/ERB
    /\${.*?}/g, // Template literals
    /#{.*?}/g, // Ruby/OGNL style
  ];

  for (const pattern of templatePatterns) {
    result = result.replace(pattern, '[REMOVED]'); // Replace with placeholder to preserve some content
  }

  return result.trim();
}

/**
 * Validate file upload
 */
export function validateFile(file: File): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    FileValidationSchema.parse({
      name: file.name,
      size: file.size,
      type: file.type });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map((e: any) => e.message));
    } else {
      errors.push('Invalid file format');
    }
  }

  // Additional security checks
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    errors.push('File name contains invalid path characters');
  }

  // Check for suspicious file extensions
  const suspiciousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.scr',
    '.pif',
    '.com',
    '.js',
    '.vbs',
    '.jar',
  ];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (suspiciousExtensions.includes(fileExtension)) {
    errors.push('File type not allowed for security reasons');
  }

  return {
    valid: errors.length === 0,
    errors};
}

/**
 * Validate and sanitize brief data
 */
export function validateBriefData(data: any): { valid: boolean; data?: any; errors: string[] } {
  try {
    const validatedData = BriefDataSchema.parse(data);
    return {
      valid: true,
      data: validatedData,
      errors: [] };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`) };
    }
    return {
      valid: false,
      errors: ['Invalid brief data format'] };
  }
}

/**
 * Validate motivations array
 */
export function validateMotivations(motivations: any[]): {
  valid: boolean;
  data?: any[];
  errors: string[];
} {
  const errors: string[] = [];
  const validatedMotivations: any[] = [];

  for (let i = 0; i < motivations.length; i++) {
    try {
      const validated = MotivationSchema.parse(motivations[i]);
      validatedMotivations.push(validated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.push(`Motivation ${i + 1}: ${error.errors.map((e: any) => e.message).join(', ')}`);
      } else {
        errors.push(`Motivation ${i + 1}: Invalid format`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    data: validatedMotivations,
    errors};
}

/**
 * Validate copy variations array
 */
export function validateCopyVariations(copyVariations: any[]): {
  valid: boolean;
  data?: any[];
  errors: string[];
} {
  const errors: string[] = [];
  const validatedCopy: any[] = [];

  for (let i = 0; i < copyVariations.length; i++) {
    try {
      const validated = CopyVariationSchema.parse(copyVariations[i]);
      validatedCopy.push(validated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.push(`Copy ${i + 1}: ${error.errors.map((e: any) => e.message).join(', ')}`);
      } else {
        errors.push(`Copy ${i + 1}: Invalid format`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    data: validatedCopy,
    errors};
}

/**
 * Validate assets array
 */
export function validateAssets(assets: any[]): { valid: boolean; data?: any[]; errors: string[] } {
  const errors: string[] = [];
  const validatedAssets: any[] = [];

  for (let i = 0; i < assets.length; i++) {
    try {
      const validated = AssetSchema.parse(assets[i]);
      validatedAssets.push(validated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.push(`Asset ${i + 1}: ${error.errors.map((e: any) => e.message).join(', ')}`);
      } else {
        errors.push(`Asset ${i + 1}: Invalid format`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    data: validatedAssets,
    errors};
}

/**
 * Validate template
 */
export function validateTemplate(template: any): { valid: boolean; data?: any; errors: string[] } {
  try {
    const validatedTemplate = TemplateSchema.parse(template);
    return {
      valid: true,
      data: validatedTemplate,
      errors: [] };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`) };
    }
    return {
      valid: false,
      errors: ['Invalid template format'] };
  }
}

/**
 * Rate limiting validation for AI operations
 */
export function validateAIOperationRate(
  userId: string,
  operation: string,
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 10
): { allowed: boolean; resetTime?: number } {
  // This would typically use Redis for distributed rate limiting
  // For now, implementing a simple in-memory version
  const key = `${userId}:${operation}`;
  const now = Date.now();

  // In production, this should use Redis with sliding window
  // For demonstration purposes, using a simple approach
  return {
    allowed: true, // Would implement actual rate limiting logic here
    resetTime: now + windowMs };
}

/**
 * Sanitize API response data
 */
export function sanitizeApiResponse(data: any): any {
  if (typeof data === 'string') {
    return sanitizeText(data);
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeApiResponse);
  }

  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeApiResponse(value);
    }
    return sanitized;
  }

  return data;
}
