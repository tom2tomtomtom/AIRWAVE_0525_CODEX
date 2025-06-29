/**
 * @swagger
 * /api/assets:
 *   get:
 *     summary: List all assets
 *     description: Retrieve a paginated list of assets with filtering and sorting options
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of assets per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter assets by name
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, video, text, voice]
 *         description: Filter assets by type
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter assets by client ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, type, created_at, updated_at]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved assets
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
 *                         $ref: '#/components/schemas/Asset'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create a new asset
 *     description: Create a new asset with metadata and file information
 *     tags: [Assets]
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
 *               - type
 *               - url
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Product Hero Image"
 *                 description: Asset name
 *               type:
 *                 type: string
 *                 enum: [image, video, text, voice]
 *                 example: "image"
 *                 description: Asset type
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: "https://cdn.airwave.app/assets/hero.jpg"
 *                 description: Asset file URL
 *               thumbnailUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://cdn.airwave.app/assets/hero-thumb.jpg"
 *                 description: Thumbnail URL for preview
 *               description:
 *                 type: string
 *                 example: "Main hero image for product landing page"
 *                 description: Asset description
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["hero", "product", "marketing"]
 *                 description: Asset tags for categorization
 *               clientId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: Associated client ID
 *               metadata:
 *                 type: object
 *                 example: {"campaign": "summer-launch", "version": "v1"}
 *                 description: Additional metadata
 *               size:
 *                 type: integer
 *                 example: 1024000
 *                 description: File size in bytes
 *               mimeType:
 *                 type: string
 *                 example: "image/jpeg"
 *                 description: MIME type of the file
 *               duration:
 *                 type: number
 *                 example: 30.5
 *                 description: Duration in seconds (for video/audio)
 *               width:
 *                 type: integer
 *                 example: 1920
 *                 description: Width in pixels (for images/videos)
 *               height:
 *                 type: integer
 *                 example: 1080
 *                 description: Height in pixels (for images/videos)
 *     responses:
 *       201:
 *         description: Asset created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Asset created successfully"
 *                 asset:
 *                   $ref: '#/components/schemas/Asset'
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
 */

import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withAPIRateLimit } from '@/lib/rate-limiter';
import {
  successResponse,
  errorResponse,
  handleApiError,
  methodNotAllowed,
  validateRequiredFields,
  createPaginationMeta,
  ApiErrorCode,
} from '@/lib/api-response';

export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'voice';
  url: string; // This will be mapped from file_url
  thumbnailUrl?: string;
  description?: string;
  tags: string[];
  dateCreated: string;
  clientId: string;
  userId: string;
  favorite?: boolean;
  metadata?: Record<string, any>;
  size?: number;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
}

// Remove custom ResponseData type - using standardized API responses

// Map database row to Asset interface (fixing schema mismatch)
function mapDatabaseRowToAsset(row: any): Asset {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.file_url, // Map file_url to url for frontend
    thumbnailUrl: row.thumbnail_url,
    description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [],
    dateCreated: row.created_at,
    clientId: row.client_id,
    userId: row.created_by,
    favorite: row.is_favorite || false,
    metadata: row.metadata || {},
    size: row.file_size,
    mimeType: row.mime_type,
    duration: row.duration,
    width: row.dimensions?.width,
    height: row.dimensions?.height,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const user = (req as any).user;

  try {
    switch (req.method) {
      case 'GET':
        return await getAssets(req, res, user);
      case 'POST':
        return await createAsset(req, res, user);
      case 'PUT':
        return await updateAsset(req, res, user);
      case 'DELETE':
        return await deleteAsset(req, res, user);
      default:
        return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE']);
    }
  } catch (error: any) {
    return handleApiError(res, error, 'assets handler');
  }
}

// GET - Fetch assets with proper schema mapping
async function getAssets(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const {
      page = '1',
      limit = '20',
      search = '',
      type = '',
      clientId = '',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100); // Cap at 100
    const offset = (pageNum - 1) * limitNum;

    // Build query with proper field selection
    let query = supabase.from('assets').select(
      `
        id,
        name,
        type,
        file_url,
        thumbnail_url,
        description,
        tags,
        client_id,
        created_by,
        metadata,
        file_size,
        mime_type,
        duration,
        dimensions,
        created_at,
        updated_at
      `,
      { count: 'exact' }
    );

    // Filter by client if provided
    if (clientId) {
      query = query.eq('client_id', clientId);
    } else {
      // Get all assets from clients the user has access to
      const { data: userClients } = await supabase
        .from('user_clients')
        .select('client_id')
        .eq('user_id', userId);

      if (userClients && userClients.length > 0) {
        const clientIds = userClients.map((uc: any) => uc.client_id);
        query = query.in('client_id', clientIds);
      } else {
        // User has no clients, return empty result
        const paginationMeta = createPaginationMeta(pageNum, limitNum, 0);
        return successResponse(res, [], 200, {
          pagination: paginationMeta,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Apply filters
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (type) {
      query = query.eq('type', type);
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy as string, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch assets: ${error.message}`);
    }

    // Map database rows to Asset interface
    const assets = (data || []).map(mapDatabaseRowToAsset);

    // Create pagination metadata
    const paginationMeta = createPaginationMeta(pageNum, limitNum, count || 0);

    return successResponse(res, assets, 200, {
      pagination: paginationMeta,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return handleApiError(res, error, 'getAssets');
  }
}

// POST - Create a new asset with proper field mapping
async function createAsset(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const {
      name,
      type,
      url,
      thumbnailUrl,
      description,
      tags,
      clientId,
      metadata,
      size,
      mimeType,
      duration,
      width,
      height,
    } = req.body;

    // Validate required fields
    const missingFields = validateRequiredFields(req.body, ['name', 'type', 'url']);
    if (missingFields.length > 0) {
      return errorResponse(
        res,
        ApiErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
    }

    // Validate asset type
    if (!['image', 'video', 'text', 'voice'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be one of: image, video, text, voice',
      });
    }

    // Prepare data for database (map to correct field names)
    const assetData = {
      name,
      type,
      file_url: url, // Map url to file_url for database
      thumbnail_url: thumbnailUrl,
      description,
      tags: Array.isArray(tags) ? tags : [],
      client_id: clientId,
      created_by: userId,
      metadata: metadata || {},
      file_size: size,
      mime_type: mimeType,
      duration,
      dimensions: width && height ? { width, height } : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('assets')
      .insert(assetData)
      .select(
        `
        id,
        name,
        type,
        file_url,
        thumbnail_url,
        description,
        tags,
        client_id,
        created_by,
        metadata,
        file_size,
        mime_type,
        duration,
        dimensions,
        created_at
      `
      )
      .single();

    if (error) {
      console.error('Database error creating asset:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create asset',
      });
    }

    // Map database row to Asset interface
    const asset = mapDatabaseRowToAsset(data);

    return res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      asset,
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Create asset error:', message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create asset',
    });
  }
}

// PUT - Update an asset
async function updateAsset(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { id } = req.query;
    const updates = req.body;

    if (!id) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Asset ID is required', 400);
    }

    // Map frontend fields to database fields
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) dbUpdates.name = updates.name;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.url) dbUpdates.file_url = updates.url; // Map url to file_url
    if (updates.thumbnailUrl) dbUpdates.thumbnail_url = updates.thumbnailUrl;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.tags) dbUpdates.tags = Array.isArray(updates.tags) ? updates.tags : [];
    if (updates.metadata) dbUpdates.metadata = updates.metadata;

    const { data, error } = await supabase
      .from('assets')
      .update(dbUpdates)
      .eq('id', id)
      .eq('created_by', userId) // Ensure user owns the asset
      .select(
        `
        id,
        name,
        type,
        file_url,
        thumbnail_url,
        description,
        tags,
        client_id,
        created_by,
        metadata,
        file_size,
        mime_type,
        duration,
        dimensions,
        created_at,
        updated_at
      `
      )
      .single();

    if (error) {
      console.error('Database error updating asset:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update asset',
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found or access denied',
      });
    }

    // Map database row to Asset interface
    const asset = mapDatabaseRowToAsset(data);

    return res.status(200).json({
      success: true,
      message: 'Asset updated successfully',
      asset,
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Update asset error:', message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update asset',
    });
  }
}

// DELETE - Delete an asset
async function deleteAsset(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  try {
    const userId = user?.id;
    if (!userId) {
      return errorResponse(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { id } = req.query;

    if (!id) {
      return errorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Asset ID is required', 400);
    }

    // Get the asset to check ownership
    const { data: asset, error: fetchError } = await supabase
      .from('assets')
      .select('id, file_url, created_by, metadata')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (fetchError || !asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found or access denied',
      });
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .eq('id', id)
      .eq('created_by', userId);

    if (deleteError) {
      console.error('Database error deleting asset:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete asset',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Asset deleted successfully',
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Delete asset error:', message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete asset',
    });
  }
}

export default withAuth(withAPIRateLimit(handler));
