import { getLogger } from '@/lib/logger';
import { classifyError } from '@/lib/error-handling/error-classifier';
import { PopulatedTemplate } from './templateEngine';
import { createClient } from '@/lib/supabase/server';

const logger = getLogger('campaign-renderer');

export interface RenderedCampaign {
  id: string;
  templateId: string;
  briefId: string;
  name: string;
  description: string;
  renderFormat: 'html' | 'image' | 'video' | 'pdf' | 'svg' | 'canvas';
  outputFiles: RenderOutput[];
  metadata: RenderMetadata;
  quality: 'draft' | 'preview' | 'high' | 'print';
  dimensions: {},
  width: number;
    height: number;
    dpi?: number;
    aspectRatio: string;
  };
  status: 'rendering' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  renderedAt: Date;
  renderTime: number; // milliseconds
  version: number;
}

export interface RenderOutput {
  id: string;
  type: 'main' | 'thumbnail' | 'preview' | 'variant' | 'layer';
  format: 'png' | 'jpg' | 'webp' | 'svg' | 'pdf' | 'mp4' | 'gif' | 'html';
  url: string;
  fileSize: number;
  dimensions: {},
  width: number;
    height: number;
  };
  quality: number; // 0-100
  metadata: {},
        colorSpace?: 'sRGB' | 'CMYK' | 'RGB';
    compression?: string;
    layers?: string[];
    duration?: number; // for video/gif
    frameRate?: number;
  
      };
}

export interface RenderMetadata {
  renderEngine: 'canvas' | 'svg' | 'html2canvas' | 'puppeteer' | 'sharp';
  totalElements: number;
  renderLayers: number;
  assetCount: number;
  textElements: number;
  effects: string[];
  colorProfile: string;
  fonts: string[];
  estimatedPrintCost?: number;
  estimatedFileSize: number;
  optimization: {},
  compression: number;
    quality: number;
    webOptimized: boolean;
    printReady: boolean;
  };
}

export interface RenderOptions {
  quality?: 'draft' | 'preview' | 'high' | 'print';
  format?: RenderedCampaign['renderFormat'];
  outputFormats?: Array<RenderOutput['format']>;
  dimensions?: {
    width?: number;
    height?: number;
    dpi?: number;
    scale?: number;
  };
  optimization?: {
    compress?: boolean;
    webOptimize?: boolean;
    printOptimize?: boolean;
    targetFileSize?: number; // bytes
  };
  effects?: {
    shadows?: boolean;
    gradients?: boolean;
    filters?: string[];
    animations?: boolean;
  };
  batch?: {
    variants?: string[];
    platforms?: string[];
    sizes?: Array<{ width: number; height: number; name: string }>;
  };
  watermark?: {
    enabled: boolean;
    text?: string;
    opacity?: number;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  };
}

export interface BatchRenderJob {
  id: string;
  name: string;
  templates: PopulatedTemplate[];
  options: RenderOptions;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  results: RenderedCampaign[];
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
  totalRenderTime: number;
}

export class CampaignRenderer {
  private supabase = createClient();
  private readonly STORAGE_BUCKET = 'rendered-campaigns';
  private readonly MAX_RENDER_TIME = 300000; // 5 minutes
  private readonly QUALITY_SETTINGS = {
    draft: { scale: 0.5, quality: 60, dpi: 72  },
  preview: { scale: 0.8, quality: 80, dpi: 96  },
  high: { scale: 1.0, quality: 95, dpi: 150  },
  print: { scale: 1.0, quality: 100, dpi: 300 }
  };

  private readonly DEFAULT_FORMATS: Record<string, RenderOutput['format'][]> = {
    social: ['jpg', 'png', 'webp'],
    web: ['png', 'webp', 'svg'],
    email: ['jpg', 'png'],
    print: ['pdf', 'png'],
    video: ['mp4', 'gif']
  };

  async renderCampaign(
    populatedTemplate: PopulatedTemplate,
    options: RenderOptions = {}
  ): Promise<RenderedCampaign> {
    const {
      quality = 'high',
      format = 'html',
      outputFormats = ['png', 'jpg'],
      optimization = {},
      effects = {},
      watermark = { enabled: false }
    } = options;

    const startTime = Date.now();

    try {
      logger.info('Starting campaign render', {
        templateId: populatedTemplate.templateId,
        briefId: populatedTemplate.briefId,
        quality,
        format,
        outputFormats
      });

      // Validate render request
      await this.validateRenderRequest(populatedTemplate, options);

      // Create render job
      const renderedCampaign: RenderedCampaign = {
        id: this.generateRenderId(),
        templateId: populatedTemplate.templateId,
        briefId: populatedTemplate.briefId,
        name: `${populatedTemplate.name} - Rendered`,
        description: `Rendered campaign from ${populatedTemplate.name}`,
        renderFormat: format,
        outputFiles: [],
        metadata: {},
        renderEngine: this.selectRenderEngine(format),
          totalElements: populatedTemplate.populatedComponents.length,
          renderLayers: this.calculateRenderLayers(populatedTemplate),
          assetCount: populatedTemplate.selectedAssets.length,
          textElements: this.countTextElements(populatedTemplate),
          effects: Object.keys(effects).filter((key: any) => effects[key as keyof typeof effects]),
          colorProfile: 'sRGB',
          fonts: this.extractFonts(populatedTemplate),
          estimatedFileSize: 0,
          optimization: {},
  compression: optimization.compress ? 85 : 100,
            quality: this.QUALITY_SETTINGS[quality].quality,
            webOptimized: optimization.webOptimize || false,
            printReady: optimization.printOptimize || false
          }
        },
        quality,
        dimensions: this.calculateDimensions(populatedTemplate, options.dimensions),
        status: 'rendering',
        progress: 0,
        renderedAt: new Date(),
        renderTime: 0,
        version: 1
      };

      // Update progress
      renderedCampaign.progress = 10;

      // Prepare render data
      const renderData = await this.prepareRenderData(populatedTemplate, options);
      renderedCampaign.progress = 20;

      // Generate base render
      const baseRender = await this.generateBaseRender(renderData, renderedCampaign);
      renderedCampaign.progress = 50;

      // Apply effects and optimizations
      const processedRender = await this.applyEffectsAndOptimizations(baseRender, effects, optimization);
      renderedCampaign.progress = 70;

      // Generate output formats
      const outputFiles = await this.generateOutputFormats(
        processedRender,
        outputFormats,
        renderedCampaign,
        watermark
      );
      renderedCampaign.outputFiles = outputFiles;
      renderedCampaign.progress = 90;

      // Upload to storage
      await this.uploadRenderOutputs(renderedCampaign);
      renderedCampaign.progress = 95;

      // Finalize
      renderedCampaign.status = 'completed';
      renderedCampaign.progress = 100;
      renderedCampaign.renderTime = Date.now() - startTime;

      // Update metadata
      renderedCampaign.metadata.estimatedFileSize = outputFiles.reduce(
        (sum, file) => sum + file.fileSize, 0
      );

      // Save to database
      await this.saveRenderedCampaign(renderedCampaign);

      logger.info('Campaign render completed', {
        renderId: renderedCampaign.id,
        renderTime: renderedCampaign.renderTime,
        outputFiles: outputFiles.length,
        totalSize: renderedCampaign.metadata.estimatedFileSize
      });

      return renderedCampaign;

    } catch (error: any) {
      const classified = classifyError(error as Error, {
        route: 'campaign-renderer',
        metadata: { 
          templateId: populatedTemplate.templateId,
          briefId: populatedTemplate.briefId,
          quality,
          format
        }
      });
      
      logger.error('Campaign render failed', classified.originalError);
      throw error;
    }
  }

  async renderBatch(
    templates: PopulatedTemplate[],
    options: RenderOptions = {}
  ): Promise<BatchRenderJob> {
    const job: BatchRenderJob = {
      id: this.generateBatchId(),
      name: `Batch Render - ${templates.length} campaigns`,
      templates,
      options,
      status: 'queued',
      progress: 0,
      results: [],
      errors: [],
      startedAt: new Date(),
      totalRenderTime: 0
    };

    try {
      logger.info('Starting batch render', {
        jobId: job.id,
        templateCount: templates.length,
        options
      });

      job.status = 'processing';
      const startTime = Date.now();

      for (let i = 0; i < templates.length; i++) {
        try {
          const rendered = await this.renderCampaign(templates[i], options);
          job.results.push(rendered);
          job.progress = Math.round(((i + 1) / templates.length) * 100);
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          job.errors.push(`Template ${templates[i].id}: ${errorMessage}`);
          logger.warn('Batch render item failed', { templateId: templates[i].id, error: errorMessage });
        }
      }

      job.status = job.errors.length === templates.length ? 'failed' : 'completed';
      job.completedAt = new Date();
      job.totalRenderTime = Date.now() - startTime;

      logger.info('Batch render completed', {
        jobId: job.id,
        successful: job.results.length,
        failed: job.errors.length,
        totalTime: job.totalRenderTime
      });

      return job;

    } catch (error: any) {
      job.status = 'failed';
      job.completedAt = new Date();
      logger.error('Batch render failed', error);
      throw error;
    }
  }

  async getRenderedCampaign(renderId: string): Promise<RenderedCampaign | null> {
    try {
      const { data, error } = await this.supabase
        .from('rendered_campaigns')
        .select('*')
        .eq('id', renderId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapRowToRenderedCampaign(data);

    } catch (error: any) {
      logger.error('Failed to get rendered campaign', error);
      throw error;
    }
  }

  async getRenderProgress(renderId: string): Promise<{
    status: RenderedCampaign['status'];
    progress: number;
    estimatedTimeRemaining?: number;
  } | null> {
    const campaign = await this.getRenderedCampaign(renderId);
    if (!campaign) return null;

    let estimatedTimeRemaining: number | undefined;
    if (campaign.status === 'rendering' && campaign.progress > 0) {
      const elapsed = Date.now() - campaign.renderedAt.getTime();
      const progressRate = campaign.progress / elapsed;
      estimatedTimeRemaining = (100 - campaign.progress) / progressRate;
    }

    return {
      status: campaign.status,
      progress: campaign.progress,
      estimatedTimeRemaining
    };
  }

  async cancelRender(renderId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('rendered_campaigns')
        .update({ status: 'cancelled' })
        .eq('id', renderId);

      if (error) throw error;

      logger.info('Render cancelled', { renderId });

    } catch (error: any) {
      logger.error('Failed to cancel render', error);
      throw error;
    }
  }

  // Private methods
  private async validateRenderRequest(
    populatedTemplate: PopulatedTemplate,
    options: RenderOptions
  ): Promise<void> {
    // Check if template is ready
    if (populatedTemplate.status !== 'ready') {
      throw new Error('Template must be in ready status for rendering');
    }

    // Validate required components are populated
    const missingContent = populatedTemplate.populatedComponents.filter(
      component => !component.content.text && !component.content.assetUrl
    );

    if (missingContent.length > 0) {
      throw new Error(`Missing content for ${missingContent.length} components`);
    }

    // Validate dimensions
    if (options.dimensions?.width && options.dimensions.width > 10000) {
      throw new Error('Maximum width exceeded (10000px)');
    }

    if (options.dimensions?.height && options.dimensions.height > 10000) {
      throw new Error('Maximum height exceeded (10000px)');
    }
  }

  private selectRenderEngine(format: string): RenderMetadata['renderEngine'] {
    switch (format) {
      case 'html': return 'html2canvas';
      case 'image': return 'sharp';
      case 'svg': return 'svg';
      case 'pdf': return 'puppeteer';
      case 'canvas': return 'canvas';
      default: return 'html2canvas';
    }
  }

  private calculateRenderLayers(populatedTemplate: PopulatedTemplate): number {
    // Count z-index layers
    const zIndices = new Set(
      populatedTemplate.populatedComponents
        .map((c: any) => c.finalStyling.zIndex)
        .filter((z: any) => z !== undefined)
    );
    return Math.max(zIndices.size, 1);
  }

  private countTextElements(populatedTemplate: PopulatedTemplate): number {
    return populatedTemplate.populatedComponents.filter(
      c => c.content.text
    ).length;
  }

  private extractFonts(populatedTemplate: PopulatedTemplate): string[] {
    const fonts = new Set<string>();
    populatedTemplate.populatedComponents.forEach((component: any) => {
      // Extract font families from CSS or styling
      if (component.finalStyling) {
        // Would parse font-family from styling
        fonts.add('Arial'); // Placeholder
      }
    });
    return Array.from(fonts);
  }

  private calculateDimensions(
    populatedTemplate: PopulatedTemplate,
    dimensionOptions?: RenderOptions['dimensions']
  ): RenderedCampaign['dimensions'] {
    // Get template dimensions from render data
    const templateDimensions = this.parseTemplateDimensions(populatedTemplate.renderData.html || '');
    
    const width = dimensionOptions?.width || templateDimensions.width || 1920;
    const height = dimensionOptions?.height || templateDimensions.height || 1080;
    const dpi = dimensionOptions?.dpi || 150;
    
    return {
      width,
      height,
      dpi,
      aspectRatio: `${width}:${height}`
    };
  }

  private parseTemplateDimensions(html: string): { width: number; height: number } {
    // Parse dimensions from HTML
    const widthMatch = html.match(/width:\s*(\d+)px/);
    const heightMatch = html.match(/height:\s*(\d+)px/);
    
    return {
      width: widthMatch ? parseInt(widthMatch[1]) : 1920,
      height: heightMatch ? parseInt(heightMatch[1]) : 1080
    };
  }

  private async prepareRenderData(
    populatedTemplate: PopulatedTemplate,
    options: RenderOptions
  ): Promise<{
    html: string;
    css: string;
    assets: Array<{ url: string; local: string }>;
    fonts: string[];
  }> {
    // Download and cache assets locally for rendering
    const assets = await Promise.all(
      populatedTemplate.selectedAssets.map(async (asset) => ({
        url: asset.url,
        local: await this.cacheAssetLocally(asset.url)
      }))
    );

    // Prepare HTML with local asset references
    let html = populatedTemplate.renderData.html || '';
    let css = populatedTemplate.renderData.css || '';

    // Replace asset URLs with local paths
    assets.forEach((asset: any) => {
      html = html.replace(asset.url, asset.local);
      css = css.replace(asset.url, asset.local);
    });

    return {
      html,
      css,
      assets,
      fonts: this.extractFonts(populatedTemplate)
    };
  }

  private async cacheAssetLocally(url: string): Promise<string> {
    // In production, would download and cache assets
    // For now, return the original URL
    return url;
  }

  private async generateBaseRender(
    renderData: any,
    renderedCampaign: RenderedCampaign
  ): Promise<Buffer> {
    // Placeholder for actual rendering
    // In production, would use puppeteer, canvas, or other rendering engines
    
    switch (renderedCampaign.metadata.renderEngine) {
      case 'html2canvas':
        return await this.renderWithHtml2Canvas(renderData, renderedCampaign);
      case 'puppeteer':
        return await this.renderWithPuppeteer(renderData, renderedCampaign);
      case 'canvas':
        return await this.renderWithCanvas(renderData, renderedCampaign);
      case 'svg':
        return await this.renderWithSvg(renderData, renderedCampaign);
      default:
        throw new Error(`Unsupported render engine: ${renderedCampaign.metadata.renderEngine}`);
    }
  }

  private async renderWithHtml2Canvas(renderData: any, campaign: RenderedCampaign): Promise<Buffer> {
    // Placeholder - would use html2canvas or similar
    return Buffer.from('mock-html2canvas-render');
  }

  private async renderWithPuppeteer(renderData: any, campaign: RenderedCampaign): Promise<Buffer> {
    // Placeholder - would use puppeteer for PDF/image generation
    return Buffer.from('mock-puppeteer-render');
  }

  private async renderWithCanvas(renderData: any, campaign: RenderedCampaign): Promise<Buffer> {
    // Placeholder - would use canvas for programmatic rendering
    return Buffer.from('mock-canvas-render');
  }

  private async renderWithSvg(renderData: any, campaign: RenderedCampaign): Promise<Buffer> {
    // Placeholder - would generate SVG
    return Buffer.from('mock-svg-render');
  }

  private async applyEffectsAndOptimizations(
    baseRender: Buffer,
    effects: RenderOptions['effects'] = { },
  optimization: RenderOptions['optimization'] = {}
  ): Promise<Buffer> {
    let processed = baseRender;

    // Apply effects (shadows, gradients, filters)
    if (effects.shadows) {
      processed = await this.applyShadows(processed);
    }

    if (effects.filters && effects.filters.length > 0) {
      processed = await this.applyFilters(processed, effects.filters);
    }

    // Apply optimizations
    if (optimization.compress) {
      processed = await this.compressImage(processed, optimization.targetFileSize);
    }

    return processed;
  }

  private async applyShadows(buffer: Buffer): Promise<Buffer> {
    // Placeholder for shadow effects
    return buffer;
  }

  private async applyFilters(buffer: Buffer, filters: string[]): Promise<Buffer> {
    // Placeholder for filter effects
    return buffer;
  }

  private async compressImage(buffer: Buffer, targetSize?: number): Promise<Buffer> {
    // Placeholder for image compression
    return buffer;
  }

  private async generateOutputFormats(
    processedRender: Buffer,
    formats: Array<RenderOutput['format']>,
    campaign: RenderedCampaign,
    watermark: RenderOptions['watermark']
  ): Promise<RenderOutput[]> {
    const outputs: RenderOutput[] = [];

    for (const format of formats) {
      let converted = processedRender;

      // Convert to target format
      if (format !== 'png') {
        converted = await this.convertFormat(processedRender, format);
      }

      // Apply watermark if enabled
      if (watermark?.enabled) {
        converted = await this.applyWatermark(converted, watermark);
      }

      const output: RenderOutput = {
        id: this.generateOutputId(),
        type: 'main',
        format,
        url: '', // Will be set after upload
        fileSize: converted.length,
        dimensions: campaign.dimensions,
        quality: campaign.metadata.optimization.quality,
        metadata: {},
        colorSpace: 'sRGB',
          compression: format === 'jpg' ? 'jpeg' : 'lossless'
        
      }
      };

      outputs.push(output);
    }

    // Generate thumbnail
    const thumbnail = await this.generateThumbnail(processedRender);
    outputs.push({
      id: this.generateOutputId(),
      type: 'thumbnail',
      format: 'jpg',
      url: '',
      fileSize: thumbnail.length,
      dimensions: { width: 300, height: Math.round(300 * campaign.dimensions.height / campaign.dimensions.width)  },
  quality: 80,
      metadata: { colorSpace: 'sRGB', compression: 'jpeg' }
    });

    return outputs;
  }

  private async convertFormat(buffer: Buffer, format: RenderOutput['format']): Promise<Buffer> {
    // Placeholder for format conversion using Sharp or similar
    return buffer;
  }

  private async applyWatermark(buffer: Buffer, watermark: NonNullable<RenderOptions['watermark']>): Promise<Buffer> {
    // Placeholder for watermark application
    return buffer;
  }

  private async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    // Placeholder for thumbnail generation
    return buffer;
  }

  private async uploadRenderOutputs(campaign: RenderedCampaign): Promise<void> {
    for (const output of campaign.outputFiles) {
      const path = `${campaign.briefId}/${campaign.id}/${output.id}.${output.format}`;
      
      // In production, would upload to storage
      output.url = `https://storage.example.com/${this.STORAGE_BUCKET}/${path}`;
    }
  }

  private async saveRenderedCampaign(campaign: RenderedCampaign): Promise<void> {
    const { error } = await this.supabase
      .from('rendered_campaigns')
      .upsert({
        id: campaign.id,
        template_id: campaign.templateId,
        brief_id: campaign.briefId,
        name: campaign.name,
        description: campaign.description,
        render_format: campaign.renderFormat,
        output_files: campaign.outputFiles,
        metadata: campaign.metadata,
        quality: campaign.quality,
        dimensions: campaign.dimensions,
        status: campaign.status,
        progress: campaign.progress,
        rendered_at: campaign.renderedAt.toISOString(),
        render_time: campaign.renderTime,
        version: campaign.version
      });

    if (error) {
      throw error;
    }
  }

  private mapRowToRenderedCampaign(row: any): RenderedCampaign {
    return {
      id: row.id,
      templateId: row.template_id,
      briefId: row.brief_id,
      name: row.name,
      description: row.description,
      renderFormat: row.render_format,
      outputFiles: row.output_files || [],
      metadata: row.metadata || { },
  quality: row.quality,
      dimensions: row.dimensions || { },
  status: row.status,
      progress: row.progress || 0,
      renderedAt: new Date(row.rendered_at),
      renderTime: row.render_time || 0,
      version: row.version || 1
    };
  }

  // Utility methods
  private generateRenderId(): string {
    return `render_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateOutputId(): string {
    return `output_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let campaignRendererInstance: CampaignRenderer | null = null;

export const getCampaignRenderer = (): CampaignRenderer => {
  if (!campaignRendererInstance) {
    campaignRendererInstance = new CampaignRenderer();
  }
  return campaignRendererInstance;
};

// Convenience functions
export const renderCampaign = (
  populatedTemplate: PopulatedTemplate,
  options?: RenderOptions
): Promise<RenderedCampaign> => {
  return getCampaignRenderer().renderCampaign(populatedTemplate, options);
};

export const renderBatch = (
  templates: PopulatedTemplate[],
  options?: RenderOptions
): Promise<BatchRenderJob> => {
  return getCampaignRenderer().renderBatch(templates, options);
};

export const getRenderedCampaign = (renderId: string) => {
  return getCampaignRenderer().getRenderedCampaign(renderId);
};

export const getRenderProgress = (renderId: string) => {
  return getCampaignRenderer().getRenderProgress(renderId);
};