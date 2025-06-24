import { NextApiRequest, NextApiResponse } from 'next';
/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: List all clients
 *     description: Retrieve a paginated list of clients with optional filtering and sorting
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter clients by name, description, or industry
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *         description: Filter clients by industry
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of clients to return per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of clients to skip
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [name, industry, created_at, updated_at]
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *       - in: query
 *         name: include_stats
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include campaign, asset, and matrix counts
 *     responses:
 *       200:
 *         description: Successfully retrieved clients
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Client'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create a new client
 *     description: Create a new client with brand guidelines and contact information
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - industry
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Acme Corporation"
 *                 description: Client name
 *               industry:
 *                 type: string
 *                 example: "Technology"
 *                 description: Client industry
 *               description:
 *                 type: string
 *                 example: "Leading technology company"
 *                 description: Client description
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: "https://acme.com"
 *                 description: Client website URL
 *               logo:
 *                 type: string
 *                 format: uri
 *                 example: "https://cdn.acme.com/logo.png"
 *                 description: Client logo URL
 *               primaryColor:
 *                 type: string
 *                 example: "#1976d2"
 *                 description: Primary brand color (hex)
 *               secondaryColor:
 *                 type: string
 *                 example: "#dc004e"
 *                 description: Secondary brand color (hex)
 *               socialMedia:
 *                 type: object
 *                 properties:
 *                   instagram:
 *                     type: string
 *                   facebook:
 *                     type: string
 *                   twitter:
 *                     type: string
 *                   linkedin:
 *                     type: string
 *                 example:
 *                   instagram: "@acmecorp"
 *                   linkedin: "acme-corporation"
 *               brand_guidelines:
 *                 type: object
 *                 properties:
 *                   voiceTone:
 *                     type: string
 *                     example: "Professional and approachable"
 *                   targetAudience:
 *                     type: string
 *                     example: "Tech-savvy professionals aged 25-45"
 *                   keyMessages:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["Innovation", "Reliability", "Customer-first"]
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "John Smith"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "john@acme.com"
 *                     role:
 *                       type: string
 *                       example: "Marketing Director"
 *                     phone:
 *                       type: string
 *                       example: "+1-555-123-4567"
 *     responses:
 *       201:
 *         description: Client created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Client'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import {
  successResponse,
  errorResponse,
  handleApiError,
  methodNotAllowed,
  validateRequiredFields,
  createPaginationMeta,
  ApiErrorCode} from '@/lib/api-response';
import { getAdminSupabaseClient } from '@/lib/supabase';

// Get admin Supabase client for server-side operations
const supabase = getAdminSupabaseClient();
// GET handler - List clients with filtering and pagination (optimized)
async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  try {
    const {
      search,
      industry,
      limit = 50,
      offset = 0,
      sort_by = 'name',
      sort_order = 'asc',
      include_stats = false} = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;
    const validSortFields = ['name', 'industry', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sort_by as string) ? (sort_by as string) : 'name';
    const ascending = sort_order === 'asc';

    let clients, count;

    if (include_stats === 'true') {
      // Use optimized query with client_statistics materialized view for stats
      let query = supabase.from('client_list_view').select('*', { count: 'exact' });

      // Apply filters using full-text search for better performance
      if (search && typeof search === 'string') {
        // Use full-text search if available, fallback to ILIKE
        const useFullTextSearch = search.length > 2; // Only use FTS for longer queries

        if (useFullTextSearch) {
          query = query.textSearch('name_description_fts', search, {
            type: 'websearch',
            config: 'english' });
        } else {
          query = query.or(
            `name.ilike.%${search}%,description.ilike.%${search}%,industry.ilike.%${search}%`
          );
        }
      }

      if (industry && typeof industry === 'string') {
        query = query.eq('industry', industry);
      }

      // Apply sorting and pagination
      query = query.order(sortField, { ascending }).range(offsetNum, offsetNum + limitNum - 1);

      const { data, error, count: totalCount } = await query;

      if (error) {
        throw new Error(`Failed to fetch clients with stats: ${error.message}`);
      }

      clients = data;
      count = totalCount;
    } else {
      // Standard query without stats for better performance
      let query = supabase.from('clients').select('*', { count: 'exact' });

      // Apply search filter
      if (search && typeof search === 'string') {
        query = query.or(
          `name.ilike.%${search}%,description.ilike.%${search}%,industry.ilike.%${search}%`
        );
      }

      // Apply industry filter
      if (industry && typeof industry === 'string') {
        query = query.eq('industry', industry);
      }

      // Apply sorting and pagination
      query = query.order(sortField, { ascending }).range(offsetNum, offsetNum + limitNum - 1);

      const { data, error, count: totalCount } = await query;

      if (error) {
        throw new Error(`Failed to fetch clients: ${error.message}`);
      }

      clients = data;
      count = totalCount;
    }

    // Create pagination metadata
    const paginationMeta = createPaginationMeta(
      Math.floor(offsetNum / limitNum) + 1,
      limitNum,
      count || 0
    );

    return successResponse(res, clients, 200, {
      pagination: paginationMeta,
      timestamp: new Date().toISOString(),
      optimized: true,
      query_type: include_stats === 'true' ? 'with_stats' : 'basic' });
  } catch (error: any) {
    return handleApiError(res, error, 'handleGet');
  }
}
// POST handler - Create new client
async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
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
      contacts} = req.body;

    // Validate required fields
    const missingFields = validateRequiredFields(req.body, ['name', 'industry']);
    if (missingFields.length > 0) {
      return errorResponse(
        res,
        ApiErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingClient) {
      return errorResponse(
        res,
        ApiErrorCode.VALIDATION_ERROR,
        'A client with this name already exists',
        400
      );
    }
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
      social_media: socialMedia || { },
  brand_guidelines: brand_guidelines || {
        voiceTone: '',
        targetAudience: '',
        keyMessages: [] },
      is_active: true };

    // Create client in Supabase
    const { data: client, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create client: ${error.message}`);
    }

    // Create contacts if provided
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      const contactsData = contacts.map((contact: any) => ({
        client_id: client.id,
        name: contact.name,
        email: contact.email,
        role: contact.role || null,
        phone: contact.phone || null }));

      const { error: contactsError } = await supabase.from('client_contacts').insert(contactsData);

      if (contactsError) {
        // Log error but don't fail the request
        console.error('Failed to create contacts:', contactsError);
      }
    }

    return successResponse(res, client, 201);
  } catch (error: any) {
    return handleApiError(res, error, 'handlePost');
  }
}

// Main handler
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const user = (req as any).user;

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, user);
      case 'POST':
        return await handlePost(req, res, user);
      default:
        return methodNotAllowed(res, ['GET', 'POST']);
    }
  } catch (error: any) {
    return handleApiError(res, error, 'clients handler');
  }
}

// Apply authentication and rate limiting
export default withAuth(withAPIRateLimit(handler));
