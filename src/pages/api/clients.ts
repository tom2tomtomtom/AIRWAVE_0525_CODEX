import { getErrorMessage } from '@/utils/errorUtils';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import type { Client } from '@/types/models';
import { createServerClient } from '@supabase/ssr';

type ResponseData = {
  success: boolean;
  message?: string;
  clients?: Client[];
  client?: Client;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  console.log('Clients API called:', method, 'User:', user?.id, user?.email);

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
        message: 'Authentication required' 
      });
    }

    switch (method) {
      case 'GET':
        console.log('Calling handleGet...');
        return handleGet(req, res, user, supabase);
      case 'POST':
        console.log('Calling handlePost...');
        return handlePost(req, res, user, supabase);
      default:
        return res.status(405).json({ 
          success: false, 
          message: 'Method not allowed' 
        });
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Clients API error:', error);
    console.error('Error stack:', (error as any)?.stack);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse<ResponseData>, user: any, supabase: any): Promise<void> {
  console.log('handleGet started for user:', user.id);
  
  try {
    const { 
      search,
      industry,
      limit = 50, 
      offset = 0,
      sort_by = 'name',
      sort_order = 'asc',
      include_stats = false,
    } = req.query;

    // Get all clients (RLS policies will handle access control)
    let query = supabase
      .from('clients')
      .select(`
        *
        ${include_stats === 'true' ? `,
          campaigns(count),
          assets(count),
          matrices(count)
        ` : ''}
      `);

    // Apply search filter
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,industry.ilike.%${search}%`);
    }

    // Apply industry filter
    if (industry && typeof industry === 'string') {
      query = query.eq('industry', industry);
    }

    // Apply sorting
    const validSortFields = ['name', 'industry', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by as string : 'name';
    const ascending = sort_order === 'asc';
    query = query.order(sortField, { ascending });

    // Apply pagination
    const limitNum = Math.min(Number(limit) || 50, 100);
    const offsetNum = Number(offset) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data: clients, error } = await query;

    if (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }

    // Fetch contacts separately for each client
    const clientIds = clients?.map(c => c.id) || [];
    let contactsMap: Record<string, any[]> = {};
    
    if (clientIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from('client_contacts')
        .select('*')
        .in('client_id', clientIds)
        .eq('is_active', true);
      
      if (!contactsError && contacts) {
        // Group contacts by client_id
        contactsMap = contacts.reduce((acc, contact) => {
          if (!acc[contact.client_id]) {
            acc[contact.client_id] = [];
          }
          acc[contact.client_id].push(contact);
          return acc;
        }, {} as Record<string, any[]>);
      }
    }

    // Transform clients to match expected format
    const transformedClients = clients?.map(client => ({
      id: client.id,
      name: client.name,
      slug: client.slug,
      industry: client.industry,
      description: client.description,
      website: client.website,
      logo: client.logo_url,
      primaryColor: client.primary_color,
      secondaryColor: client.secondary_color,
      socialMedia: client.social_media || {},
      brand_guidelines: client.brand_guidelines || {},
      isActive: client.is_active !== false,
      dateCreated: client.created_at,
      lastModified: client.updated_at,
      contacts: contactsMap[client.id] || [],
      // Include stats if requested
      ...(include_stats === 'true' && {
        stats: {
          campaignCount: Array.isArray(client.campaigns) ? client.campaigns.length : 0,
          assetCount: Array.isArray(client.assets) ? client.assets.length : 0,
          matrixCount: Array.isArray(client.matrices) ? client.matrices.length : 0,
        }
      })
    })) || [];

    return res.json({
      success: true,
      clients: transformedClients,
      pagination: {
        total: clients?.length || 0,
        limit: limitNum,
        offset: offsetNum,
        hasMore: (clients?.length || 0) === limitNum
      }
    });

  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Error in handleGet:', error);
    throw error;
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse<ResponseData>, user: any, supabase: any): Promise<void> {
  try {
    const {
      name,
      industry,
      description,
      website,
      logo,
      primaryColor,
      secondaryColor,
      socialMedia,
      brand_guidelines,
      contacts
    } = req.body;

    // Basic validation
    if (!name || !industry) {
      return res.status(400).json({
        success: false,
        message: 'Name and industry are required'
      });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Create client in Supabase
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name,
        slug,
        industry,
        description: description || null,
        website: website || null,
        logo_url: logo || null,
        primary_color: primaryColor || '#1976d2',
        secondary_color: secondaryColor || '#dc004e',
        social_media: socialMedia || {},
        brand_guidelines: brand_guidelines || {
          voiceTone: '',
          targetAudience: '',
          keyMessages: []
        },
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      throw error;
    }

    // Add contacts if provided
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      const contactInserts = contacts.map((contact: any) => ({
        client_id: client.id,
        name: contact.name,
        role: contact.role || null,
        email: contact.email || null,
        phone: contact.phone || null,
        is_primary: contact.isActive || false,
        is_active: true,
      }));

      const { error: contactError } = await supabase
        .from('client_contacts')
        .insert(contactInserts);

      if (contactError) {
        console.error('Error creating contacts:', contactError);
        // Don't fail the whole operation for contact errors, just log it
      }
    }

    // Transform response
    const transformedClient: Client = {
      id: client.id,
      name: client.name,
      slug: client.slug,
      industry: client.industry,
      description: client.description,
      website: client.website,
      logo: client.logo_url,
      primaryColor: client.primary_color,
      secondaryColor: client.secondary_color,
      socialMedia: client.social_media || {},
      brand_guidelines: client.brand_guidelines || {},
      isActive: client.is_active,
      dateCreated: client.created_at,
      lastModified: client.updated_at,
      contacts: contacts || [], // Include the contacts in response
    };

    return res.status(201).json({
      success: true,
      client: transformedClient,
    });

  } catch (error) {
    const message = getErrorMessage(error);
    console.error('Error in handlePost:', error);
    throw error;
  }
}

export default withAuth(withSecurityHeaders(handler));