import { z } from 'zod';

const safeTextSchema = z
  .string()
  .transform(str => str.trim())
  .refine(str => !/<script[^>]*>.*?<\/script>/gi.test(str), 'Script tags not allowed');

const safeTextWithLength = (min?: number, max?: number) => {
  let schema = z.string();
  if (min !== undefined) schema = schema.min(min, `Must be at least ${min} characters`);
  if (max !== undefined) schema = schema.max(max, `Must be at most ${max} characters`);
  return schema
    .transform(str => str.trim())
    .refine(str => !/<script[^>]*>.*?<\/script>/gi.test(str), 'Script tags not allowed');
};

const industrySchema = z.enum([
  'technology',
  'healthcare',
  'finance',
  'retail',
  'education',
  'manufacturing',
  'real-estate',
  'hospitality',
  'automotive',
  'food-beverage',
  'fashion',
  'sports',
  'entertainment',
  'non-profit',
  'government',
  'consulting',
  'marketing',
  'other',
]);

export const createClientSchema = z.object({
  name: safeTextWithLength(2, 100),
  industry: industrySchema,
  description: safeTextWithLength(undefined, 1000).optional(),
  website: z.string().url('Invalid URL format').optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional()});

export function validateClientInput(input: unknown) {
  const result = createClientSchema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues.map((issue: any) => ({
      field: issue.path.join('.'),
      message: issue.message }));

    return { success: false, errors, data: null };
  }

  return { success: true, errors: [], data: result.data };
}
