import { getErrorMessage } from '@/utils/errorUtils';
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth-fixed';
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
  debug?: any; // For debugging purposes
};

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  console.log('🎯 Clients API called:', method, 'User:', user?.id, user?.email);

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
      console.error('❌ No user found in request');
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    console.log('✅ User authenticated:', {
      id: user.id,
      email: user.email,
      role: user.role,
      clientIds: user.clientIds?.length || 0
    });

    switch (method) {
      case 'GET':
        console.log('📋 Calling handleGet...');
        return handleGet(req, res, user, supabase);
      case 'POST':
        console.log('✏️ Calling handlePost...');
        return handlePost(req, res, user, supabase);
      default:
        console.log('❌ Method not allowed:', method);
        return res.status(405).json({ 
          success: false, 
          message: 'Method not allowed' 
        });
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('💥 Clients API error:', error);
    console.error('Stack trace:', (error as any)?.stack);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? {
        error: message,
        stack: (error as any)?.stack
      } : undefined
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse<ResponseData>, user: any, supabase: any): Promise<void> {
  console.log('📊 handleGet started for user:', user.id);
  
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

    console.log('🔍 Query parameters:', {
      search,
      industry,
      limit,
      offset,
      sort_by,
      sort_order,
      include_stats
    });

    // Test basic connection first
    console.log('🧪 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('clients')
      .select('count(*)', { count: 'exact', head: true });

    if (testError) {
      console.error('❌ Supabase connection test failed:', testError);
      throw new Error(`Database connection failed: ${testError.message}`);
    }

    console.log('✅ Supabase connection test passed');

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
      console.log('🔍 Applying search filter:', search);
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,industry.ilike.%${search}%`);
    }

    // Apply industry filter
    if (industry && typeof industry === 'string') {
      console.log('🏭 Applying industry filter:', industry);
      query = query.eq('industry', industry);
    }

    // Apply sorting
    const validSortFields = ['name', 'industry', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by as string : 'name';
    const ascending = sort_order === 'asc';
    console.log('📈 Applying sort:', sortField, ascending ? 'ascending' : 'descending');
    query = query.order(sortField, { ascending });

    // Apply pagination
    const limitNum = Math.min(Number(limit) || 50, 100);
    const offsetNum = Number(offset) || 0;
    console.log('📄 Applying pagination:', { limit: limitNum, offset: offsetNum });
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    console.log('🚀 Executing clients query...');
    const { data: clients, error, count } = await query;

    if (error) {
      console.error('❌ Error fetching clients:', error);
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }

    console.log('✅ Clients fetched successfully:', clients?.length || 0, 'records');

    // Fetch contacts separately for each client
    const clientIds = clients?.map(c => c.id) || [];
    let contactsMap: Record<string, any[]> = {};
    
    if (clientIds.length > 0) {
      console.log('👥 Fetching contacts for', clientIds.length, 'clients');
      const { data: contacts, error: contactsError } = await supabase
        .from('client_contacts')
        .select('*')
        .in('client_id', clientIds)
        .eq('is_active', true);
      
      if (contactsError) {
        console.error('⚠️ Error fetching contacts (non-fatal):', contactsError);
      } else if (contacts) {
        console.log('✅ Contacts fetched:', contacts.length, 'records');
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

    console.log('✅ handleGet completed successfully');

    return res.json({
      success: true,
      clients: transformedClients,
      pagination: {
        total: count || clients?.length || 0,
        limit: limitNum,
        offset: offsetNum,
        hasMore: (clients?.length || 0) === limitNum
      }
    });

  } catch (error) {
    const message = getErrorMessage(error);
    console.error('💥 Error in handleGet:', error);
    throw error;
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse<ResponseData>, user: any, supabase: any): Promise<void> {
  console.log('✏️ handlePost started for user:', user.id);
  
  try {
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    
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
      console.error('❌ Validation failed: missing name or industry');
      return res.status(400).json({
        success: false,
        message: 'Name and industry are required'
      });
    }

    console.log('✅ Basic validation passed');

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    console.log('🔗 Generated slug:', slug);

    // Check if slug already exists
    const { data: existingClient, error: slugCheckError } = await supabase
      .from('clients')
      .select('id')
      .eq('slug', slug)
      .single();

    if (slugCheckError && slugCheckError.code !== 'PGRST116') {
      console.error('❌ Error checking slug uniqueness:', slugCheckError);
      throw new Error(`Failed to check slug uniqueness: ${slugCheckError.message}`);
    }

    if (existingClient) {
      console.error('❌ Slug already exists:', slug);
      return res.status(400).json({
        success: false,
        message: 'A client with this name already exists'
      });
    }

    console.log('✅ Slug is unique');

    // Prepare client data
    const clientData = {
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
    };

    console.log('📋 Client data prepared:', clientData);

    // Create client in Supabase
    console.log('🚀 Creating client in database...');
    const { data: client, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating client:', error);
      throw new Error(`Failed to create client: ${error.message}`);
    }

    console.log('✅ Client created successfully:', client.id);

    // Add contacts if provided
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      console.log('👥 Adding', contacts.length, 'contacts...');
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
        console.error('⚠️ Error creating contacts (non-fatal):', contactError);
        // Don't fail the whole operation for contact errors, just log it
      } else {
        console.log('✅ Contacts created successfully');
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

    console.log('✅ handlePost completed successfully');

    return res.status(201).json({
      success: true,
      client: transformedClient,
    });

  } catch (error) {
    const message = getErrorMessage(error);
    console.error('💥 Error in handlePost:', error);
    throw error;
  }
}

export default withAuth(withSecurityHeaders(handler));
