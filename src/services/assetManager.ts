import { getLogger } from '@/lib/logger';
import { classifyError } from '@/lib/error-handling/error-classifier';
import { createServerSupabaseClient } from '@/lib/supabase';
import { optimizeImage, analyzeImage } from '@/lib/optimization/image';

const logger = getLogger('asset-manager');

export interface Asset {
  id: string;
  briefId: string;
  fileName: string;
  originalName: string;
  fileType: 'image' | 'video' | 'audio' | 'document' | 'other';
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  metadata: AssetMetadata;
  tags: string[];
  category: 'product' | 'brand' | 'lifestyle' | 'background' | 'logo' | 'icon' | 'template';
  usage: 'hero' | 'supporting' | 'background' | 'accent' | 'logo' | 'social' | 'web' | 'print';
  dimensions?: {
    width: number;
    height: number;
  };
  colorPalette?: string[];
  dominantColor?: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadedAt: Date;
  updatedAt: Date;
  uploadedBy: string;
}

export interface AssetMetadata {
  // Image specific
  format?: string;
  quality?: number;
  hasTransparency?: boolean;
  isAnimated?: boolean;

  // Video specific
  duration?: number;
  fps?: number;
  codec?: string;

  // Document specific
  pageCount?: number;
  wordCount?: number;

  // General
  description?: string;
  altText?: string;
  keywords?: string[];
  aiAnalysis?: {
    description: string;
    objects: string[];
    mood: string;
    style: string;
    confidence: number;
  };
}

export interface AssetCollection {
  id: string;
  briefId: string;
  name: string;
  description: string;
  assets: Asset[];
  coverAssetId?: string;
  tags: string[];
  category: 'brand' | 'campaign' | 'product' | 'templates' | 'stock';
  usage: 'primary' | 'secondary' | 'archive';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface AssetUploadOptions {
  category?: Asset['category'];
  usage?: Asset['usage'];
  tags?: string[];
  description?: string;
  altText?: string;
  autoOptimize?: boolean;
  generateThumbnail?: boolean;
  analyzeWithAI?: boolean;
  collectionId?: string;
}

export interface AssetSearchOptions {
  briefId?: string;
  fileType?: Asset['fileType'];
  category?: Asset['category'];
  usage?: Asset['usage'];
  tags?: string[];
  colorPalette?: string[];
  dimensions?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  sortBy?: 'uploadedAt' | 'fileName' | 'fileSize' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class AssetManager {
  private supabasePromise = createServerSupabaseClient();
  private readonly STORAGE_BUCKET = 'campaign-assets';
  private readonly THUMBNAIL_BUCKET = 'asset-thumbnails';
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/mov'];
  private readonly SUPPORTED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'text/plain',
  ];

  private async getSupabase() {
    return await this.supabasePromise;
  }

  async uploadAsset(
    file: File,
    briefId: string,
    uploadedBy: string,
    options: AssetUploadOptions = {}
  ): Promise<Asset> {
    const {
      category = 'product',
      usage = 'supporting',
      tags = [],
      description,
      altText,
      autoOptimize = true,
      generateThumbnail = true,
      analyzeWithAI = true,
      collectionId,
    } = options;

    try {
      logger.info('Starting asset upload', {
        fileName: file.name,
        fileSize: file.size,
        briefId,
        category,
        usage,
      });

      // Validate file
      this.validateFile(file);

      // Generate unique file name
      const fileName = this.generateFileName(file.name);
      const fileType = this.determineFileType(file.type);

      // Create initial asset record
      const assetId = this.generateAssetId();

      const asset: Asset = {
        id: assetId,
        briefId,
        fileName,
        originalName: file.name,
        fileType,
        mimeType: file.type,
        fileSize: file.size,
        url: '',
        metadata: {
          ...(description && { description }),
          ...(altText && { altText }),
          keywords: tags,
        },
        tags,
        category,
        usage,
        status: 'uploading',
        uploadedAt: new Date(),
        updatedAt: new Date(),
        uploadedBy,
      };

      // Update status to processing
      asset.status = 'processing';

      // Process file based on type
      let processedFile = file;
      let thumbnailBuffer: Buffer | null = null;

      if (fileType === 'image' && autoOptimize) {
        const optimized = await this.processImage(file, generateThumbnail);
        processedFile = new File([optimized.main], fileName, { type: file.type });
        thumbnailBuffer = optimized.thumbnail;

        // Add image metadata
        asset.dimensions = optimized.dimensions;
        asset.colorPalette = optimized.colorPalette;
        asset.dominantColor = optimized.dominantColor;
        asset.metadata.format = optimized.format;
        asset.metadata.hasTransparency = optimized.hasTransparency;
        asset.metadata.isAnimated = optimized.isAnimated;
      } else if (fileType === 'video') {
        const videoMetadata = await this.processVideo(file);
        asset.metadata.duration = videoMetadata.duration;
        asset.metadata.fps = videoMetadata.fps;
        asset.metadata.codec = videoMetadata.codec;
        asset.dimensions = videoMetadata.dimensions;
      } else if (fileType === 'document') {
        const docMetadata = await this.processDocument(file);
        asset.metadata.pageCount = docMetadata.pageCount;
        asset.metadata.wordCount = docMetadata.wordCount;
      }

      // Upload main file
      const mainUploadResult = await this.uploadFileToStorage(
        processedFile,
        this.STORAGE_BUCKET,
        `${briefId}/${fileName}`
      );

      if (!mainUploadResult.success) {
        throw new Error(`Upload failed: ${mainUploadResult.error}`);
      }

      asset.url = mainUploadResult.url!;

      // Upload thumbnail if generated
      if (thumbnailBuffer) {
        const thumbnailUploadResult = await this.uploadFileToStorage(
          new File([thumbnailBuffer], `thumb_${fileName}`, { type: 'image/jpeg' }),
          this.THUMBNAIL_BUCKET,
          `${briefId}/thumb_${fileName}`
        );

        if (thumbnailUploadResult.success) {
          asset.thumbnailUrl = thumbnailUploadResult.url!;
        }
      }

      // AI Analysis if requested
      if (analyzeWithAI && (fileType === 'image' || fileType === 'video')) {
        try {
          const aiAnalysis = await this.analyzeAssetWithAI(asset);
          if (aiAnalysis) {
            asset.metadata.aiAnalysis = aiAnalysis;
          }
        } catch (error: any) {
          logger.warn('AI analysis failed', error);
        }
      }

      // Save to database
      asset.status = 'ready';
      await this.saveAssetToDatabase(asset);

      // Add to collection if specified
      if (collectionId) {
        await this.addAssetToCollection(collectionId, assetId);
      }

      logger.info('Asset upload completed', {
        assetId,
        fileName,
        fileSize: asset.fileSize,
        url: asset.url,
      });

      return asset;
    } catch (error: any) {
      const classified = classifyError(
        error as Error,
        {
          component: 'asset-manager',
          fileName: file.name,
          briefId,
          fileSize: file.size,
        } as any
      );

      logger.error('Asset upload failed', classified.originalError);
      throw error;
    }
  }

  async searchAssets(options: AssetSearchOptions = {}): Promise<{
    assets: Asset[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      briefId,
      fileType,
      category,
      usage,
      tags,
      searchQuery,
      sortBy = 'uploadedAt',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = options;

    try {
      const supabase = await this.getSupabase();
      let query = supabase.from('assets').select('*', { count: 'exact' });

      // Apply filters
      if (briefId) query = query.eq('brief_id', briefId);
      if (fileType) query = query.eq('file_type', fileType);
      if (category) query = query.eq('category', category);
      if (usage) query = query.eq('usage', usage);
      if (tags && tags.length > 0) {
        query = query.overlaps('tags', tags);
      }
      if (searchQuery) {
        query = query.or(
          `file_name.ilike.%${searchQuery}%,original_name.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`
        );
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      const assets = (data || []).map((row: any) => this.mapRowToAsset(row));
      const total = count || 0;
      const hasMore = offset + limit < total;

      return {
        assets,
        total,
        hasMore,
      };
    } catch (error: any) {
      logger.error('Asset search failed', error);
      throw error;
    }
  }

  async getAssetById(assetId: string): Promise<Asset | null> {
    try {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapRowToAsset(data);
    } catch (error: any) {
      logger.error('Failed to get asset by ID', error);
      throw error;
    }
  }

  async deleteAsset(assetId: string, deletedBy: string): Promise<void> {
    try {
      const asset = await this.getAssetById(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Delete from storage
      await this.deleteFileFromStorage(this.STORAGE_BUCKET, this.getStoragePathFromUrl(asset.url));

      if (asset.thumbnailUrl) {
        await this.deleteFileFromStorage(
          this.THUMBNAIL_BUCKET,
          this.getStoragePathFromUrl(asset.thumbnailUrl)
        );
      }

      // Delete from database
      const supabase = await this.getSupabase();
      const { error } = await supabase.from('assets').delete().eq('id', assetId);

      if (error) {
        throw error;
      }

      logger.info('Asset deleted', { assetId, deletedBy });
    } catch (error: any) {
      logger.error('Asset deletion failed', error);
      throw error;
    }
  }

  async createCollection(
    briefId: string,
    name: string,
    description: string,
    createdBy: string,
    options: {
      category?: AssetCollection['category'];
      usage?: AssetCollection['usage'];
      tags?: string[];
      assets?: string[];
    } = {}
  ): Promise<AssetCollection> {
    const { category = 'campaign', usage = 'primary', tags = [], assets = [] } = options;

    try {
      const collection: AssetCollection = {
        id: this.generateCollectionId(),
        briefId,
        name,
        description,
        assets: [],
        tags,
        category,
        usage,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
      };

      // Save to database
      await this.saveCollectionToDatabase(collection);

      // Add assets if provided
      if (assets.length > 0) {
        await this.addAssetsToCollection(collection.id, assets);

        // Fetch assets to populate collection
        const assetObjects = await Promise.all(assets.map((id: any) => this.getAssetById(id)));
        collection.assets = assetObjects.filter(Boolean) as Asset[];
      }

      return collection;
    } catch (error: any) {
      logger.error('Collection creation failed', error);
      throw error;
    }
  }

  async getCollections(briefId: string): Promise<AssetCollection[]> {
    try {
      const supabase = await this.getSupabase();

      // Use the optimized view that joins collections with asset counts
      const { data, error } = await supabase
        .from('asset_collection_view')
        .select('*')
        .eq('brief_id', briefId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to original query if view doesn't exist
        return await this.getCollectionsWithN1Query(briefId);
      }

      // Map the optimized data to collections with assets loaded efficiently
      const collections = await this.mapOptimizedCollectionData(data || []);

      return collections;
    } catch (error: any) {
      logger.error('Failed to get collections', error);
      // Fallback to N+1 query if optimized version fails
      return await this.getCollectionsWithN1Query(briefId);
    }
  }

  // Optimized asset loading for collections
  private async mapOptimizedCollectionData(collectionRows: any[]): Promise<AssetCollection[]> {
    if (collectionRows.length === 0) return [];

    // Extract all asset IDs from all collections in one go
    const allAssetIds = collectionRows.flatMap(row => row.asset_ids || []).filter(Boolean);

    // Load all assets in a single query
    const assetMap = new Map<string, Asset>();
    if (allAssetIds.length > 0) {
      const supabase = await this.getSupabase();
      const { data: assetData, error } = await supabase
        .from('assets')
        .select('*')
        .in('id', allAssetIds);

      if (!error && assetData) {
        assetData.forEach((assetRow: any) => {
          assetMap.set(assetRow.id, this.mapRowToAsset(assetRow));
        });
      }
    }

    // Map collections and assign assets
    return collectionRows.map(row => {
      const collection = this.mapRowToCollection(row);

      // Assign assets from the map
      if (row.asset_ids && Array.isArray(row.asset_ids)) {
        collection.assets = row.asset_ids
          .map((id: string) => assetMap.get(id))
          .filter(Boolean) as Asset[];
      }

      return collection;
    });
  }

  // Fallback method with N+1 queries (original implementation)
  private async getCollectionsWithN1Query(briefId: string): Promise<AssetCollection[]> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('asset_collections')
      .select('*')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const collections = await Promise.all(
      (data || []).map(async (row: any) => {
        const collection = this.mapRowToCollection(row);

        // Load assets for each collection (N+1 query)
        const assets = await this.getCollectionAssets(collection.id);
        collection.assets = assets;

        return collection;
      })
    );

    return collections;
  }

  // Private methods
  private validateFile(file: File): void {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const supportedTypes = [
      ...this.SUPPORTED_IMAGE_TYPES,
      ...this.SUPPORTED_VIDEO_TYPES,
      ...this.SUPPORTED_DOCUMENT_TYPES,
    ];

    if (!supportedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
  }

  private determineFileType(mimeType: string): Asset['fileType'] {
    if (this.SUPPORTED_IMAGE_TYPES.includes(mimeType)) return 'image';
    if (this.SUPPORTED_VIDEO_TYPES.includes(mimeType)) return 'video';
    if (this.SUPPORTED_DOCUMENT_TYPES.includes(mimeType)) return 'document';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'other';
  }

  private async processImage(
    file: File,
    generateThumbnail: boolean
  ): Promise<{
    main: Buffer;
    thumbnail: Buffer | null;
    dimensions: { width: number; height: number };
    colorPalette: string[];
    dominantColor: string;
    format: string;
    hasTransparency: boolean;
    isAnimated: boolean;
  }> {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Analyze original image
    const analysis = await analyzeImage(buffer);

    // Optimize main image
    const optimized = await optimizeImage(buffer, {
      quality: 90,
      format: 'webp',
    });

    // Generate thumbnail if requested
    let thumbnail: Buffer | null = null;
    if (generateThumbnail) {
      const thumbResult = await optimizeImage(buffer, {
        width: 300,
        height: 300,
        quality: 80,
        format: 'jpeg',
      });
      thumbnail = thumbResult.buffer;
    }

    return {
      main: optimized.buffer,
      thumbnail,
      dimensions: {
        width: analysis.metadata.width,
        height: analysis.metadata.height,
      },
      colorPalette: [analysis.dominantColor],
      dominantColor: analysis.dominantColor,
      format: analysis.metadata.format,
      hasTransparency: analysis.hasTransparency,
      isAnimated: analysis.isAnimated,
    };
  }

  private async processVideo(_file: File): Promise<{
    duration: number;
    fps: number;
    codec: string;
    dimensions: { width: number; height: number };
  }> {
    // Placeholder for video processing
    // In production, would use ffmpeg or similar
    return {
      duration: 0,
      fps: 30,
      codec: 'h264',
      dimensions: { width: 1920, height: 1080 },
    };
  }

  private async processDocument(_file: File): Promise<{
    pageCount: number;
    wordCount: number;
  }> {
    // Placeholder for document processing
    // In production, would parse PDF/DOC files
    return {
      pageCount: 1,
      wordCount: 0,
    };
  }

  private async uploadFileToStorage(
    file: File,
    bucket: string,
    path: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const supabase = await this.getSupabase();
      const { data: _data, error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

      return {
        success: true,
        url: urlData.publicUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async deleteFileFromStorage(bucket: string, path: string): Promise<void> {
    const supabase = await this.getSupabase();
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      logger.warn('Failed to delete file from storage: ' + error.message);
    }
  }

  private async analyzeAssetWithAI(_asset: Asset): Promise<AssetMetadata['aiAnalysis']> {
    // Placeholder for AI analysis
    // Would integrate with vision AI services
    return {
      description: 'AI-generated description of the asset',
      objects: ['object1', 'object2'],
      mood: 'professional',
      style: 'modern',
      confidence: 0.85,
    };
  }

  private async saveAssetToDatabase(asset: Asset): Promise<void> {
    const supabase = await this.getSupabase();
    const { error } = await supabase.from('assets').upsert({
      id: asset.id,
      brief_id: asset.briefId,
      file_name: asset.fileName,
      original_name: asset.originalName,
      file_type: asset.fileType,
      mime_type: asset.mimeType,
      file_size: asset.fileSize,
      url: asset.url,
      thumbnail_url: asset.thumbnailUrl,
      metadata: asset.metadata,
      tags: asset.tags,
      category: asset.category,
      usage: asset.usage,
      dimensions: asset.dimensions,
      color_palette: asset.colorPalette,
      dominant_color: asset.dominantColor,
      status: asset.status,
      uploaded_at: asset.uploadedAt.toISOString(),
      updated_at: asset.updatedAt.toISOString(),
      uploaded_by: asset.uploadedBy,
    });

    if (error) {
      throw error;
    }
  }

  private async saveCollectionToDatabase(collection: AssetCollection): Promise<void> {
    const supabase = await this.getSupabase();
    const { error } = await supabase.from('asset_collections').upsert({
      id: collection.id,
      brief_id: collection.briefId,
      name: collection.name,
      description: collection.description,
      cover_asset_id: collection.coverAssetId,
      tags: collection.tags,
      category: collection.category,
      usage: collection.usage,
      created_at: collection.createdAt.toISOString(),
      updated_at: collection.updatedAt.toISOString(),
      created_by: collection.createdBy,
    });

    if (error) {
      throw error;
    }
  }

  private async addAssetToCollection(collectionId: string, assetId: string): Promise<void> {
    const supabase = await this.getSupabase();
    const { error } = await supabase.from('collection_assets').upsert({
      collection_id: collectionId,
      asset_id: assetId,
      added_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  }

  private async addAssetsToCollection(collectionId: string, assetIds: string[]): Promise<void> {
    await Promise.all(
      assetIds.map((assetId: any) => this.addAssetToCollection(collectionId, assetId))
    );
  }

  private async getCollectionAssets(collectionId: string): Promise<Asset[]> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('collection_assets')
      .select(
        `
        assets (*)
      `
      )
      .eq('collection_id', collectionId);

    if (error) {
      throw error;
    }

    return (data || [])
      .map((row: any) => row.assets)
      .filter(Boolean)
      .map((assetData: any) => this.mapRowToAsset(assetData));
  }

  private mapRowToAsset(row: any): Asset {
    return {
      id: row.id,
      briefId: row.brief_id,
      fileName: row.file_name,
      originalName: row.original_name,
      fileType: row.file_type,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      metadata: row.metadata || {},
      tags: row.tags || [],
      category: row.category,
      usage: row.usage,
      dimensions: row.dimensions,
      colorPalette: row.color_palette,
      dominantColor: row.dominant_color,
      status: row.status,
      uploadedAt: new Date(row.uploaded_at),
      updatedAt: new Date(row.updated_at),
      uploadedBy: row.uploaded_by,
    };
  }

  private mapRowToCollection(row: any): AssetCollection {
    return {
      id: row.id,
      briefId: row.brief_id,
      name: row.name,
      description: row.description,
      assets: [], // Will be populated separately
      coverAssetId: row.cover_asset_id,
      tags: row.tags || [],
      category: row.category,
      usage: row.usage,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
    };
  }

  private getStoragePathFromUrl(url: string): string {
    // Extract path from storage URL
    const urlParts = url.split('/');
    return urlParts.slice(-2).join('/'); // Get last two parts (briefId/fileName)
  }

  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateCollectionId(): string {
    return `collection_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateFileName(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const extension = originalName.split('.').pop();
    const baseName = originalName.split('.').slice(0, -1).join('.');
    const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');

    return `${timestamp}_${random}_${safeName}.${extension}`;
  }
}

// Singleton instance
let assetManagerInstance: AssetManager | null = null;

export const getAssetManager = (): AssetManager => {
  if (!assetManagerInstance) {
    assetManagerInstance = new AssetManager();
  }
  return assetManagerInstance;
};

// Convenience functions
export const uploadAsset = (
  file: File,
  briefId: string,
  uploadedBy: string,
  options?: AssetUploadOptions
): Promise<Asset> => {
  return getAssetManager().uploadAsset(file, briefId, uploadedBy, options);
};

export const searchAssets = (options?: AssetSearchOptions) => {
  return getAssetManager().searchAssets(options);
};

export const getAssetById = (assetId: string) => {
  return getAssetManager().getAssetById(assetId);
};

export const deleteAsset = (assetId: string, deletedBy: string) => {
  return getAssetManager().deleteAsset(assetId, deletedBy);
};

export const createAssetCollection = (
  briefId: string,
  name: string,
  description: string,
  createdBy: string,
  options?: Parameters<AssetManager['createCollection']>[4]
) => {
  return getAssetManager().createCollection(briefId, name, description, createdBy, options);
};

export const getAssetCollections = (briefId: string) => {
  return getAssetManager().getCollections(briefId);
};
