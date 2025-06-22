import fs from 'fs/promises';
import path from 'path';
import { getLogger } from '@/lib/logger';

const logger = getLogger('bundle-analyzer');

export interface BundleStats {
  size: number;
  gzipSize: number;
  brotliSize?: number;
  chunkCount: number;
  assetCount: number;
  moduleCount: number;
}

export interface ChunkAnalysis {
  name: string;
  size: number;
  gzipSize: number;
  modules: ModuleInfo[];
  isInitial: boolean;
  isAsync: boolean;
}

export interface ModuleInfo {
  name: string;
  size: number;
  reasons: string[];
  chunks: string[];
  depth: number;
  issuer?: string;
}

export interface AssetInfo {
  name: string;
  size: number;
  chunkNames: string[];
  emitted: boolean;
  type: 'js' | 'css' | 'font' | 'image' | 'other';
}

export interface BundleAnalysis {
  stats: BundleStats;
  chunks: ChunkAnalysis[];
  assets: AssetInfo[];
  modules: ModuleInfo[];
  duplicateModules: ModuleInfo[];
  largeDependencies: Array<{
    name: string;
    size: number;
    version?: string;
  }>;
  recommendations: BundleRecommendation[];
  treeshaking: {
    eliminatedModules: string[];
    unusedExports: Array<{
      module: string;
      exports: string[];
    }>;
  };
}

export interface BundleRecommendation {
  type: 'warning' | 'error' | 'info';
  category: 'size' | 'performance' | 'duplicates' | 'treeshaking' | 'chunking';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  fix?: string;
  affected?: string[];
}

export interface BundleThresholds {
  maxChunkSize: number; // in bytes
  maxAssetSize: number;
  maxInitialSize: number;
  maxTotalSize: number;
  warnThreshold: number; // percentage of max
}

export class BundleAnalyzer {
  private readonly DEFAULT_THRESHOLDS: BundleThresholds = {
    maxChunkSize: 250 * 1024, // 250KB
    maxAssetSize: 500 * 1024, // 500KB
    maxInitialSize: 1024 * 1024, // 1MB
    maxTotalSize: 5 * 1024 * 1024, // 5MB
    warnThreshold: 80 // 80%
  };
  
  async analyzeBuild(
    buildDir: string = '.next',
    thresholds: Partial<BundleThresholds> = {}
  ): Promise<BundleAnalysis> {
    const finalThresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };
    
    try {
      logger.info('Starting bundle analysis...');
      
      // Read build manifest
      const manifest = await this.readBuildManifest(buildDir);
      
      // Analyze chunks
      const chunks = await this.analyzeChunks(buildDir, manifest);
      
      // Analyze assets
      const assets = await this.analyzeAssets(buildDir);
      
      // Extract modules information
      const modules = await this.extractModules(chunks);
      
      // Find duplicates
      const duplicateModules = this.findDuplicateModules(modules);
      
      // Find large dependencies
      const largeDependencies = await this.findLargeDependencies(modules);
      
      // Analyze tree shaking
      const treeshaking = await this.analyzeTreeShaking(buildDir);
      
      // Calculate overall stats
      const stats = this.calculateStats(chunks, assets, modules);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        stats,
        chunks,
        assets,
        duplicateModules,
        largeDependencies,
        finalThresholds
      );
      
      const analysis: BundleAnalysis = {
        stats,
        chunks,
        assets,
        modules,
        duplicateModules,
        largeDependencies,
        recommendations,
        treeshaking
      };
      
      logger.info('Bundle analysis completed', {
        totalSize: stats.size,
        chunkCount: stats.chunkCount,
        recommendationCount: recommendations.length
      });
      
      return analysis;
      
    } catch (error) {
      logger.error('Bundle analysis failed', error);
      throw error;
    }
  }
  
  async generateReport(
    analysis: BundleAnalysis,
    outputPath?: string
  ): Promise<string> {
    const report = this.createHtmlReport(analysis);
    
    if (outputPath) {
      await fs.writeFile(outputPath, report, 'utf-8');
      logger.info(`Bundle analysis report saved to: ${outputPath}`);
    }
    
    return report;
  }
  
  async compareBuilds(
    currentAnalysis: BundleAnalysis,
    previousAnalysis: BundleAnalysis
  ): Promise<{
    sizeChange: {
      total: number;
      chunks: Array<{ name: string; change: number }>;
      assets: Array<{ name: string; change: number }>;
    };
    newChunks: string[];
    removedChunks: string[];
    recommendations: BundleRecommendation[];
  }> {
    const sizeChange = {
      total: currentAnalysis.stats.size - previousAnalysis.stats.size,
      chunks: this.compareChunks(currentAnalysis.chunks, previousAnalysis.chunks),
      assets: this.compareAssets(currentAnalysis.assets, previousAnalysis.assets)
    };
    
    const currentChunkNames = new Set(currentAnalysis.chunks.map(c => c.name));
    const previousChunkNames = new Set(previousAnalysis.chunks.map(c => c.name));
    
    const newChunks = [...currentChunkNames].filter(name => !previousChunkNames.has(name));
    const removedChunks = [...previousChunkNames].filter(name => !currentChunkNames.has(name));
    
    const recommendations = this.generateComparisonRecommendations(
      sizeChange,
      newChunks,
      removedChunks
    );
    
    return {
      sizeChange,
      newChunks,
      removedChunks,
      recommendations
    };
  }
  
  private async readBuildManifest(buildDir: string): Promise<any> {
    try {
      const manifestPath = path.join(buildDir, 'build-manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    } catch (error) {
      logger.warn('Build manifest not found, using fallback analysis');
      return {};
    }
  }
  
  private async analyzeChunks(buildDir: string, manifest: any): Promise<ChunkAnalysis[]> {
    const chunks: ChunkAnalysis[] = [];
    
    try {
      // Read webpack stats if available
      const statsPath = path.join(buildDir, 'webpack-stats.json');
      const statsExists = await fs.access(statsPath).then(() => true).catch(() => false);
      
      if (statsExists) {
        const stats = JSON.parse(await fs.readFile(statsPath, 'utf-8'));
        return this.processWebpackStats(stats);
      }
      
      // Fallback: analyze static directory
      const staticDir = path.join(buildDir, 'static');
      const jsDir = path.join(staticDir, 'chunks');
      
      const jsFiles = await this.getFiles(jsDir, '.js');
      
      for (const file of jsFiles) {
        const filePath = path.join(jsDir, file);
        const stats = await fs.stat(filePath);
        const gzipSize = await this.calculateGzipSize(filePath);
        
        chunks.push({
          name: file,
          size: stats.size,
          gzipSize,
          modules: [],
          isInitial: file.includes('main') || file.includes('_app'),
          isAsync: !file.includes('main') && !file.includes('_app')
        });
      }
      
    } catch (error) {
      logger.warn('Failed to analyze chunks', error);
    }
    
    return chunks;
  }
  
  private async analyzeAssets(buildDir: string): Promise<AssetInfo[]> {
    const assets: AssetInfo[] = [];
    
    try {
      const staticDir = path.join(buildDir, 'static');
      
      // Analyze JS files
      const jsFiles = await this.getFiles(path.join(staticDir, 'chunks'), '.js');
      for (const file of jsFiles) {
        const filePath = path.join(staticDir, 'chunks', file);
        const stats = await fs.stat(filePath);
        
        assets.push({
          name: file,
          size: stats.size,
          chunkNames: [file.replace('.js', '')],
          emitted: true,
          type: 'js'
        });
      }
      
      // Analyze CSS files
      const cssFiles = await this.getFiles(path.join(staticDir, 'css'), '.css');
      for (const file of cssFiles) {
        const filePath = path.join(staticDir, 'css', file);
        const stats = await fs.stat(filePath);
        
        assets.push({
          name: file,
          size: stats.size,
          chunkNames: [file.replace('.css', '')],
          emitted: true,
          type: 'css'
        });
      }
      
      // Analyze media files
      const mediaDir = path.join(staticDir, 'media');
      const mediaExists = await fs.access(mediaDir).then(() => true).catch(() => false);
      
      if (mediaExists) {
        const mediaFiles = await this.getFiles(mediaDir);
        for (const file of mediaFiles) {
          const filePath = path.join(mediaDir, file);
          const stats = await fs.stat(filePath);
          
          assets.push({
            name: file,
            size: stats.size,
            chunkNames: [],
            emitted: true,
            type: this.getAssetType(file)
          });
        }
      }
      
    } catch (error) {
      logger.warn('Failed to analyze assets', error);
    }
    
    return assets;
  }
  
  private async extractModules(chunks: ChunkAnalysis[]): Promise<ModuleInfo[]> {
    // This would typically require webpack stats
    // For now, return estimated modules based on common patterns
    const modules: ModuleInfo[] = [];
    
    // Add common modules that are likely present
    const commonModules = [
      { name: 'react', estimatedSize: 45 * 1024 },
      { name: 'react-dom', estimatedSize: 120 * 1024 },
      { name: 'next', estimatedSize: 200 * 1024 },
      { name: '@babel/runtime', estimatedSize: 30 * 1024 },
      { name: 'regenerator-runtime', estimatedSize: 15 * 1024 }
    ];
    
    commonModules.forEach((mod, index) => {
      modules.push({
        name: mod.name,
        size: mod.estimatedSize,
        reasons: ['entry'],
        chunks: ['main'],
        depth: 0,
        issuer: undefined
      });
    });
    
    return modules;
  }
  
  private findDuplicateModules(modules: ModuleInfo[]): ModuleInfo[] {
    const moduleMap = new Map<string, ModuleInfo[]>();
    
    modules.forEach(module => {
      const baseName = module.name.split('/')[0];
      if (!moduleMap.has(baseName)) {
        moduleMap.set(baseName, []);
      }
      moduleMap.get(baseName)!.push(module);
    });
    
    const duplicates: ModuleInfo[] = [];
    
    moduleMap.forEach((moduleList, name) => {
      if (moduleList.length > 1) {
        duplicates.push(...moduleList);
      }
    });
    
    return duplicates;
  }
  
  private async findLargeDependencies(modules: ModuleInfo[]): Promise<Array<{
    name: string;
    size: number;
    version?: string;
  }>> {
    const large = modules
      .filter(module => module.size > 50 * 1024) // > 50KB
      .map(module => ({
        name: module.name,
        size: module.size,
        version: undefined // Would need package.json parsing
      }))
      .sort((a, b) => b.size - a.size);
    
    return large.slice(0, 10); // Top 10
  }
  
  private async analyzeTreeShaking(buildDir: string): Promise<{
    eliminatedModules: string[];
    unusedExports: Array<{ module: string; exports: string[] }>;
  }> {
    // This would require detailed webpack stats
    // For now, return empty results
    return {
      eliminatedModules: [],
      unusedExports: []
    };
  }
  
  private calculateStats(
    chunks: ChunkAnalysis[],
    assets: AssetInfo[],
    modules: ModuleInfo[]
  ): BundleStats {
    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const totalGzipSize = chunks.reduce((sum, chunk) => sum + chunk.gzipSize, 0);
    
    return {
      size: totalSize,
      gzipSize: totalGzipSize,
      chunkCount: chunks.length,
      assetCount: assets.length,
      moduleCount: modules.length
    };
  }
  
  private generateRecommendations(
    stats: BundleStats,
    chunks: ChunkAnalysis[],
    assets: AssetInfo[],
    duplicates: ModuleInfo[],
    largeDeps: Array<{ name: string; size: number }>,
    thresholds: BundleThresholds
  ): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];
    
    // Size recommendations
    if (stats.size > thresholds.maxTotalSize) {
      recommendations.push({
        type: 'error',
        category: 'size',
        title: 'Total bundle size exceeds limit',
        description: `Total size (${this.formatBytes(stats.size)}) exceeds maximum (${this.formatBytes(thresholds.maxTotalSize)})`,
        impact: 'high',
        fix: 'Consider code splitting, lazy loading, or removing unused dependencies'
      });
    }
    
    // Large chunk recommendations
    const largeChunks = chunks.filter(chunk => chunk.size > thresholds.maxChunkSize);
    if (largeChunks.length > 0) {
      recommendations.push({
        type: 'warning',
        category: 'size',
        title: 'Large chunks detected',
        description: `${largeChunks.length} chunks exceed the recommended size limit`,
        impact: 'medium',
        fix: 'Split large chunks using dynamic imports or route-based code splitting',
        affected: largeChunks.map(c => c.name)
      });
    }
    
    // Duplicate module recommendations
    if (duplicates.length > 0) {
      recommendations.push({
        type: 'warning',
        category: 'duplicates',
        title: 'Duplicate modules found',
        description: `${duplicates.length} modules appear to be duplicated across chunks`,
        impact: 'medium',
        fix: 'Use webpack optimization.splitChunks to deduplicate common modules',
        affected: duplicates.map(d => d.name)
      });
    }
    
    // Large dependency recommendations
    if (largeDeps.length > 0) {
      const topLargeDeps = largeDeps.slice(0, 3);
      recommendations.push({
        type: 'info',
        category: 'size',
        title: 'Large dependencies detected',
        description: `Consider alternatives or lazy loading for large dependencies`,
        impact: 'medium',
        fix: 'Evaluate if these dependencies can be replaced with smaller alternatives or loaded on demand',
        affected: topLargeDeps.map(d => `${d.name} (${this.formatBytes(d.size)})`)
      });
    }
    
    return recommendations;
  }
  
  private generateComparisonRecommendations(
    sizeChange: any,
    newChunks: string[],
    removedChunks: string[]
  ): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];
    
    if (sizeChange.total > 50 * 1024) { // > 50KB increase
      recommendations.push({
        type: 'warning',
        category: 'size',
        title: 'Bundle size increased significantly',
        description: `Total bundle size increased by ${this.formatBytes(sizeChange.total)}`,
        impact: 'medium',
        fix: 'Review recent changes and consider optimization strategies'
      });
    }
    
    if (newChunks.length > 0) {
      recommendations.push({
        type: 'info',
        category: 'chunking',
        title: 'New chunks added',
        description: `${newChunks.length} new chunks were created`,
        impact: 'low',
        affected: newChunks
      });
    }
    
    return recommendations;
  }
  
  private createHtmlReport(analysis: BundleAnalysis): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Bundle Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .metric { display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #007cba; background: #f9f9f9; }
    .warning { border-left-color: #ffa500; }
    .error { border-left-color: #ff4444; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>Bundle Analysis Report</h1>
  
  <h2>Overall Statistics</h2>
  <div class="metric">
    <strong>Total Size:</strong> ${this.formatBytes(analysis.stats.size)}
  </div>
  <div class="metric">
    <strong>Gzipped Size:</strong> ${this.formatBytes(analysis.stats.gzipSize)}
  </div>
  <div class="metric">
    <strong>Chunks:</strong> ${analysis.stats.chunkCount}
  </div>
  <div class="metric">
    <strong>Assets:</strong> ${analysis.stats.assetCount}
  </div>
  
  <h2>Recommendations</h2>
  ${analysis.recommendations.map(rec => `
    <div class="recommendation ${rec.type}">
      <strong>${rec.title}</strong><br>
      ${rec.description}<br>
      ${rec.fix ? `<em>Fix: ${rec.fix}</em>` : ''}
    </div>
  `).join('')}
  
  <h2>Largest Assets</h2>
  <table>
    <tr><th>Name</th><th>Size</th><th>Type</th></tr>
    ${analysis.assets
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(asset => `
        <tr>
          <td>${asset.name}</td>
          <td>${this.formatBytes(asset.size)}</td>
          <td>${asset.type}</td>
        </tr>
      `).join('')}
  </table>
  
  <p><em>Generated at ${new Date().toISOString()}</em></p>
</body>
</html>`;
  }
  
  // Utility methods
  private async getFiles(dir: string, extension?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dir);
      return extension 
        ? files.filter(file => file.endsWith(extension))
        : files;
    } catch {
      return [];
    }
  }
  
  private async calculateGzipSize(filePath: string): Promise<number> {
    try {
      const { gzipSync } = await import('zlib');
      const content = await fs.readFile(filePath);
      return gzipSync(content).length;
    } catch {
      return 0;
    }
  }
  
  private getAssetType(filename: string): AssetInfo['type'] {
    const ext = path.extname(filename).toLowerCase();
    if (['.js', '.mjs'].includes(ext)) return 'js';
    if (ext === '.css') return 'css';
    if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) return 'font';
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return 'image';
    return 'other';
  }
  
  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  private processWebpackStats(stats: any): ChunkAnalysis[] {
    // Process webpack stats.json format
    return stats.chunks?.map((chunk: any) => ({
      name: chunk.names?.[0] || chunk.id.toString(),
      size: chunk.size || 0,
      gzipSize: Math.round((chunk.size || 0) * 0.3), // Estimate
      modules: chunk.modules?.map((mod: any) => ({
        name: mod.name || mod.identifier,
        size: mod.size || 0,
        reasons: mod.reasons?.map((r: any) => r.type) || [],
        chunks: [chunk.id.toString()],
        depth: mod.depth || 0,
        issuer: mod.issuer
      })) || [],
      isInitial: chunk.initial || false,
      isAsync: !chunk.initial
    })) || [];
  }
  
  private compareChunks(current: ChunkAnalysis[], previous: ChunkAnalysis[]): Array<{ name: string; change: number }> {
    const changes: Array<{ name: string; change: number }> = [];
    const prevMap = new Map(previous.map(c => [c.name, c.size]));
    
    current.forEach(chunk => {
      const prevSize = prevMap.get(chunk.name) || 0;
      const change = chunk.size - prevSize;
      if (Math.abs(change) > 1024) { // Only report changes > 1KB
        changes.push({ name: chunk.name, change });
      }
    });
    
    return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }
  
  private compareAssets(current: AssetInfo[], previous: AssetInfo[]): Array<{ name: string; change: number }> {
    const changes: Array<{ name: string; change: number }> = [];
    const prevMap = new Map(previous.map(a => [a.name, a.size]));
    
    current.forEach(asset => {
      const prevSize = prevMap.get(asset.name) || 0;
      const change = asset.size - prevSize;
      if (Math.abs(change) > 1024) { // Only report changes > 1KB
        changes.push({ name: asset.name, change });
      }
    });
    
    return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }
}

// Singleton instance
let analyzerInstance: BundleAnalyzer | null = null;

export const getBundleAnalyzer = (): BundleAnalyzer => {
  if (!analyzerInstance) {
    analyzerInstance = new BundleAnalyzer();
  }
  return analyzerInstance;
};

// Convenience functions
export const analyzeBuild = (
  buildDir?: string,
  thresholds?: Partial<BundleThresholds>
): Promise<BundleAnalysis> => {
  return getBundleAnalyzer().analyzeBuild(buildDir, thresholds);
};

export const generateBundleReport = (
  analysis: BundleAnalysis,
  outputPath?: string
): Promise<string> => {
  return getBundleAnalyzer().generateReport(analysis, outputPath);
};