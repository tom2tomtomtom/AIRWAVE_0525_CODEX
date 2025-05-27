// utils/validation.ts
import { z } from 'zod';

// Email validation
export const emailSchema = z.string().email('Invalid email address');

// Password validation
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID');

// File validation
export const fileSchema = z.object({
  size: z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
  type: z.string(),
  name: z.string()
});

// Image file validation
export const imageFileSchema = fileSchema.extend({
  type: z.enum([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ], { errorMap: () => ({ message: 'Invalid image format' }) })
});

// Video file validation
export const videoFileSchema = fileSchema.extend({
  type: z.enum([
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/webm',
    'video/x-matroska',
    'video/x-m4v'
  ], { errorMap: () => ({ message: 'Invalid video format' }) })
});

// Audio file validation
export const audioFileSchema = fileSchema.extend({
  type: z.enum([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/x-m4a'
  ], { errorMap: () => ({ message: 'Invalid audio format' }) })
});

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

// Client creation validation
export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(100),
  description: z.string().max(500).optional(),
  industry: z.string().max(50).optional()
});

// Brief creation validation
export const createBriefSchema = z.object({
  clientId: uuidSchema,
  name: z.string().min(1, 'Brief name is required').max(200),
  description: z.string().max(1000).optional(),
  targetAudience: z.string().max(500).optional(),
  objectives: z.array(z.string()).optional(),
  platforms: z.array(z.enum(['facebook', 'instagram', 'youtube', 'tiktok'])).optional(),
  budget: z.number().positive().optional(),
  timeline: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional()
});

// Matrix structure validation
export const matrixCellSchema = z.object({
  assetId: uuidSchema.optional(),
  locked: z.boolean().default(false),
  type: z.string()
});

export const matrixRowSchema = z.object({
  id: z.string(),
  cells: z.array(matrixCellSchema),
  locked: z.boolean().default(false)
});

export const matrixStructureSchema = z.object({
  columns: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string()
  })),
  rows: z.array(matrixRowSchema)
});

// Helper functions
export function validateEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

export function validatePassword(password: string): { valid: boolean; errors?: string[] } {
  try {
    passwordSchema.parse(password);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        errors: error.errors.map(e => e.message)
      };
    }
    return { valid: false, errors: ['Invalid password'] };
  }
}

export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

export function validateFileSize(file: File, maxSizeInBytes: number): boolean {
  return file.size <= maxSizeInBytes;
}

// Type guards
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    uuidSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

// Form validation helper
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
} {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _form: ['Invalid form data'] } };
  }
}

// API request validation middleware
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Validation error: ${JSON.stringify(result.error.errors)}`);
    }
    return result.data;
  };
}