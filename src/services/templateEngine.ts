import { getLogger } from '@/lib/logger';
import { ParsedBrief } from './briefParser';
import { PsychologicalMotivation } from './motivationGenerator';
import { CopyVariant } from './copyGenerator';
import { Asset } from './assetManager';

const logger = getLogger('template-engine');

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: 'social' | 'web' | 'email' | 'print' | 'video' | 'display' | 'outdoor';
  platform: string; // Specific platform (e.g., 'instagram', 'facebook', 'google-ads')
  format: 'story' | 'feed' | 'reel' | 'banner' | 'carousel' | 'video' | 'landing-page' | 'email-newsletter';
  dimensions: {
    width: number;
    height: number;
    aspectRatio: string;
  };
  components: TemplateComponent[];
  designSystem: {
    colorScheme: 'primary' | 'secondary' | 'accent' | 'neutral' | 'brand';
    typography: {
      primary: string;
      secondary: string;
      hierarchy: string[];
    };
    spacing: {
      unit: number;
      scale: number[];
    };
    layout: 'grid' | 'flex' | 'absolute' | 'stack';
  };
  requirements: {
    minAssets: number;
    maxAssets: number;
    requiredAssetTypes: Array<Asset['fileType']>;
    copyTypes: Array<CopyVariant['type']>;
    minCopyLength: number;
    maxCopyLength: number;
  };
  metadata: {
    usage: 'hero' | 'supporting' | 'promotional' | 'educational' | 'social-proof';
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: number; // in minutes
    popularityScore: number;
    tags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

export interface TemplateComponent {
  id: string;
  type: 'text' | 'image' | 'video' | 'button' | 'icon' | 'background' | 'overlay' | 'divider';
  name: string;
  description: string;
  position: {
    x: number; // percentage or pixels
    y: number;
    width: number;
    height: number;
    unit: 'px' | '%' | 'vw' | 'vh';
  };
  styling: {
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
    margin?: number;
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
    opacity?: number;
    zIndex?: number;
  };
  content: ComponentContent;
  constraints: {
    required: boolean;
    editable: boolean;
    resizable: boolean;
    moveable: boolean;
    maxLength?: number;
    minLength?: number;
    aspectRatioLocked?: boolean;
  };
  variations?: ComponentVariation[];
}

export interface ComponentContent {
  type: 'copy' | 'asset' | 'generated' | 'placeholder';
  // For copy components
  copyType?: CopyVariant['type'];
  placeholder?: string;
  // For asset components  
  assetType?: Asset['fileType'];
  assetCategory?: Asset['category'];
  // For generated components
  generationType?: 'qr-code' | 'chart' | 'logo' | 'pattern';
  // For placeholder components
  placeholderText?: string;
}

export interface ComponentVariation {
  id: string;,
  name: string;
  description: string;,
  changes: {},
  position?: Partial<TemplateComponent['position']>;
    styling?: Partial<TemplateComponent['styling']>;
    content?: Partial<ComponentContent>;
  };
}

export interface PopulatedTemplate {
  id: string;,
  templateId: string;
  briefId: string;,
  name: string;
  populatedComponents: PopulatedComponent[];,
  selectedAssets: Asset[];
  selectedCopy: CopyVariant[];,
  selectedMotivation: PsychologicalMotivation;
  customizations: TemplateCustomization[];,
  renderData: {},
  html?: string;
    css?: string;
    js?: string;
    svg?: string;
    canvas?: string;
  };
  preview: {
    thumbnailUrl: string;
    fullSizeUrl: string;
    interactiveUrl?: string;
  };
  status: 'draft' | 'ready' | 'approved' | 'published';,
  createdAt: Date;
  updatedAt: Date;,
  version: number;
}

export interface PopulatedComponent {
  componentId: string;,
  content: {},
  text?: string;
    assetUrl?: string;
    assetId?: string;
    generatedData?: any;
  };
  finalStyling: TemplateComponent['styling'];,
  finalPosition: TemplateComponent['position'];
}

export interface TemplateCustomization {
  componentId: string;,
  property: string;
  originalValue: any;,
  customValue: any;
  appliedAt: Date;
}

export interface TemplateMatchingOptions {
  preferredPlatforms?: string[];
  preferredFormats?: Array<CampaignTemplate['format']>;
  availableAssets?: Asset[];
  availableCopy?: CopyVariant[];
  complexity?: 'simple' | 'moderate' | 'complex';
  urgency?: 'low' | 'medium' | 'high';
  customRequirements?: {
    minComponents?: number;
    maxComponents?: number;
    requiredComponentTypes?: Array<TemplateComponent['type']>;
  };
}

export class TemplateEngine {
  private readonly TEMPLATE_CATEGORIES = ['social', 'web', 'email', 'print', 'video', 'display', 'outdoor'];
  private readonly COMPONENT_TYPES = ['text', 'image', 'video', 'button', 'icon', 'background', 'overlay', 'divider'];
  
  private templateLibrary: Map<string, CampaignTemplate> = new Map();
  
  constructor() {
    this.initializeTemplateLibrary();
  }

  async findMatchingTemplates(
    brief: ParsedBrief,
    motivation: PsychologicalMotivation,
    availableCopy: CopyVariant[],
    availableAssets: Asset[],
    options: TemplateMatchingOptions = {}
  ): Promise<{
    templates: Array<{
      template: CampaignTemplate;
      matchScore: number;,
      compatibility: {},
  assets: number;,
        copy: number;
        platform: number;,
        overall: number;
      };
      missingRequirements: string[];
    }>;
    recommendations: string[];
  }> {
    const {
      preferredPlatforms = [],;
      preferredFormats = [],;
      complexity = 'moderate',;
      urgency = 'medium';
    } = options;

    try {
      logger.info('Finding matching templates', {
        briefId: brief.id,
        motivationId: motivation.id,
        availableCopy: availableCopy.length,
        availableAssets: availableAssets.length
      });

      const allTemplates = Array.from(this.templateLibrary.values());
      const scoredTemplates = await Promise.all(;
        allTemplates.map(async template => {;
          const score = await this.calculateTemplateMatchScore(;
            template,
            brief,
            motivation,
            availableCopy,
            availableAssets,
            options
          );
          
          const compatibility = this.calculateCompatibility(;
            template,
            availableCopy,
            availableAssets,
            brief
          );
          
          const missingRequirements = this.identifyMissingRequirements(;
            template,
            availableCopy,
            availableAssets
          );

          return {
            template,
            matchScore: score,
            compatibility,
            missingRequirements
          };
        })
      );

      // Sort by match score and filter out very low scores
      const filteredTemplates = scoredTemplates;
        .filter((item: any) => item.matchScore > 0.3)
        .sort((a, b) => b.matchScore - a.matchScore);

      // Generate recommendations
      const recommendations = this.generateTemplateRecommendations(;
        filteredTemplates,
        brief,
        motivation,
        options
      );

      return {
        templates: filteredTemplates,
        recommendations
      };

    } catch (error: any) {
      logger.error('Template matching failed', error);
      throw error;
    }
  }

  async populateTemplate(
    template: CampaignTemplate,
    brief: ParsedBrief,
    motivation: PsychologicalMotivation,
    selectedCopy: CopyVariant[],
    selectedAssets: Asset[],
    customizations: TemplateCustomization[] = []
  ): Promise<PopulatedTemplate> {
    try {
      logger.info('Populating template', {
        templateId: template.id,
        briefId: brief.id,
        motivationId: motivation.id,
        copyCount: selectedCopy.length,
        assetCount: selectedAssets.length
      });

      // Validate requirements
      this.validateTemplateRequirements(template, selectedCopy, selectedAssets);

      // Create component mapping
      const componentMapping = await this.createComponentMapping(;
        template.components,
        selectedCopy,
        selectedAssets,
        motivation
      );

      // Apply customizations
      const finalComponents = this.applyCustomizations(;
        componentMapping,
        customizations
      );

      // Generate render data
      const renderData = await this.generateRenderData(template, finalComponents);

      // Generate previews
      const preview = await this.generatePreviews(renderData, template);

      const populatedTemplate: PopulatedTemplate = {;
        id: this.generatePopulatedTemplateId(),
        templateId: template.id,
        briefId: brief.id,
        name: `${template.name} - ${motivation.title}`,
        populatedComponents: finalComponents,
        selectedAssets,
        selectedCopy,
        selectedMotivation: motivation,
        customizations,
        renderData,
        preview,
        status: 'ready',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      return populatedTemplate;

    } catch (error: any) {
      logger.error('Template population failed', error);
      throw error;
    }
  }

  async customizeTemplate(
    populatedTemplate: PopulatedTemplate,
    customizations: TemplateCustomization[]
  ): Promise<PopulatedTemplate> {
    try {
      const allCustomizations = [...populatedTemplate.customizations, ...customizations];
      const template = this.templateLibrary.get(populatedTemplate.templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      // Apply all customizations
      const updatedComponents = this.applyCustomizations(;
        populatedTemplate.populatedComponents,
        allCustomizations
      );

      // Regenerate render data
      const updatedRenderData = await this.generateRenderData(template, updatedComponents);

      // Regenerate previews
      const updatedPreview = await this.generatePreviews(updatedRenderData, template);

      return {
        ...populatedTemplate,
        populatedComponents: updatedComponents,
        customizations: allCustomizations,
        renderData: updatedRenderData,
        preview: updatedPreview,
        updatedAt: new Date(),
        version: populatedTemplate.version + 1
      };

    } catch (error: any) {
      logger.error('Template customization failed', error);
      throw error;
    }
  }

  async createCustomTemplate(
    baseTemplate: CampaignTemplate,
    name: string,
    modifications: {},
  components?: Partial<TemplateComponent>[];
      designSystem?: Partial<CampaignTemplate['designSystem']>;
      requirements?: Partial<CampaignTemplate['requirements']>;
    }
  ): Promise<CampaignTemplate> {
    try {
      const customTemplate: CampaignTemplate = {;
        ...baseTemplate,
        id: this.generateTemplateId(),
        name,
        description: `Custom template based on ${baseTemplate.name}`,
        components: modifications.components 
          ? this.mergeComponents(baseTemplate.components, modifications.components)
          : baseTemplate.components,
        designSystem: modifications.designSystem 
          ? { ...baseTemplate.designSystem, ...modifications.designSystem }
          : baseTemplate.designSystem,
        requirements: modifications.requirements
          ? { ...baseTemplate.requirements, ...modifications.requirements }
          : baseTemplate.requirements,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      };

      // Add to library
      this.templateLibrary.set(customTemplate.id, customTemplate);

      return customTemplate;

    } catch (error: any) {
      logger.error('Custom template creation failed', error);
      throw error;
    }
  }

  // Private methods
  private async calculateTemplateMatchScore(
    template: CampaignTemplate,
    brief: ParsedBrief,
    motivation: PsychologicalMotivation,
    availableCopy: CopyVariant[],
    availableAssets: Asset[],
    options: TemplateMatchingOptions
  ): Promise<number> {
    let score = 0.5; // Base score

    // Platform preference match
    if (options.preferredPlatforms?.includes(template.platform)) {
      score += 0.2;
    }

    // Format preference match  
    if (options.preferredFormats?.includes(template.format)) {
      score += 0.15;
    }

    // Asset compatibility
    const assetCompatibility = this.calculateAssetCompatibility(template, availableAssets);
    score += assetCompatibility * 0.25;

    // Copy compatibility
    const copyCompatibility = this.calculateCopyCompatibility(template, availableCopy);
    score += copyCompatibility * 0.2;

    // Complexity match
    const complexityScore = this.calculateComplexityMatch(template, options.complexity);
    score += complexityScore * 0.1;

    // Psychology type alignment
    const psychologyScore = this.calculatePsychologyAlignment(template, motivation);
    score += psychologyScore * 0.1;

    return Math.min(score, 1.0);
  }

  private calculateAssetCompatibility(template: CampaignTemplate, assets: Asset[]): number {
    const requiredTypes = template.requirements.requiredAssetTypes;
    const availableTypes = new Set(assets.map((a: any) => a.fileType));
    
    const compatibleTypes = requiredTypes.filter((type: any) => availableTypes.has(type));
    const assetCount = assets.length;
    
    const typeScore = requiredTypes.length > 0 ;
      ? compatibleTypes.length / requiredTypes.length 
      : 1.0;
    
    const countScore = Math.min(assetCount / template.requirements.minAssets, 1.0);
    
    return (typeScore + countScore) / 2;
  }

  private calculateCopyCompatibility(template: CampaignTemplate, copy: CopyVariant[]): number {
    const requiredTypes = template.requirements.copyTypes;
    const availableTypes = new Set(copy.map((c: any) => c.type));
    
    const compatibleTypes = requiredTypes.filter((type: any) => availableTypes.has(type));
    
    return requiredTypes.length > 0 
      ? compatibleTypes.length / requiredTypes.length 
      : 1.0;
  }

  private calculateComplexityMatch(template: CampaignTemplate, preferredComplexity?: string): number {
    const templateComplexity = template.metadata.difficulty;
    const complexity = preferredComplexity || 'moderate';
    
    const complexityMap = { beginner: 1, intermediate: 2, advanced: 3 };
    const preferredLevel = complexityMap[complexity as keyof typeof complexityMap] || 2;
    const templateLevel = complexityMap[templateComplexity];
    
    const difference = Math.abs(preferredLevel - templateLevel);
    return Math.max(1 - (difference * 0.3), 0);
  }

  private calculatePsychologyAlignment(template: CampaignTemplate, motivation: PsychologicalMotivation): number {
    // Simple alignment based on template tags and motivation category
    const motivationKeywords = [;
      motivation.psychologyType,
      motivation.motivationCategory,
      ...motivation.emotionalTriggers
    ];
    
    const templateTags = template.metadata.tags;
    const matches = motivationKeywords.filter((keyword: any) => ;
      templateTags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()));
    );
    
    return motivationKeywords.length > 0 
      ? matches.length / motivationKeywords.length 
      : 0.5;
  }

  private calculateCompatibility(
    template: CampaignTemplate,
    copy: CopyVariant[],
    assets: Asset[],
    brief: ParsedBrief
  ) {
    const assetCompatibility = this.calculateAssetCompatibility(template, assets);
    const copyCompatibility = this.calculateCopyCompatibility(template, copy);
    
    // Platform compatibility based on brief platforms
    const platformCompatibility = brief.platforms?.includes(template.platform) ? 1.0 : 0.5;
    
    const overall = (assetCompatibility + copyCompatibility + platformCompatibility) / 3;
    
    return {
      assets: assetCompatibility,
      copy: copyCompatibility,
      platform: platformCompatibility,
      overall
    };
  }

  private identifyMissingRequirements(
    template: CampaignTemplate,
    copy: CopyVariant[],
    assets: Asset[]
  ): string[] {
    const missing: string[] = [];
    
    // Check asset requirements
    const availableAssetTypes = new Set(assets.map((a: any) => a.fileType));
    const missingAssetTypes = template.requirements.requiredAssetTypes.filter(;
      type => !availableAssetTypes.has(type);
    );
    
    if (missingAssetTypes.length > 0) {
      missing.push(`Missing asset types: ${missingAssetTypes.join(', ')}`);
    }
    
    if (assets.length < template.requirements.minAssets) {
      missing.push(`Need ${template.requirements.minAssets - assets.length} more assets`);
    }
    
    // Check copy requirements
    const availableCopyTypes = new Set(copy.map((c: any) => c.type));
    const missingCopyTypes = template.requirements.copyTypes.filter(;
      type => !availableCopyTypes.has(type);
    );
    
    if (missingCopyTypes.length > 0) {
      missing.push(`Missing copy types: ${missingCopyTypes.join(', ')}`);
    }
    
    return missing;
  }

  private generateTemplateRecommendations(
    templates: Array<{ template: CampaignTemplate; matchScore: number }>,
    brief: ParsedBrief,
    motivation: PsychologicalMotivation,
    options: TemplateMatchingOptions
  ): string[] {
    const recommendations: string[] = [];
    
    if (templates.length === 0) {;
      recommendations.push('No matching templates found. Consider uploading more assets or generating additional copy variants.');
    } else if (templates.length < 3) {
      recommendations.push('Limited template options available. Additional assets or copy variants would provide more choices.');
    }
    
    const topTemplate = templates[0]?.template;
    if (topTemplate && topTemplate.metadata.difficulty === 'advanced') {;
      recommendations.push('The best matching template is advanced. Consider review by an experienced designer.');
    }
    
    const socialTemplates = templates.filter((t: any) => t.template.category === 'social');
    if (socialTemplates.length > 0 && brief.platforms?.includes('social')) {
      recommendations.push('Strong social media template matches found. Consider creating multiple platform variants.');
    }
    
    return recommendations;
  }

  private validateTemplateRequirements(
    template: CampaignTemplate,
    copy: CopyVariant[],
    assets: Asset[]
  ): void {
    if (assets.length < template.requirements.minAssets) {
      throw new Error(`Template requires at least ${template.requirements.minAssets} assets, but only ${assets.length} provided`);
    }
    
    if (assets.length > template.requirements.maxAssets) {
      throw new Error(`Template accepts at most ${template.requirements.maxAssets} assets, but ${assets.length} provided`);
    }
    
    const availableCopyTypes = new Set(copy.map((c: any) => c.type));
    const missingCopyTypes = template.requirements.copyTypes.filter(;
      type => !availableCopyTypes.has(type);
    );
    
    if (missingCopyTypes.length > 0) {
      throw new Error(`Template requires copy types: ${missingCopyTypes.join(', ')}`);
    }
  }

  private async createComponentMapping(
    components: TemplateComponent[],
    copy: CopyVariant[],
    assets: Asset[],
    motivation: PsychologicalMotivation
  ): Promise<PopulatedComponent[]> {
    const populated: PopulatedComponent[] = [];
    
    // Create copy lookup by type
    const copyByType = copy.reduce((acc, c) => {;
      if (!acc[c.type]) acc[c.type] = [];
      acc[c.type].push(c);
      return acc;
    }, {} as Record<string, CopyVariant[]>);
    
    // Create asset lookup by type and category
    const assetsByType = assets.reduce((acc, a) => {;
      if (!acc[a.fileType]) acc[a.fileType] = [];
      acc[a.fileType].push(a);
      return acc;
    }, {} as Record<string, Asset[]>);
    
    for (const component of components) {
      const populatedComponent: PopulatedComponent = {;
        componentId: component.id,
        content: {},
  finalStyling: { ...component.styling  },
  finalPosition: { ...component.position }
      };
      
      // Populate based on component content type
      if (component.content.type === 'copy' && component.content.copyType) {;
        const availableCopy = copyByType[component.content.copyType];
        if (availableCopy && availableCopy.length > 0) {
          // Select best copy variant for this component
          const selectedCopy = this.selectBestCopyForComponent(availableCopy, component, motivation);
          populatedComponent.content.text = selectedCopy.content;
        } else {
          populatedComponent.content.text = component.content.placeholder || 'Add your copy here';
        }
      } else if (component.content.type === 'asset' && component.content.assetType) {;
        const availableAssets = assetsByType[component.content.assetType];
        if (availableAssets && availableAssets.length > 0) {
          // Select best asset for this component
          const selectedAsset = this.selectBestAssetForComponent(availableAssets, component);
          populatedComponent.content.assetUrl = selectedAsset.url;
          populatedComponent.content.assetId = selectedAsset.id;
        }
      }
      
      populated.push(populatedComponent);
    }
    
    return populated;
  }

  private selectBestCopyForComponent(
    availableCopy: CopyVariant[],
    component: TemplateComponent,
    motivation: PsychologicalMotivation
  ): CopyVariant {
    // Score copy variants for this component
    const scored = availableCopy.map((copy: any) => ({;
      copy,
      score: this.scoreCopyForComponent(copy, component, motivation)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0].copy;
  }

  private scoreCopyForComponent(
    copy: CopyVariant,
    component: TemplateComponent,
    motivation: PsychologicalMotivation
  ): number {
    let score = copy.confidence;
    
    // Length compatibility
    const maxLength = component.constraints.maxLength || Infinity;
    if (copy.characterCount <= maxLength) {
      score += 0.2;
    } else {
      score -= 0.3;
    }
    
    // Emotional impact for prominent components
    if (component.styling.fontSize && component.styling.fontSize > 18) {
      score += copy.emotionalImpact * 0.2;
    }
    
    // Tone alignment with motivation
    const toneAlignment = this.calculateToneAlignment(copy.tone, motivation);
    score += toneAlignment * 0.1;
    
    return score;
  }

  private selectBestAssetForComponent(
    availableAssets: Asset[],
    component: TemplateComponent
  ): Asset {
    // Score assets for this component
    const scored = availableAssets.map((asset: any) => ({;
      asset,
      score: this.scoreAssetForComponent(asset, component)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0].asset;
  }

  private scoreAssetForComponent(asset: Asset, component: TemplateComponent): number {
    let score = 0.5;
    
    // Dimension compatibility
    if (asset.dimensions && component.position) {
      const assetRatio = asset.dimensions.width / asset.dimensions.height;
      const componentRatio = component.position.width / component.position.height;
      const ratioSimilarity = 1 - Math.abs(assetRatio - componentRatio) / Math.max(assetRatio, componentRatio);
      score += ratioSimilarity * 0.3;
    }
    
    // Category alignment
    if (component.content.assetCategory && asset.category === component.content.assetCategory) {;
      score += 0.2;
    }
    
    // Usage alignment
    if (component.name.toLowerCase().includes('hero') && asset.usage === 'hero') {;
      score += 0.3;
    }
    
    return score;
  }

  private calculateToneAlignment(copyTone: string, motivation: PsychologicalMotivation): number {
    const toneMapping: Record<string, string[]> = {
      urgent: ['fear_of_missing_out', 'scarcity'],
      emotional: ['aspiration', 'belonging', 'achievement'],
      authoritative: ['authority', 'security'],
      friendly: ['social_proof', 'reciprocity'],
      professional: ['authority', 'achievement'],
      casual: ['belonging', 'social_proof']
    };
    
    const alignedCategories = toneMapping[copyTone] || [];
    return alignedCategories.includes(motivation.motivationCategory) ? 1.0 : 0.5;
  }

  private applyCustomizations(
    components: PopulatedComponent[],
    customizations: TemplateCustomization[]
  ): PopulatedComponent[] {
    const customized = [...components];
    
    for (const customization of customizations) {
      const component = customized.find((c: any) => c.componentId === customization.componentId);
      if (component) {
        // Apply customization based on property
        if (customization.property.startsWith('styling.')) {
          const stylingProperty = customization.property.replace('styling.', '');
          (component.finalStyling as any)[stylingProperty] = customization.customValue;
        } else if (customization.property.startsWith('position.')) {
          const positionProperty = customization.property.replace('position.', '');
          (component.finalPosition as any)[positionProperty] = customization.customValue;
        } else if (customization.property.startsWith('content.')) {
          const contentProperty = customization.property.replace('content.', '');
          (component.content as any)[contentProperty] = customization.customValue;
        }
      }
    }
    
    return customized;
  }

  private async generateRenderData(
    template: CampaignTemplate,
    components: PopulatedComponent[]
  ): Promise<PopulatedTemplate['renderData']> {
    // Generate HTML structure
    const html = this.generateHTML(template, components);
    
    // Generate CSS styles
    const css = this.generateCSS(template, components);
    
    // Generate JavaScript if needed
    const js = this.generateJavaScript(template, components);
    
    return { html, css, js };
  }

  private generateHTML(template: CampaignTemplate, components: PopulatedComponent[]): string {
    const componentHtml = components.map((component: any) => {;
      const templateComponent = template.components.find((c: any) => c.id === component.componentId);
      if (!templateComponent) return '';
      
      return this.generateComponentHTML(templateComponent, component);
    }).join('\n');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">;
  <meta name="viewport" content="width=device-width, initial-scale=1.0">;
  <title>${template.name}</title>
</head>
<body>
  <div class="campaign-container" style="width: ${template.dimensions.width}px; height: ${template.dimensions.height}px; position: relative;">
    ${componentHtml}
  </div>
</body>
</html>`;
  }

  private generateComponentHTML(templateComponent: TemplateComponent, populatedComponent: PopulatedComponent): string {
    const { type } = templateComponent;
    const { content } = populatedComponent;
    
    switch (type) {
      case 'text':
        return `<div class="component-${templateComponent.id}" data-component-id="${templateComponent.id}">${content.text || ''}</div>`;
      case 'image':
        return `<img class="component-${templateComponent.id}" data-component-id="${templateComponent.id}" src="${content.assetUrl || ''}" alt="${templateComponent.name}" />`;
      case 'button':
        return `<button class="component-${templateComponent.id}" data-component-id="${templateComponent.id}">${content.text || 'Button'}</button>`;
      default:
        return `<div class="component-${templateComponent.id}" data-component-id="${templateComponent.id}"></div>`;
    }
  }

  private generateCSS(template: CampaignTemplate, components: PopulatedComponent[]): string {
    const containerCSS = `;
.campaign-container {
  position: relative;,
  width: ${template.dimensions.width}px;
  height: ${template.dimensions.height}px;
  overflow: hidden;
}`;
    
    const componentCSS = components.map((component: any) => {;
      const styling = component.finalStyling;
      const position = component.finalPosition;
      
      return `
.component-${component.componentId} {
  position: absolute;,
  left: ${position.x}${position.unit};
  top: ${position.y}${position.unit};
  width: ${position.width}${position.unit};
  height: ${position.height}${position.unit};
  ${styling.backgroundColor ? `background-color: ${styling.backgroundColor};` : ''}
  ${styling.color ? `color: ${styling.color};` : ''}
  ${styling.fontSize ? `font-size: ${styling.fontSize}px;` : ''}
  ${styling.fontWeight ? `font-weight: ${styling.fontWeight};` : ''}
  ${styling.textAlign ? `text-align: ${styling.textAlign};` : ''}
  ${styling.borderRadius ? `border-radius: ${styling.borderRadius}px;` : ''}
  ${styling.padding ? `padding: ${styling.padding}px;` : ''}
  ${styling.margin ? `margin: ${styling.margin}px;` : ''}
  ${styling.opacity ? `opacity: ${styling.opacity};` : ''}
  ${styling.zIndex ? `z-index: ${styling.zIndex};` : ''}
}`;
    }).join('\n');
    
    return containerCSS + componentCSS;
  }

  private generateJavaScript(template: CampaignTemplate, components: PopulatedComponent[]): string {
    // Generate basic interactivity if needed
    return `
document.addEventListener('DOMContentLoaded', function() {
  // Template: ${template.name}
  // Add any interactive functionality here
});`;
  }

  private async generatePreviews(
    renderData: PopulatedTemplate['renderData'],
    template: CampaignTemplate
  ): Promise<PopulatedTemplate['preview']> {
    // Placeholder for preview generation
    // In production, would use headless browser or canvas rendering
    const baseUrl = 'https://example.com/previews';
    const id = Math.random().toString(36).substring(2, 9);
    
    return {
      thumbnailUrl: `${baseUrl}/thumb_${id}.jpg`,
      fullSizeUrl: `${baseUrl}/full_${id}.jpg`,
      interactiveUrl: `${baseUrl}/interactive_${id}.html`
    };
  }

  private mergeComponents(
    baseComponents: TemplateComponent[],
    modifications: Partial<TemplateComponent>[]
  ): TemplateComponent[] {
    const merged = [...baseComponents];
    
    modifications.forEach((mod: any) => {
      if (mod.id) {
        const index = merged.findIndex(c => c.id === mod.id);
        if (index >= 0) {
          merged[index] = { ...merged[index], ...mod };
        } else {
          // Add new component
          merged.push(mod as TemplateComponent);
        }
      }
    });
    
    return merged;
  }

  private initializeTemplateLibrary(): void {
    // Initialize with basic templates
    const templates = this.createBasicTemplates();
    templates.forEach((template: any) => {
      this.templateLibrary.set(template.id, template);
    });
  }

  private createBasicTemplates(): CampaignTemplate[] {
    return [
      {
        id: 'social-story-basic',
        name: 'Social Story - Basic',
        description: 'Simple Instagram/Facebook story template',
        category: 'social',
        platform: 'instagram',
        format: 'story',
        dimensions: { width: 1080, height: 1920, aspectRatio: '9:16'  },
  components: [
          {
            id: 'bg-1',
            type: 'background',
            name: 'Background',
            description: 'Main background',
            position: { x: 0, y: 0, width: 100, height: 100, unit: '%'  },
  styling: { backgroundColor: '#ffffff'  },
  content: { type: 'asset', assetType: 'image', assetCategory: 'background'  },
  constraints: { required: true, editable: true, resizable: false, moveable: false }
          },
          {
            id: 'headline-1',
            type: 'text',
            name: 'Headline',
            description: 'Main headline text',
            position: { x: 10, y: 20, width: 80, height: 15, unit: '%'  },
  styling: { fontSize: 32, fontWeight: 'bold', color: '#000000', textAlign: 'center'  },
  content: { type: 'copy', copyType: 'headline', placeholder: 'Your headline here'  },
  constraints: { required: true, editable: true, resizable: true, moveable: true, maxLength: 60 }
          },
          {
            id: 'cta-1',
            type: 'button',
            name: 'Call to Action',
            description: 'Action button',
            position: { x: 25, y: 75, width: 50, height: 8, unit: '%'  },
  styling: { backgroundColor: '#007AFF', color: '#ffffff', borderRadius: 25, fontSize: 18  },
  content: { type: 'copy', copyType: 'cta', placeholder: 'Get Started'  },
  constraints: { required: true, editable: true, resizable: true, moveable: true, maxLength: 25 }
          }
        ],
        designSystem: {
          colorScheme: 'primary',
          typography: { primary: 'Arial', secondary: 'Arial', hierarchy: ['h1', 'h2', 'p'] },
          spacing: { unit: 8, scale: [1, 2, 3, 4, 6, 8, 12] },
          layout: 'absolute' },
  requirements: {
          minAssets: 1,
          maxAssets: 3,
          requiredAssetTypes: ['image'],
          copyTypes: ['headline', 'cta'],
          minCopyLength: 10,
          maxCopyLength: 100 },
  metadata: {
          usage: 'promotional',
          difficulty: 'beginner',
          estimatedTime: 15,
          popularityScore: 0.9,
          tags: ['social', 'story', 'promotion', 'simple']
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      }
      // More templates would be added here...
    ];
  }

  // Utility methods
  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generatePopulatedTemplateId(): string {
    return `populated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let templateEngineInstance: TemplateEngine | null = null;

export const getTemplateEngine = (): TemplateEngine => {;
  if (!templateEngineInstance) {
    templateEngineInstance = new TemplateEngine();
  }
  return templateEngineInstance;
};

// Convenience functions
export const findMatchingTemplates = (;
  brief: ParsedBrief,
  motivation: PsychologicalMotivation,
  availableCopy: CopyVariant[],
  availableAssets: Asset[],
  options?: TemplateMatchingOptions
) => {
  return getTemplateEngine().findMatchingTemplates(brief, motivation, availableCopy, availableAssets, options);
};

export const populateTemplate = (;
  template: CampaignTemplate,
  brief: ParsedBrief,
  motivation: PsychologicalMotivation,
  selectedCopy: CopyVariant[],
  selectedAssets: Asset[],
  customizations?: TemplateCustomization[]
) => {
  return getTemplateEngine().populateTemplate(template, brief, motivation, selectedCopy, selectedAssets, customizations);
};

export const customizeTemplate = (;
  populatedTemplate: PopulatedTemplate,
  customizations: TemplateCustomization[]
) => {
  return getTemplateEngine().customizeTemplate(populatedTemplate, customizations);
};