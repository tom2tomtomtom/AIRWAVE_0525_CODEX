import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { z } from 'zod';

// Strict types from Supabase
export type TemplateRow = Database['public']['Tables']['templates']['Row'];
export type TemplateInsert = Database['public']['Tables']['templates']['Insert'];
export type TemplateUpdate = Database['public']['Tables']['templates']['Update'];

// Zod schema for runtime validation (POST/PUT/PATCH)
const TemplateInsertSchema = z.object({
  name: z.string(),
  aspect_ratio: z.string(),
  platform: z.string(),
  height: z.number(),
  width: z.number(),
  structure: z.record(z.any()),
  description: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional()
});

const TemplateUpdateSchema = TemplateInsertSchema.partial().extend({
  id: z.string()
});

// Helper function to remove undefined values from object
function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  switch (req.method) {
    case 'GET': {
      // Get all templates
      const { data, error } = await supabase.from('templates').select('*');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data as TemplateRow[]);
    }
    case 'POST': {
      // Validate and create a new template
      const parseResult = TemplateInsertSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors });
      }
      // Remove undefined values to satisfy exactOptionalPropertyTypes
      const body = removeUndefined(parseResult.data) as TemplateInsert;
      const { data, error } = await supabase.from('templates').insert([body]).select('*');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data?.[0] as TemplateRow);
    }
    case 'PUT':
    case 'PATCH': {
      // Validate and update an existing template (expects id in body)
      const parseResult = TemplateUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors });
      }
      const { id, ...updates } = parseResult.data;
      if (!id) return res.status(400).json({ error: 'Missing template id' });
      // Remove undefined values to satisfy exactOptionalPropertyTypes
      const cleanedUpdates = removeUndefined(updates) as TemplateUpdate;
      const { data, error } = await supabase
        .from('templates')
        .update(cleanedUpdates)
        .eq('id', id)
        .select('*');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data?.[0] as TemplateRow);
    }
    case 'DELETE': {
      // Delete a template (expects id in body)
      const { id } = req.body as { id?: string };
      if (!id) {
        res.status(400).json({ error: 'Missing template id' });
        return;
      }
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(204).end();
      return;
    }
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
      return;
  }
}
