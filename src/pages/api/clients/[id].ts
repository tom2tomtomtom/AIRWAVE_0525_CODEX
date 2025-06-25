import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import type { Client } from '@/types/models';
import { createServerClient } from '@supabase/ssr';
import { getServiceSupabase } from '@/lib/supabase';

type ResponseData = {
  success: boolean;
  message?: string;
  client?: Client;
};

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>): Promise<void> {
  const { method, query } = req;
  const { id } = query;
  const user = (req as any).user;

  if (method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Client ID is required',
    });
  }

  // Create Supabase server client with proper cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies[name];
        },
        set(name: string, value: string, options: any) {
          // We don't need to set cookies in API routes
        },
        remove(name: string, options: any) {
          // We don't need to remove cookies in API routes
        },
      },
    }
  );

  try {
    if (!user) {
      console.error('No user found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const serviceSupabase = getServiceSupabase();

    // Use service role directly since we know RLS is blocking regular queries
    const { data: client, error } = await serviceSupabase
      .from('clients')
      .select(
        `
        id,
        name,
        slug,
        industry,
        description,
        website,
        logo_url,
        primary_color,
        secondary_color,
        social_media,
        brand_guidelines,
        is_active,
        created_at,
        updated_at,
        created_by
      `
      )
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error) {
      console.error('Error fetching client:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Client not found',
        });
      }
      throw error;
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    // Fetch contacts for this client using service role
    const { data: contacts, error: contactsError } = await serviceSupabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', id)
      .eq('is_active', true);

    // Transform client to match expected format
    const transformedClient = {
      id: client.id,
      name: client.name,
      slug: client.slug,
      industry: client.industry,
      description: client.description,
      website: client.website,
      logo: client.logo_url,
      primaryColor: client.primary_color || '#1976d2',
      secondaryColor: client.secondary_color || '#dc004e',
      socialMedia: client.social_media || {},
      brand_guidelines: client.brand_guidelines || {},
      isActive: client.is_active !== false,
      dateCreated: client.created_at,
      lastModified: client.updated_at,
      contacts: contacts || [],
    } as unknown as Client;

    return res.json({
      success: true,
      client: transformedClient,
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Individual client API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export default withAuth(withSecurityHeaders(handler));
