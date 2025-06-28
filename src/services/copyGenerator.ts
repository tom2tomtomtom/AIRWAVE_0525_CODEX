import { getLogger } from '@/lib/logger';
import { classifyError } from '@/lib/error-handling/error-classifier';
import { cached, CacheProfiles } from '@/lib/cache/redis-cache';
import { ParsedBrief } from './briefParser';
import { PsychologicalMotivation, MotivationSet } from './motivationGenerator';

const logger = getLogger('copy-generator');

export interface CopyVariant {
  id: string;
  motivationId: string;
  type: 'headline' | 'subheadline' | 'body' | 'cta' | 'tagline' | 'social';
  content: string;
  tone: 'professional' | 'casual' | 'urgent' | 'emotional' | 'authoritative' | 'friendly';
  format: 'short' | 'medium' | 'long';
  platform: 'web' | 'social' | 'email' | 'print' | 'video' | 'universal';
  characterCount: number;
  wordCount: number;
  confidence: number;
  abTestSuitability: number;
  emotionalImpact: number;
  clarity: number;
  uniqueness: number;
  brandAlignment: number;
  generatedAt: Date;
}

export interface CopySet {
  id: string;
  briefId: string;
  motivationSetId: string;
  variants: CopyVariant[];
  generatedAt: Date;
  version: number;
  metadata: {
        totalVariants: number;
    typeDistribution: Record<string, number>;
    toneDistribution: Record<string, number>;
    platformDistribution: Record<string, number>;
    averageConfidence: number;
    averageEmotionalImpact: number;
    diversityScore: number;
  
      };
}

export interface CopyGenerationOptions {
  variantsPerMotivation?: number;
  includeAllTypes?: boolean;
  specificTypes?: Array<CopyVariant['type']>;
  tonePreferences?: Array<CopyVariant['tone']>;
  platformTargets?: Array<CopyVariant['platform']>;
  characterLimits?: Record<string, number>;
  brandVoice?: {
    personality: string;
    values: string[];
    avoidWords: string[];
    preferredStyle: string;
  };
  competitorAnalysis?: boolean;
}

export interface CopyTemplate {
  type: CopyVariant['type'];
  template: string;
  placeholders: string[];
  characterLimit?: number;
  platform: CopyVariant['platform'];
  tone: CopyVariant['tone'];
}

export class CopyGenerator {
  private readonly DEFAULT_VARIANTS_PER_MOTIVATION = 8;
  private readonly COPY_TYPES: Array<CopyVariant['type']> = [
    'headline', 'subheadline', 'body', 'cta', 'tagline', 'social'
  ];
  private readonly TONE_OPTIONS: Array<CopyVariant['tone']> = [
    'professional', 'casual', 'urgent', 'emotional', 'authoritative', 'friendly'
  ];
  private readonly PLATFORM_OPTIONS: Array<CopyVariant['platform']> = [
    'web', 'social', 'email', 'print', 'video', 'universal'
  ];

  private readonly CHARACTER_LIMITS = {
    headline: { short: 30, medium: 60, long: 90  },
  subheadline: { short: 50, medium: 100, long: 150  },
  body: { short: 100, medium: 250, long: 500  },
  cta: { short: 15, medium: 25, long: 40  },
  tagline: { short: 20, medium: 40, long: 60  },
  social: { short: 140, medium: 280, long: 500 }
  };

  async generateCopySet(
    brief: ParsedBrief,
    motivationSet: MotivationSet,
    selectedMotivationIds: string[],
    options: CopyGenerationOptions = {}
  ): Promise<CopySet> {
    const {
      variantsPerMotivation = this.DEFAULT_VARIANTS_PER_MOTIVATION,
      includeAllTypes = true,
      specificTypes = this.COPY_TYPES,
      tonePreferences = this.TONE_OPTIONS,
      platformTargets = ['web', 'social', 'email'],
      brandVoice,
      competitorAnalysis = false
    } = options;

    try {
      logger.info('Starting copy generation', {
        briefId: brief.id,
        motivationSetId: motivationSet.id,
        selectedMotivations: selectedMotivationIds.length,
        variantsPerMotivation
      });

      const selectedMotivations = motivationSet.motivations.filter((m: any) => 
        selectedMotivationIds.includes(m.id)
      );

      if (selectedMotivations.length === 0) {
        throw new Error('No valid motivations selected for copy generation');
      }

      // Generate copy variants for each selected motivation
      const allVariants: CopyVariant[] = [];
      
      for (const motivation of selectedMotivations) {
        const motivationVariants = await this.generateVariantsForMotivation(
          brief,
          motivation,
          variantsPerMotivation,
          specificTypes,
          tonePreferences,
          platformTargets,
          brandVoice
        );
        allVariants.push(...motivationVariants);
      }

      // Apply quality filtering and balancing
      const balancedVariants = this.balanceVariants(allVariants, options);

      // Create copy set
      const copySet: CopySet = {
        id: this.generateCopySetId(brief.id, motivationSet.id),
        briefId: brief.id,
        motivationSetId: motivationSet.id,
        variants: balancedVariants,
        generatedAt: new Date(),
        version: 1,
        metadata: this.calculateCopyMetadata(balancedVariants)
      };

      logger.info('Copy generation completed', {
        briefId: brief.id,
        copySetId: copySet.id,
        totalVariants: copySet.variants.length,
        averageConfidence: copySet.metadata.averageConfidence
      });

      return copySet;

    } catch (error: any) {
      const classified = classifyError(error as Error, {
        route: 'copy-generator',
        metadata: { 
          briefId: brief.id, 
          motivationSetId: motivationSet.id,
          selectedCount: selectedMotivationIds.length 
        }
      });
      
      logger.error('Copy generation failed', classified.originalError);
      throw error;
    }
  }

  private async generateVariantsForMotivation(
    brief: ParsedBrief,
    motivation: PsychologicalMotivation,
    variantCount: number,
    types: Array<CopyVariant['type']>,
    tones: Array<CopyVariant['tone']>,
    platforms: Array<CopyVariant['platform']>,
    brandVoice?: CopyGenerationOptions['brandVoice']
  ): Promise<CopyVariant[]> {
    const cacheKey = `copy_variants_${this.hashMotivation(motivation)}_${variantCount}`;
    
    return cached(
      async () => {
        const variants: CopyVariant[] = [];
        
        // Calculate distribution across types, tones, and platforms
        const distribution = this.calculateVariantDistribution(variantCount, types, tones, platforms);
        
        for (const config of distribution) {
          const prompt = this.buildCopyPrompt(brief, motivation, config, brandVoice);
          const response = await this.callAIService(prompt);
          const generatedCopy = await this.parseCopyResponse(response, motivation.id, config);
          
          if (generatedCopy) {
            variants.push(generatedCopy);
          }
        }
        
        return variants;
      },
      () => cacheKey,
      CacheProfiles.AI_GENERATION
    )();
  }

  private calculateVariantDistribution(
    totalVariants: number,
    types: Array<CopyVariant['type']>,
    tones: Array<CopyVariant['tone']>,
    platforms: Array<CopyVariant['platform']>
  ): Array<{
    type: CopyVariant['type'];
    tone: CopyVariant['tone'];
    platform: CopyVariant['platform'];
    format: CopyVariant['format'];
  }> {
    const distribution: Array<{
      type: CopyVariant['type'];
      tone: CopyVariant['tone'];
      platform: CopyVariant['platform'];
      format: CopyVariant['format'];
    }> = [];

    const formats: Array<CopyVariant['format']> = ['short', 'medium', 'long'];
    
    for (let i = 0; i < totalVariants; i++) {
      distribution.push({
        type: types[i % types.length],
        tone: tones[i % tones.length],
        platform: platforms[i % platforms.length],
        format: formats[i % formats.length]
      });
    }
    
    return distribution;
  }

  private buildCopyPrompt(
    brief: ParsedBrief,
    motivation: PsychologicalMotivation,
    config: {
      type: CopyVariant['type'];
      tone: CopyVariant['tone'];
      platform: CopyVariant['platform'];
      format: CopyVariant['format'];
    },
    brandVoice?: CopyGenerationOptions['brandVoice']
  ): string {
    const characterLimit = this.CHARACTER_LIMITS[config.type][config.format];
    
    return `
You are an expert copywriter creating ${config.type} copy for a marketing campaign.

Brief Context:
- Product: ${brief.product}
- Brand: ${brief.brand}
- Objective: ${brief.objective}
- Key Proposition: ${brief.keyProposition}
- Core Reason to Buy: ${brief.coreReasonToBuy}
- Target Audience: ${brief.targetAudience || 'Not specified'}

Psychological Motivation:
- Title: ${motivation.title}
- Psychology Type: ${motivation.psychologyType}
- Target Segment: ${motivation.targetSegment}
- Key Message: ${motivation.keyMessage}
- Emotional Triggers: ${motivation.emotionalTriggers.join(', ')}
- Copy Direction: ${motivation.copyDirection}

Copy Requirements:
- Type: ${config.type}
- Tone: ${config.tone}
- Platform: ${config.platform}
- Format: ${config.format}
- Character Limit: ${characterLimit} characters
${brandVoice ? `
Brand Voice:
- Personality: ${brandVoice.personality}
- Values: ${brandVoice.values.join(', ')}
- Avoid: ${brandVoice.avoidWords.join(', ')}
- Style: ${brandVoice.preferredStyle}` : ''}

Platform-Specific Guidelines:
${this.getPlatformGuidelines(config.platform)}

Create compelling ${config.type} copy that:
1. Leverages the psychological motivation effectively
2. Matches the specified tone and platform
3. Stays within the character limit
4. Drives the desired action
5. Aligns with the brand voice (if provided)
6. Uses the emotional triggers strategically

For ${config.type}, focus on:
${this.getCopyTypeGuidelines(config.type)}

Respond with a single, compelling piece of copy that maximizes impact within the constraints.
Do not include explanations or alternatives - just the final copy.
`;
  }

  private getPlatformGuidelines(platform: CopyVariant['platform']): string {
    const guidelines = {
      web: '- Optimized for web reading patterns\n- Clear hierarchy and scannable\n- SEO-conscious language',
      social: '- Engaging and shareable\n- Hashtag-friendly\n- Mobile-optimized\n- Conversation starters',
      email: '- Subject line focused\n- Personal and direct\n- Clear call-to-action\n- Mobile preview optimized',
      print: '- High visual impact\n- Readable at distance\n- Timeless messaging\n- Print-safe language',
      video: '- Audio-friendly\n- Quick engagement\n- Visual storytelling support\n- Memorable phrases',
      universal: '- Cross-platform adaptable\n- Clear and direct\n- Brand-focused\n- Versatile messaging'
    };
    
    return guidelines[platform] || guidelines.universal;
  }

  private getCopyTypeGuidelines(type: CopyVariant['type']): string {
    const guidelines = {
      headline: '- Grab immediate attention\n- Convey core benefit\n- Create curiosity or urgency\n- Use powerful, emotional words',
      subheadline: '- Support and expand the headline\n- Add credibility or details\n- Bridge to body copy\n- Clarify the value proposition',
      body: '- Tell the complete story\n- Address objections\n- Build desire and trust\n- Lead naturally to CTA',
      cta: '- Create immediate action\n- Use action verbs\n- Remove friction\n- Create urgency when appropriate',
      tagline: '- Memorable brand association\n- Capture brand essence\n- Be distinctive and ownable\n- Work across contexts',
      social: '- Encourage engagement\n- Be conversation-worthy\n- Include clear value\n- Optimize for sharing'
    };
    
    return guidelines[type] || '';
  }

  private async callAIService(prompt: string): Promise<string> {
    // Placeholder for AI service integration
    // This would integrate with OpenAI, Anthropic, or your preferred AI service
    
    // For now, return mock responses that vary by copy type
    const mockResponses = [
      "Transform Your Business Today - Join Industry Leaders",
      "Unlock exclusive benefits that your competitors don't have access to",
      "Don't let another day pass without the competitive advantage you deserve. Our solution has helped over 10,000 professionals achieve breakthrough results in just 30 days.",
      "Get Started Risk-Free",
      "Innovation That Delivers Results",
      "Ready to join the success stories? 🚀 #Innovation #Success"
    ];
    
    return mockResponses[Math.floor(Math.random() * mockResponses.length)];
  }

  private async parseCopyResponse(
    response: string,
    motivationId: string,
    config: {
      type: CopyVariant['type'];
      tone: CopyVariant['tone'];
      platform: CopyVariant['platform'];
      format: CopyVariant['format'];
    }
  ): Promise<CopyVariant | null> {
    try {
      const content = response.trim();
      
      if (!content) {
        throw new Error('Empty copy response');
      }

      const characterCount = content.length;
      const wordCount = content.split(/\s+/).length;
      const characterLimit = this.CHARACTER_LIMITS[config.type][config.format];

      // Calculate quality scores
      const scores = this.calculateQualityScores(content, config, characterLimit);

      return {
        id: this.generateVariantId(motivationId, config.type),
        motivationId,
        type: config.type,
        content,
        tone: config.tone,
        format: config.format,
        platform: config.platform,
        characterCount,
        wordCount,
        confidence: scores.confidence,
        abTestSuitability: scores.abTestSuitability,
        emotionalImpact: scores.emotionalImpact,
        clarity: scores.clarity,
        uniqueness: scores.uniqueness,
        brandAlignment: scores.brandAlignment,
        generatedAt: new Date()
      };
    } catch (error: any) {
      logger.error('Failed to parse copy response', error);
      return null;
    }
  }

  private calculateQualityScores(
    content: string,
    config: {
      type: CopyVariant['type'];
      tone: CopyVariant['tone'];
      platform: CopyVariant['platform'];
      format: CopyVariant['format'];
    },
  characterLimit: number
  ): {
    confidence: number;
    abTestSuitability: number;
    emotionalImpact: number;
    clarity: number;
    uniqueness: number;
    brandAlignment: number;
  } {
    // Simple scoring algorithm - in production would use more sophisticated analysis
    const lengthScore = Math.min(content.length / characterLimit, 1.0);
    const complexityScore = 1.0 - (content.split(' ').length / content.length);
    const actionWordScore = this.hasActionWords(content) ? 0.8 : 0.4;
    
    return {
      confidence: (lengthScore + complexityScore + actionWordScore) / 3,
      abTestSuitability: Math.random() * 0.3 + 0.7, // 0.7-1.0
      emotionalImpact: this.analyzeEmotionalImpact(content),
      clarity: this.analyzeClarity(content),
      uniqueness: Math.random() * 0.4 + 0.6, // 0.6-1.0
      brandAlignment: Math.random() * 0.3 + 0.7 // 0.7-1.0
    };
  }

  private hasActionWords(content: string): boolean {
    const actionWords = [
      'get', 'start', 'begin', 'discover', 'unlock', 'transform', 
      'achieve', 'improve', 'boost', 'increase', 'gain', 'save',
      'learn', 'master', 'create', 'build', 'join', 'try'
    ];
    
    const words = content.toLowerCase().split(/\s+/);
    return actionWords.some(action => words.includes(action));
  }

  private analyzeEmotionalImpact(content: string): number {
    const emotionalWords = [
      'amazing', 'incredible', 'transform', 'breakthrough', 'exclusive',
      'limited', 'urgent', 'secret', 'proven', 'guaranteed', 'free',
      'instant', 'powerful', 'revolutionary', 'effortless'
    ];
    
    const words = content.toLowerCase().split(/\s+/);
    const emotionalWordCount = emotionalWords.filter((word: any) => 
      words.some(w => w.includes(word))
    ).length;
    
    return Math.min(emotionalWordCount / 3, 1.0);
  }

  private analyzeClarity(content: string): number {
    // Simple clarity analysis based on sentence length and word complexity
    const sentences = content.split(/[.!?]+/).filter((s: any) => s.trim());
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
    
    // Prefer moderate sentence lengths (10-20 words)
    const idealLength = 15;
    const lengthScore = 1 - Math.abs(avgSentenceLength - idealLength) / idealLength;
    
    return Math.max(lengthScore, 0.3);
  }

  private balanceVariants(
    variants: CopyVariant[],
    options: CopyGenerationOptions
  ): CopyVariant[] {
    // Sort by overall quality score
    const scored = variants.map((variant: any) => ({
      variant,
      qualityScore: this.calculateOverallQualityScore(variant)
    }));

    scored.sort((a, b) => b.qualityScore - a.qualityScore);

    // Apply diversity filtering
    const balanced = this.ensureVariantDiversity(scored.map((s: any) => s.variant));

    return balanced;
  }

  private calculateOverallQualityScore(variant: CopyVariant): number {
    return (
      variant.confidence * 0.3 +
      variant.emotionalImpact * 0.25 +
      variant.clarity * 0.2 +
      variant.abTestSuitability * 0.15 +
      variant.brandAlignment * 0.1
    );
  }

  private ensureVariantDiversity(variants: CopyVariant[]): CopyVariant[] {
    const diverse: CopyVariant[] = [];
    const seenCombinations = new Set<string>();

    for (const variant of variants) {
      const combination = `${variant.type}_${variant.tone}_${variant.platform}`;
      
      if (!seenCombinations.has(combination)) {
        diverse.push(variant);
        seenCombinations.add(combination);
      } else if (diverse.length < variants.length * 0.8) {
        // Allow some duplicates but limit them
        diverse.push(variant);
      }
    }

    return diverse;
  }

  private calculateCopyMetadata(variants: CopyVariant[]): CopySet['metadata'] {
    const typeDistribution = variants.reduce((dist, v) => {
      dist[v.type] = (dist[v.type] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    const toneDistribution = variants.reduce((dist, v) => {
      dist[v.tone] = (dist[v.tone] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    const platformDistribution = variants.reduce((dist, v) => {
      dist[v.platform] = (dist[v.platform] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    const averageConfidence = variants.reduce((sum, v) => sum + v.confidence, 0) / variants.length;
    const averageEmotionalImpact = variants.reduce((sum, v) => sum + v.emotionalImpact, 0) / variants.length;

    const uniqueCombinations = new Set(variants.map((v: any) => `${v.type}_${v.tone}_${v.platform}`));
    const diversityScore = uniqueCombinations.size / variants.length;

    return {
      totalVariants: variants.length,
      typeDistribution,
      toneDistribution,
      platformDistribution,
      averageConfidence,
      averageEmotionalImpact,
      diversityScore
    };
  }

  // Public utility methods
  async validateCopySet(copySet: CopySet): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check variant count
    if (copySet.variants.length < 10) {
      issues.push('Insufficient copy variants (minimum 10 recommended)');
    }

    // Check type coverage
    const types = new Set(copySet.variants.map((v: any) => v.type));
    if (types.size < 4) {
      suggestions.push('Consider adding more copy types for better coverage');
    }

    // Check quality scores
    const lowQualityCount = copySet.variants.filter((v: any) => v.confidence < 0.6).length;
    if (lowQualityCount > copySet.variants.length * 0.3) {
      suggestions.push('Some copy variants have low quality scores - consider regenerating');
    }

    // Check character limit adherence
    const overLimitCount = copySet.variants.filter((v: any) => {
      const limit = this.CHARACTER_LIMITS[v.type as keyof typeof this.CHARACTER_LIMITS]?.[v.format as keyof typeof this.CHARACTER_LIMITS[keyof typeof this.CHARACTER_LIMITS]];
      return limit && v.characterCount > limit;
    }).length;

    if (overLimitCount > 0) {
      issues.push(`${overLimitCount} variants exceed character limits`);
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }

  async refineCopySet(
    copySet: CopySet,
    refinements: {
      improveQuality?: boolean;
      adjustTone?: CopyVariant['tone'];
      focusPlatform?: CopyVariant['platform'];
      enhanceEmotionalImpact?: boolean;
      brandVoice?: CopyGenerationOptions['brandVoice'];
    }
  ): Promise<CopySet> {
    // Implementation would refine existing copy based on parameters
    // For now, return the original with incremented version
    return {
      ...copySet,
      version: copySet.version + 1,
      metadata: this.calculateCopyMetadata(copySet.variants)
    };
  }

  // Utility methods
  private generateCopySetId(briefId: string, motivationSetId: string): string {
    return `copyset_${briefId}_${motivationSetId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateVariantId(motivationId: string, type: string): string {
    return `copyvar_${motivationId}_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private hashMotivation(motivation: PsychologicalMotivation): string {
    const key = `${motivation.title}_${motivation.psychologyType}_${motivation.motivationCategory}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// Singleton instance
let copyGeneratorInstance: CopyGenerator | null = null;

export const getCopyGenerator = (): CopyGenerator => {
  if (!copyGeneratorInstance) {
    copyGeneratorInstance = new CopyGenerator();
  }
  return copyGeneratorInstance;
};

// Convenience functions
export const generateCopySet = (
  brief: ParsedBrief,
  motivationSet: MotivationSet,
  selectedMotivationIds: string[],
  options?: CopyGenerationOptions
): Promise<CopySet> => {
  return getCopyGenerator().generateCopySet(brief, motivationSet, selectedMotivationIds, options);
};

export const validateCopySet = (
  copySet: CopySet
): Promise<ReturnType<CopyGenerator['validateCopySet']>> => {
  return getCopyGenerator().validateCopySet(copySet);
};

export const refineCopySet = (
  copySet: CopySet,
  refinements: Parameters<CopyGenerator['refineCopySet']>[1]
): Promise<CopySet> => {
  return getCopyGenerator().refineCopySet(copySet, refinements);
};