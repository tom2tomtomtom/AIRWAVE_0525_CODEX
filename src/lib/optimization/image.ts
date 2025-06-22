import sharp from 'sharp';
import { getCache, CacheProfiles } from '@/lib/cache/redis-cache';
import { getLogger } from '@/lib/logger';

const logger = getLogger('image-optimization');

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  progressive?: boolean;
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
  crop?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'entropy' | 'attention';
  background?: string;
  overlay?: {
    image: Buffer;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number;
  };
}

export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  channels: number;
  density: number;
  hasAlpha: boolean;
  size: number;
}

export interface OptimizationResult {
  buffer: Buffer;
  metadata: ImageMetadata;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  processingTime: number;
}

export interface ResponsiveImageSet {
  sizes: Array<{
    width: number;
    buffer: Buffer;
    url?: string;
  }>;
  webp: Array<{
    width: number;
    buffer: Buffer;
    url?: string;
  }>;
  avif?: Array<{
    width: number;
    buffer: Buffer;
    url?: string;
  }>;
  metadata: ImageMetadata;
}

export class ImageOptimizer {
  private cache = getCache();
  
  // Standard responsive breakpoints
  private readonly RESPONSIVE_SIZES = [320, 640, 768, 1024, 1280, 1920];
  
  // Quality settings for different formats
  private readonly QUALITY_SETTINGS = {
    webp: { quality: 85, effort: 4 },
    avif: { quality: 75, effort: 4 },
    jpeg: { quality: 85, progressive: true },
    png: { compressionLevel: 8, progressive: true }
  };
  
  async optimizeImage(
    input: Buffer | string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(input, options);
      
      // Try to get from cache
      const cached = await this.cache.get<OptimizationResult>(
        cacheKey,
        { ...CacheProfiles.MEDIUM, prefix: 'img:' }
      );
      
      if (cached) {
        logger.debug(`Image optimization cache HIT: ${cacheKey.substring(0, 16)}...`);
        return cached;
      }
      
      // Load image
      let image = sharp(input);
      const originalMetadata = await image.metadata();
      const originalSize = Buffer.isBuffer(input) ? input.length : 0;
      
      // Apply transformations
      image = await this.applyTransformations(image, options);
      
      // Optimize format
      image = await this.optimizeFormat(image, options.format || 'auto', originalMetadata);
      
      // Generate output
      const buffer = await image.toBuffer();
      const metadata = await this.getImageMetadata(buffer);
      
      const result: OptimizationResult = {
        buffer,
        metadata,
        originalSize,
        optimizedSize: buffer.length,
        compressionRatio: originalSize > 0 ? (1 - buffer.length / originalSize) : 0,
        processingTime: Date.now() - startTime
      };
      
      // Cache result
      await this.cache.set(
        cacheKey,
        result,
        { ...CacheProfiles.MEDIUM, prefix: 'img:' }
      );
      
      logger.debug(`Image optimized: ${originalSize} -> ${buffer.length} bytes (${(result.compressionRatio * 100).toFixed(1)}% reduction)`);
      
      return result;
      
    } catch (error) {
      logger.error('Image optimization failed', error);
      throw error;
    }
  }
  
  async createResponsiveImages(
    input: Buffer | string,
    options: Omit<ImageOptimizationOptions, 'width' | 'height'> & {
      sizes?: number[];
      includeAvif?: boolean;
    } = {}
  ): Promise<ResponsiveImageSet> {
    const {
      sizes = this.RESPONSIVE_SIZES,
      includeAvif = true,
      ...baseOptions
    } = options;
    
    try {
      const originalMetadata = await sharp(input).metadata();
      const maxWidth = originalMetadata.width || 1920;
      
      // Filter sizes that are larger than original
      const validSizes = sizes.filter(size => size <= maxWidth);
      
      // Generate standard images
      const standardImages = await Promise.all(
        validSizes.map(async (width) => {
          const result = await this.optimizeImage(input, {
            ...baseOptions,
            width,
            format: 'auto'
          });
          return {
            width,
            buffer: result.buffer
          };
        })
      );
      
      // Generate WebP versions
      const webpImages = await Promise.all(
        validSizes.map(async (width) => {
          const result = await this.optimizeImage(input, {
            ...baseOptions,
            width,
            format: 'webp'
          });
          return {
            width,
            buffer: result.buffer
          };
        })
      );
      
      // Generate AVIF versions (if enabled)
      let avifImages: Array<{ width: number; buffer: Buffer }> | undefined;
      if (includeAvif) {
        avifImages = await Promise.all(
          validSizes.map(async (width) => {
            const result = await this.optimizeImage(input, {
              ...baseOptions,
              width,
              format: 'avif'
            });
            return {
              width,
              buffer: result.buffer
            };
          })
        );
      }
      
      const metadata = await this.getImageMetadata(standardImages[0].buffer);
      
      return {
        sizes: standardImages,
        webp: webpImages,
        avif: avifImages,
        metadata
      };
      
    } catch (error) {
      logger.error('Responsive image generation failed', error);
      throw error;
    }
  }
  
  async generatePlaceholder(
    input: Buffer | string,
    options: {
      width?: number;
      height?: number;
      blur?: number;
      quality?: number;
    } = {}
  ): Promise<Buffer> {
    const {
      width = 20,
      height = 20,
      blur = 10,
      quality = 20
    } = options;
    
    try {
      const placeholder = await sharp(input)
        .resize(width, height, { fit: 'cover' })
        .blur(blur)
        .jpeg({ quality })
        .toBuffer();
      
      return placeholder;
      
    } catch (error) {
      logger.error('Placeholder generation failed', error);
      throw error;
    }
  }
  
  async extractDominantColor(input: Buffer | string): Promise<string> {
    try {
      const { dominant } = await sharp(input)
        .resize(1, 1)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const [r, g, b] = dominant.data;
      return `rgb(${r}, ${g}, ${b})`;
      
    } catch (error) {
      logger.error('Dominant color extraction failed', error);
      return '#cccccc'; // Fallback color
    }
  }
  
  async analyzeImage(input: Buffer | string): Promise<{
    metadata: ImageMetadata;
    stats: sharp.Stats;
    dominantColor: string;
    isAnimated: boolean;
    hasTransparency: boolean;
  }> {
    try {
      const image = sharp(input);
      const [metadata, stats, dominantColor] = await Promise.all([
        this.getImageMetadata(input),
        image.stats(),
        this.extractDominantColor(input)
      ]);
      
      return {
        metadata,
        stats,
        dominantColor,
        isAnimated: metadata.format === 'gif' && (await image.metadata()).pages !== undefined,
        hasTransparency: metadata.hasAlpha
      };
      
    } catch (error) {
      logger.error('Image analysis failed', error);
      throw error;
    }
  }
  
  private async applyTransformations(
    image: sharp.Sharp,
    options: ImageOptimizationOptions
  ): Promise<sharp.Sharp> {
    let transformed = image;
    
    // Resize
    if (options.width || options.height) {
      transformed = transformed.resize(options.width, options.height, {
        fit: options.crop ? this.getCropStrategy(options.crop) : 'inside',
        withoutEnlargement: true,
        background: options.background || { r: 255, g: 255, b: 255, alpha: 1 }
      });
    }
    
    // Color adjustments
    if (options.grayscale) {
      transformed = transformed.grayscale();
    }
    
    // Blur
    if (options.blur && options.blur > 0) {
      transformed = transformed.blur(options.blur);
    }
    
    // Sharpen
    if (options.sharpen) {
      transformed = transformed.sharpen();
    }
    
    // Overlay
    if (options.overlay) {
      const { image: overlayImage, position, opacity = 1 } = options.overlay;
      const overlaySharp = sharp(overlayImage);
      
      if (opacity < 1) {
        await overlaySharp.composite([{
          input: Buffer.from([255, 255, 255, Math.round(255 * opacity)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }]);
      }
      
      transformed = transformed.composite([{
        input: await overlaySharp.toBuffer(),
        ...this.getOverlayPosition(position)
      }]);
    }
    
    return transformed;
  }
  
  private async optimizeFormat(
    image: sharp.Sharp,
    format: string,
    originalMetadata: sharp.Metadata
  ): Promise<sharp.Sharp> {
    const targetFormat = format === 'auto' ? this.selectOptimalFormat(originalMetadata) : format;
    
    switch (targetFormat) {
      case 'webp':
        return image.webp(this.QUALITY_SETTINGS.webp);
        
      case 'avif':
        return image.avif(this.QUALITY_SETTINGS.avif);
        
      case 'jpeg':
        return image.jpeg(this.QUALITY_SETTINGS.jpeg);
        
      case 'png':
        return image.png(this.QUALITY_SETTINGS.png);
        
      default:
        // Keep original format
        return image;
    }
  }
  
  private selectOptimalFormat(metadata: sharp.Metadata): string {
    // If image has transparency, prefer PNG or WebP
    if (metadata.hasAlpha) {
      return 'webp';
    }
    
    // For photos, prefer JPEG or WebP
    if (metadata.density && metadata.density > 150) {
      return 'webp';
    }
    
    // Default to WebP for best compression
    return 'webp';
  }
  
  private getCropStrategy(crop: string): keyof sharp.FitEnum {
    const strategies: Record<string, keyof sharp.FitEnum> = {
      center: 'cover',
      top: 'cover',
      bottom: 'cover',
      left: 'cover',
      right: 'cover',
      entropy: 'cover',
      attention: 'cover'
    };
    
    return strategies[crop] || 'cover';
  }
  
  private getOverlayPosition(position: string): { gravity?: string; top?: number; left?: number } {
    switch (position) {
      case 'top-left':
        return { gravity: 'northwest' };
      case 'top-right':
        return { gravity: 'northeast' };
      case 'bottom-left':
        return { gravity: 'southwest' };
      case 'bottom-right':
        return { gravity: 'southeast' };
      case 'center':
      default:
        return { gravity: 'center' };
    }
  }
  
  private async getImageMetadata(input: Buffer | string): Promise<ImageMetadata> {
    const metadata = await sharp(input).metadata();
    
    return {
      format: metadata.format || 'unknown',
      width: metadata.width || 0,
      height: metadata.height || 0,
      channels: metadata.channels || 0,
      density: metadata.density || 0,
      hasAlpha: metadata.hasAlpha || false,
      size: Buffer.isBuffer(input) ? input.length : 0
    };
  }
  
  private generateCacheKey(input: Buffer | string, options: ImageOptimizationOptions): string {
    let inputHash: string;
    
    if (Buffer.isBuffer(input)) {
      // Generate hash from buffer
      const crypto = require('crypto');
      inputHash = crypto.createHash('md5').update(input).digest('hex').substring(0, 16);
    } else {
      // Use string as-is (assuming it's a URL or path)
      inputHash = input.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 32);
    }
    
    const optionsHash = JSON.stringify(options);
    const crypto = require('crypto');
    const optsHash = crypto.createHash('md5').update(optionsHash).digest('hex').substring(0, 8);
    
    return `${inputHash}_${optsHash}`;
  }
}

// Singleton instance
let optimizerInstance: ImageOptimizer | null = null;

export const getImageOptimizer = (): ImageOptimizer => {
  if (!optimizerInstance) {
    optimizerInstance = new ImageOptimizer();
  }
  return optimizerInstance;
};

// Convenience functions
export const optimizeImage = (
  input: Buffer | string,
  options?: ImageOptimizationOptions
): Promise<OptimizationResult> => {
  return getImageOptimizer().optimizeImage(input, options);
};

export const createResponsiveImages = (
  input: Buffer | string,
  options?: Parameters<ImageOptimizer['createResponsiveImages']>[1]
): Promise<ResponsiveImageSet> => {
  return getImageOptimizer().createResponsiveImages(input, options);
};

export const generatePlaceholder = (
  input: Buffer | string,
  options?: Parameters<ImageOptimizer['generatePlaceholder']>[1]
): Promise<Buffer> => {
  return getImageOptimizer().generatePlaceholder(input, options);
};

export const analyzeImage = (
  input: Buffer | string
): Promise<ReturnType<ImageOptimizer['analyzeImage']>> => {
  return getImageOptimizer().analyzeImage(input);
};