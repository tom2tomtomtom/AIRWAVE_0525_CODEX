import { getLogger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { RenderedCampaign, RenderOutput } from './campaignRenderer';
import { Asset } from './assetManager';

const logger = getLogger('export-engine');

export interface ExportJob {
  id: string;
  name: string;
  description: string;
  campaignIds: string[];
  exportFormat: ExportFormat;
  destination: ExportDestination;
  options: ExportOptions;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  results: ExportResult[];
  errors: string[];
  metadata: ExportMetadata;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface ExportFormat {
  type: 'package' | 'archive' | 'platform' | 'print' | 'web' | 'email' | 'social';
  packaging: 'zip' | 'tar' | 'folder' | 'individual';
  compression: 'none' | 'lossless' | 'lossy' | 'adaptive';
  qualitySettings: {
    images: 'web' | 'print' | 'high' | 'original';
    documents: 'compressed' | 'standard' | 'high';
    videos: 'web' | 'social' | 'broadcast' | 'original';
  };
  fileNaming: {
    pattern: string; // e.g., "{campaign}_{version}_{format}"
    includeMetadata: boolean;
    includeTimestamp: boolean;
    sanitize: boolean;
  };
  includedAssets: Array<Asset['fileType']>;
  outputFormats: Array<RenderOutput['format']>;
}

export interface ExportDestination {
  type: 'download' | 'storage' | 'ftp' | 'cloud' | 'email' | 'platform_api';
  config: {
    // For storage/cloud
    bucket?: string;
    path?: string;
    region?: string;
    
    // For FTP
    host?: string;
    username?: string;
    password?: string;
    
    // For email
    recipients?: string[];
    subject?: string;
    
    // For platform APIs
    platform?: 'facebook' | 'google_ads' | 'instagram' | 'linkedin' | 'twitter';
    apiKey?: string;
    accountId?: string;
    
    // Common
    credentials?: Record<string, string>;
    metadata?: Record<string, any>;
  };
}

export interface ExportOptions {
  includeSourceFiles?: boolean;
  includeAssets?: boolean;
  includeDocumentation?: boolean;
  includeBriefing?: boolean;
  includeApprovals?: boolean;
  createManifest?: boolean;
  generatePreviews?: boolean;
  watermarkOutputs?: boolean;
  customStructure?: {
    folders: Array<{
      name: string;
      contents: string[];
      structure?: 'flat' | 'nested';
    }>;
  };
  versionControl?: {
    enabled: boolean;
    strategy: 'increment' | 'timestamp' | 'hash';
    prefix?: string;
  };
  notifications?: {
    onComplete: boolean;
    onFailure: boolean;
    recipients: string[];
    customMessage?: string;
  };
  batchSettings?: {
    maxConcurrent: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

export interface ExportResult {
  id: string;
  campaignId: string;
  campaignName: string;
  files: ExportFile[];
  downloadUrl?: string;
  status: 'success' | 'partial' | 'failed';
  errors: string[];
  warnings: string[];
  metadata: {
    totalFiles: number;
    totalSize: number;
    exportTime: number;
    version: string;
  };
}

export interface ExportFile {
  id: string;
  originalId?: string; // Reference to original render output or asset
  name: string;
  path: string;
  type: 'render' | 'asset' | 'document' | 'metadata';
  format: string;
  size: number;
  checksum: string;
  url?: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    created: Date;
    modified: Date;
  };
}

export interface ExportMetadata {
  totalCampaigns: number;
  totalFiles: number;
  totalSize: number;
  estimatedSize: number;
  exportDuration: number;
  compression: {
    originalSize: number;
    compressedSize: number;
    ratio: number;
  };
  quality: {
    averageImageQuality: number;
    averageFileSize: number;
    lossyConversions: number;
  };
  platformCompatibility: Array<{
    platform: string;
    compatible: boolean;
    issues: string[];
  }>;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'social' | 'web' | 'email' | 'print' | 'video' | 'general';
  format: ExportFormat;
  destination: Partial<ExportDestination>;
  options: Partial<ExportOptions>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface PlatformSpec {
  platform: string;
  requirements: {
    imageFormats: string[];
    videoFormats: string[];
    maxFileSize: number;
    dimensions: Array<{
      width: number;
      height: number;
      aspectRatio: string;
      purpose: string;
    }>;
    naming: {
      pattern: string;
      maxLength: number;
      allowedChars: string;
    };
  };
  qualitySettings: {
    imageQuality: number;
    compression: string;
    colorSpace: string;
  };
}

export class ExportEngine {
  private supabase = createClient();
  // Storage bucket configuration (for future use)
  // private readonly STORAGE_BUCKET = 'exports';
  private readonly MAX_EXPORT_SIZE = 1024 * 1024 * 1024; // 1GB
  // Supported format validation (for future use)
  // private readonly SUPPORTED_FORMATS = ['png', 'jpg', 'webp', 'svg', 'pdf', 'mp4', 'gif'];
  
  private platformSpecs: Map<string, PlatformSpec> = new Map();
  private exportTemplates: Map<string, ExportTemplate> = new Map();

  constructor() {
    this.initializePlatformSpecs();
    this.initializeExportTemplates();
  }

  async createExportJob(
    campaignIds: string[],
    exportFormat: ExportFormat,
    destination: ExportDestination,
    options: ExportOptions = {},
    createdBy: string,
    jobName?: string
  ): Promise<ExportJob> {
    try {
      logger.info('Creating export job', {
        campaignIds: campaignIds.length,
        formatType: exportFormat.type,
        destinationType: destination.type
      });

      // Validate campaigns exist and are exportable
      await this.validateCampaigns(campaignIds);

      // Estimate export size and duration
      const estimations = await this.estimateExport(campaignIds, exportFormat, options);

      if (estimations.totalSize > this.MAX_EXPORT_SIZE) {
        throw new Error(`Export size (${this.formatBytes(estimations.totalSize)}) exceeds maximum allowed (${this.formatBytes(this.MAX_EXPORT_SIZE)})`);
      }

      const exportJob: ExportJob = {
        id: this.generateExportId(),
        name: jobName || `Export - ${new Date().toISOString().split('T')[0]}`,
        description: `Export of ${campaignIds.length} campaigns`,
        campaignIds,
        exportFormat,
        destination,
        options,
        status: 'queued',
        progress: 0,
        results: [],
        errors: [],
        metadata: {
        totalCampaigns: campaignIds.length,
          totalFiles: estimations.totalFiles,
          totalSize: 0,
          estimatedSize: estimations.totalSize,
          exportDuration: 0,
          compression: { originalSize: 0, compressedSize: 0, ratio: 0 },
          quality: { averageImageQuality: 0, averageFileSize: 0, lossyConversions: 0 },
          platformCompatibility: []
        },
        createdAt: new Date(),
        createdBy
      };

      // Save export job
      await this.saveExportJob(exportJob);

      // Queue for processing
      await this.queueExportJob(exportJob);

      return exportJob;

    } catch (error: any) {
      logger.error('Failed to create export job', error);
      throw error;
    }
  }

  async processExportJob(jobId: string): Promise<ExportJob> {
    try {
      const job = await this.getExportJob(jobId);
      if (!job) {
        throw new Error('Export job not found');
      }

      if (job.status !== 'queued') {
        throw new Error(`Cannot process job in status: ${job.status}`);
      }

      logger.info('Processing export job', { jobId, campaignCount: job.campaignIds.length });

      job.status = 'processing';
      job.startedAt = new Date();
      job.progress = 0;
      await this.updateExportJob(job);

      const startTime = Date.now();

      // Process each campaign
      for (let i = 0; i < job.campaignIds.length; i++) {
        try {
          const campaignId = job.campaignIds[i];
          const result = await this.exportCampaign(campaignId!, job);
          job.results.push(result);
          
          job.progress = Math.round(((i + 1) / job.campaignIds.length) * 90); // Reserve 10% for final steps
          await this.updateExportJob(job);

        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          job.errors.push(`Campaign ${job.campaignIds[i]}: ${errorMessage}`);
          logger.warn('Campaign export failed', { campaignId: job.campaignIds[i], error: errorMessage });
        }
      }

      // Finalize export
      await this.finalizeExport(job);

      job.status = job.errors.length === job.campaignIds.length ? 'failed' : 'completed';
      job.completedAt = new Date();
      job.progress = 100;
      job.metadata.exportDuration = Date.now() - startTime;

      // Calculate final metadata
      job.metadata.totalFiles = job.results.reduce((sum, r) => sum + r.files.length, 0);
      job.metadata.totalSize = job.results.reduce((sum, r) => sum + r.metadata.totalSize, 0);

      await this.updateExportJob(job);

      // Send notifications
      if (job.options.notifications?.onComplete) {
        await this.sendCompletionNotification(job);
      }

      logger.info('Export job completed', {
        jobId,
        status: job.status,
        duration: job.metadata.exportDuration,
        totalFiles: job.metadata.totalFiles,
        totalSize: job.metadata.totalSize
      });

      return job;

    } catch (error: any) {
      logger.error('Export job processing failed', error);
      throw error;
    }
  }

  async getExportJob(jobId: string): Promise<ExportJob | null> {
    try {
      const { data, error } = await this.supabase
        .from('export_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapRowToExportJob(data);

    } catch (error: any) {
      logger.error('Failed to get export job', error);
      throw error;
    }
  }

  async getExportProgress(jobId: string): Promise<{
    status: ExportJob['status'];
    progress: number;
    estimatedTimeRemaining?: number;
    currentStep?: string;
  } | null> {
    const job = await this.getExportJob(jobId);
    if (!job) return null;

    let estimatedTimeRemaining: number | undefined;
    let currentStep: string | undefined;

    if (job.status === 'processing' && job.startedAt && job.progress > 0) {
      const elapsed = Date.now() - job.startedAt.getTime();
      const progressRate = job.progress / elapsed;
      estimatedTimeRemaining = (100 - job.progress) / progressRate;

      // Determine current step
      if (job.progress < 90) {
        const completedCampaigns = Math.floor((job.progress / 90) * job.campaignIds.length);
        currentStep = `Processing campaign ${completedCampaigns + 1} of ${job.campaignIds.length}`;
      } else {
        currentStep = 'Finalizing export package';
      }
    }

    return {
      status: job.status,
      progress: job.progress,
      ...(estimatedTimeRemaining !== undefined && { estimatedTimeRemaining }),
      ...(currentStep !== undefined && { currentStep })
    };
  }

  async cancelExportJob(jobId: string): Promise<void> {
    try {
      const job = await this.getExportJob(jobId);
      if (!job) {
        throw new Error('Export job not found');
      }

      if (!['queued', 'processing'].includes(job.status)) {
        throw new Error(`Cannot cancel job in status: ${job.status}`);
      }

      job.status = 'cancelled';
      job.completedAt = new Date();
      await this.updateExportJob(job);

      logger.info('Export job cancelled', { jobId });

    } catch (error: any) {
      logger.error('Failed to cancel export job', error);
      throw error;
    }
  }

  async createExportTemplate(
    name: string,
    category: ExportTemplate['category'],
    format: ExportFormat,
    destination: Partial<ExportDestination>,
    options: Partial<ExportOptions>
  ): Promise<ExportTemplate> {
    const template: ExportTemplate = {
      id: this.generateTemplateId(),
      name,
      description: `Export template for ${category}`,
      category,
      format,
      destination,
      options,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    };

    this.exportTemplates.set(template.id, template);
    await this.saveExportTemplate(template);

    return template;
  }

  async getExportTemplates(category?: string): Promise<ExportTemplate[]> {
    const templates = Array.from(this.exportTemplates.values());
    return category 
      ? templates.filter((t: any) => t.category === category)
      : templates;
  }

  async exportToPlatform(
    campaignId: string,
    platform: string,
    credentials: Record<string, string>
  ): Promise<{
    success: boolean;
    platformResponse?: any;
    uploadedAssets: string[];
    errors: string[];
  }> {
    try {
      const spec = this.platformSpecs.get(platform);
      if (!spec) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Get campaign and validate platform compatibility
      const campaign = await this.getCampaign(campaignId);
      const compatibility = this.validatePlatformCompatibility(campaign!, spec);

      if (!compatibility.compatible) {
        throw new Error(`Campaign not compatible with ${platform}: ${compatibility.issues.join(', ')}`);
      }

      // Convert assets to platform requirements
      const convertedAssets = await this.convertAssetsForPlatform(campaign!, spec);

      // Upload to platform
      const uploadResults = await this.uploadToPlatform(platform, convertedAssets, credentials);

      return {
        success: uploadResults.success,
        platformResponse: uploadResults.response,
        uploadedAssets: uploadResults.uploadedAssets,
        errors: uploadResults.errors
      };

    } catch (error: any) {
      logger.error('Platform export failed', error);
      throw error;
    }
  }

  // Private methods
  private async validateCampaigns(campaignIds: string[]): Promise<void> {
    for (const campaignId of campaignIds) {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }
      if (campaign.status !== 'completed') {
        throw new Error(`Campaign not ready for export: ${campaignId} (status: ${campaign.status})`);
      }
    }
  }

  private async estimateExport(
    campaignIds: string[],
    format: ExportFormat,
    options: ExportOptions
  ): Promise<{ totalSize: number; totalFiles: number }> {
    let totalSize = 0;
    let totalFiles = 0;

    for (const campaignId of campaignIds) {
      const campaign = await this.getCampaign(campaignId);
      if (campaign) {
        // Estimate based on render outputs and assets
        const campaignSize = campaign.outputFiles.reduce((sum, file) => sum + file.fileSize, 0);
        const campaignFiles = campaign.outputFiles.length;

        // Apply compression estimate
        const compressionRatio = this.getCompressionRatio(format.compression);
        totalSize += campaignSize * compressionRatio;
        totalFiles += campaignFiles;

        // Add assets if included
        if (options.includeAssets) {
          // Would calculate asset sizes
          totalSize += 1024 * 1024; // Placeholder: 1MB per campaign
          totalFiles += 5; // Placeholder: 5 assets per campaign
        }

        // Add documentation if included
        if (options.includeDocumentation) {
          totalSize += 100 * 1024; // Placeholder: 100KB documentation
          totalFiles += 3; // Placeholder: 3 documentation files
        }
      }
    }

    return { totalSize, totalFiles };
  }

  private getCompressionRatio(compression: string): number {
    switch (compression) {
      case 'none': return 1.0;
      case 'lossless': return 0.8;
      case 'lossy': return 0.6;
      case 'adaptive': return 0.7;
      default: return 1.0;
    }
  }

  private async exportCampaign(campaignId: string, job: ExportJob): Promise<ExportResult> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const result: ExportResult = {
      id: this.generateResultId(),
      campaignId,
      campaignName: campaign.name,
      files: [],
      status: 'success',
      errors: [],
      warnings: [],
      metadata: {
        totalFiles: 0,
        totalSize: 0,
        exportTime: 0,
        version: this.generateVersion(job.options.versionControl)
      }
    };

    const startTime = Date.now();

    try {
      // Export render outputs
      for (const output of campaign.outputFiles) {
        if (job.exportFormat.outputFormats.includes(output.format)) {
          const file = await this.exportRenderOutput(output, job, result.metadata.version);
          result.files.push(file);
        }
      }

      // Export assets if requested
      if (job.options.includeAssets) {
        const assetFiles = await this.exportCampaignAssets(campaignId, job, result.metadata.version);
        result.files.push(...assetFiles);
      }

      // Generate documentation if requested
      if (job.options.includeDocumentation) {
        const docFiles = await this.generateDocumentation(campaign, job, result.metadata.version);
        result.files.push(...docFiles);
      }

      // Generate manifest if requested
      if (job.options.createManifest) {
        const manifestFile = await this.generateManifest(result, job);
        result.files.push(manifestFile);
      }

      result.metadata.totalFiles = result.files.length;
      result.metadata.totalSize = result.files.reduce((sum, file) => sum + file.size, 0);
      result.metadata.exportTime = Date.now() - startTime;

    } catch (error: any) {
      result.status = 'failed';
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  private async exportRenderOutput(
    output: RenderOutput,
    job: ExportJob,
    version: string
  ): Promise<ExportFile> {
    // Apply naming pattern
    const fileName = this.applyNamingPattern(
      job.exportFormat.fileNaming.pattern,
      {
        name: `output_${output.type}`,
        format: output.format,
        version,
        timestamp: new Date().getTime().toString()
      }
    );

    // Download and potentially convert file
    const fileData = await this.downloadAndConvert(output.url, output.format, job.exportFormat);

    return {
      id: this.generateFileId(),
      originalId: output.id,
      name: fileName,
      path: `renders/${fileName}`,
      type: 'render',
      format: output.format,
      size: fileData.length,
      checksum: this.calculateChecksum(fileData),
      metadata: {
        width: output.dimensions.width,
        height: output.dimensions.height,
        created: new Date(),
        modified: new Date()
      }
    };
  }

  private async exportCampaignAssets(
    _campaignId: string,
    _job: ExportJob,
    _version: string
  ): Promise<ExportFile[]> {
    // Placeholder for asset export
    // Would fetch and export campaign assets
    return [];
  }

  private async generateDocumentation(
    campaign: RenderedCampaign,
    _job: ExportJob,
    _version: string
  ): Promise<ExportFile[]> {
    // Generate campaign documentation
    const readme = this.generateReadmeContent(campaign);
    const readmeBuffer = Buffer.from(readme, 'utf-8');

    return [{
      id: this.generateFileId(),
      name: 'README.md',
      path: 'docs/README.md',
      type: 'document',
      format: 'md',
      size: readmeBuffer.length,
      checksum: this.calculateChecksum(readmeBuffer),
      metadata: {
        created: new Date(),
        modified: new Date()
      }
    }];
  }

  private generateReadmeContent(campaign: RenderedCampaign): string {
    return `# ${campaign.name}

## Campaign Information
- **ID**: ${campaign.id}
- **Created**: ${campaign.renderedAt.toISOString()}
- **Quality**: ${campaign.quality}
- **Format**: ${campaign.renderFormat}
- **Dimensions**: ${campaign.dimensions.width}x${campaign.dimensions.height}

## Output Files
${campaign.outputFiles.map((file: any) => `- ${file.name} (${file.format}, ${this.formatBytes(file.fileSize)})`).join('\n')}

## Metadata
- **Render Time**: ${campaign.renderTime}ms
- **Elements**: ${campaign.metadata.totalElements}
- **Assets**: ${campaign.metadata.assetCount}
- **Version**: ${campaign.version}

Generated by AIRWAVE Export Engine
`;
  }

  private async generateManifest(result: ExportResult, job: ExportJob): Promise<ExportFile> {
    const manifest = {
      exportId: job.id,
      campaignId: result.campaignId,
      campaignName: result.campaignName,
      exportDate: new Date().toISOString(),
      version: result.metadata.version,
      format: job.exportFormat,
      files: result.files.map((file: any) => ({
        name: file.name,
        path: file.path,
        type: file.type,
        format: file.format,
        size: file.size,
        checksum: file.checksum
      })),
      metadata: result.metadata
    };

    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');

    return {
      id: this.generateFileId(),
      name: 'manifest.json',
      path: 'manifest.json',
      type: 'metadata',
      format: 'json',
      size: manifestBuffer.length,
      checksum: this.calculateChecksum(manifestBuffer),
      metadata: {
        created: new Date(),
        modified: new Date()
      }
    };
  }

  private async finalizeExport(job: ExportJob): Promise<void> {
    if (job.exportFormat.packaging === 'zip') {
      await this.createZipPackage(job);
    } else if (job.destination.type === 'storage') {
      await this.uploadToStorage(job);
    } else if (job.destination.type === 'email') {
      await this.sendEmailDelivery(job);
    }
  }

  private async createZipPackage(job: ExportJob): Promise<void> {
    // Placeholder for ZIP creation
    // Would use libraries like JSZip or archiver
    logger.info('Creating ZIP package', { jobId: job.id });
  }

  private async uploadToStorage(job: ExportJob): Promise<void> {
    // Placeholder for cloud storage upload
    logger.info('Uploading to storage', { jobId: job.id });
  }

  private async sendEmailDelivery(job: ExportJob): Promise<void> {
    // Placeholder for email delivery
    logger.info('Sending email delivery', { jobId: job.id });
  }

  private async downloadAndConvert(
    _url: string,
    _currentFormat: string,
    _exportFormat: ExportFormat
  ): Promise<Buffer> {
    // Placeholder for file download and conversion
    // Would fetch file and apply quality/format conversions
    return Buffer.from('mock-file-data');
  }

  private applyNamingPattern(
    pattern: string,
    variables: Record<string, string>
  ): string {
    let fileName = pattern;
    Object.entries(variables).forEach(([key, value]) => {
      fileName = fileName.replace(`{${key}}`, value);
    });
    return fileName;
  }

  private generateVersion(versionControl?: ExportOptions['versionControl']): string {
    if (!versionControl?.enabled) {
      return '1.0.0';
    }

    switch (versionControl.strategy) {
      case 'timestamp':
        return new Date().toISOString().replace(/[:.]/g, '-');
      case 'hash':
        return Math.random().toString(36).substring(2, 10);
      case 'increment':
      default:
        return `${versionControl.prefix || 'v'}1.0.0`;
    }
  }

  private calculateChecksum(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private validatePlatformCompatibility(
    campaign: RenderedCampaign,
    spec: PlatformSpec
  ): { compatible: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check file formats
    const unsupportedFormats = campaign.outputFiles.filter(
      file => !spec.requirements.imageFormats.includes(file.format) && 
              !spec.requirements.videoFormats.includes(file.format)
    );

    if (unsupportedFormats.length > 0) {
      issues.push(`Unsupported formats: ${unsupportedFormats.map((f: any) => f.format).join(', ')}`);
    }

    // Check file sizes
    const oversizedFiles = campaign.outputFiles.filter(
      file => file.fileSize > spec.requirements.maxFileSize
    );

    if (oversizedFiles.length > 0) {
      issues.push(`Files exceed size limit: ${oversizedFiles.length} files`);
    }

    return {
      compatible: issues.length === 0,
      issues
    };
  }

  private async convertAssetsForPlatform(
    _campaign: RenderedCampaign,
    _spec: PlatformSpec
  ): Promise<ExportFile[]> {
    // Placeholder for platform-specific asset conversion
    return [];
  }

  private async uploadToPlatform(
    _platform: string,
    assets: ExportFile[],
    _credentials: Record<string, string>
  ): Promise<{
    success: boolean;
    response?: any;
    uploadedAssets: string[];
    errors: string[];
  }> {
    // Placeholder for platform API integration
    return {
      success: true,
      uploadedAssets: assets.map((a: any) => a.id),
      errors: []
    };
  }

  private async getCampaign(_campaignId: string): Promise<RenderedCampaign | null> {
    // Would fetch from database
    return null;
  }

  private async sendCompletionNotification(job: ExportJob): Promise<void> {
    if (!job.options.notifications?.recipients) return;

    // Send notification to recipients
    logger.info('Sending completion notification', {
      jobId: job.id,
      recipients: job.options.notifications.recipients.length
    });
  }

  private async queueExportJob(job: ExportJob): Promise<void> {
    // Queue job for background processing
    // In production, would use a job queue like Bull or AWS SQS
    setTimeout(() => {
      this.processExportJob(job.id).catch(error => {
        logger.error('Background export processing failed', error);
      });
    }, 1000);
  }

  // Database operations
  private async saveExportJob(job: ExportJob): Promise<void> {
    const { error } = await this.supabase
      .from('export_jobs')
      .insert({
        id: job.id,
        name: job.name,
        description: job.description,
        campaign_ids: job.campaignIds,
        export_format: job.exportFormat,
        destination: job.destination,
        options: job.options,
        status: job.status,
        progress: job.progress,
        results: job.results,
        errors: job.errors,
        metadata: job.metadata,
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString(),
        completed_at: job.completedAt?.toISOString(),
        created_by: job.createdBy
      });

    if (error) throw error;
  }

  private async updateExportJob(job: ExportJob): Promise<void> {
    const { error } = await this.supabase
      .from('export_jobs')
      .update({
        status: job.status,
        progress: job.progress,
        results: job.results,
        errors: job.errors,
        metadata: job.metadata,
        started_at: job.startedAt?.toISOString(),
        completed_at: job.completedAt?.toISOString()
      })
      .eq('id', job.id);

    if (error) throw error;
  }

  private async saveExportTemplate(_template: ExportTemplate): Promise<void> {
    // Would save to database
  }

  private mapRowToExportJob(row: any): ExportJob {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      campaignIds: row.campaign_ids || [],
      exportFormat: row.export_format || {},
      destination: row.destination || {},
      options: row.options || {},
      status: row.status,
      progress: row.progress || 0,
      results: row.results || [],
      errors: row.errors || [],
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      ...(row.started_at && { startedAt: new Date(row.started_at) }),
      ...(row.completed_at && { completedAt: new Date(row.completed_at) }),
      createdBy: row.created_by
    };
  }

  private initializePlatformSpecs(): void {
    // Initialize platform specifications
    this.platformSpecs.set('facebook', {
      platform: 'facebook',
      requirements: {
        imageFormats: ['jpg', 'png'],
        videoFormats: ['mp4'],
        maxFileSize: 4 * 1024 * 1024, // 4MB
        dimensions: [
          { width: 1200, height: 630, aspectRatio: '1.91:1', purpose: 'feed' },
          { width: 1080, height: 1080, aspectRatio: '1:1', purpose: 'square' }
        ],
        naming: {
          pattern: '{campaign}_{format}',
          maxLength: 100,
          allowedChars: 'a-zA-Z0-9_-'
        }
      },
      qualitySettings: {
        imageQuality: 85,
        compression: 'lossy',
        colorSpace: 'sRGB'
      }
    });

    // Add more platform specs...
  }

  private initializeExportTemplates(): void {
    // Initialize default export templates
    const socialTemplate: ExportTemplate = {
      id: 'social-default',
      name: 'Social Media Export',
      description: 'Optimized for social media platforms',
      category: 'social',
      format: {
        type: 'platform',
        packaging: 'zip',
        compression: 'lossy',
        qualitySettings: {
          images: 'web',
          documents: 'compressed',
          videos: 'social'
        },
        fileNaming: {
          pattern: '{campaign}_{platform}_{format}',
          includeMetadata: true,
          includeTimestamp: false,
          sanitize: true
        },
        includedAssets: ['image', 'video'],
        outputFormats: ['jpg', 'png', 'mp4']
      },
      destination: {
        type: 'download'
      },
      options: {
        includeAssets: true,
        generatePreviews: true,
        createManifest: true
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    };

    this.exportTemplates.set(socialTemplate.id, socialTemplate);
  }

  // Utility methods
  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateResultId(): string {
    return `result_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let exportEngineInstance: ExportEngine | null = null;

export const getExportEngine = (): ExportEngine => {
  if (!exportEngineInstance) {
    exportEngineInstance = new ExportEngine();
  }
  return exportEngineInstance;
};

// Convenience functions
export const createExportJob = (
  campaignIds: string[],
  exportFormat: ExportFormat,
  destination: ExportDestination,
  options: ExportOptions,
  createdBy: string,
  jobName?: string
) => {
  return getExportEngine().createExportJob(campaignIds, exportFormat, destination, options, createdBy, jobName);
};

export const getExportJob = (jobId: string) => {
  return getExportEngine().getExportJob(jobId);
};

export const getExportProgress = (jobId: string) => {
  return getExportEngine().getExportProgress(jobId);
};