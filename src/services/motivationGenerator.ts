import { getLogger } from '@/lib/logger';
import { classifyError } from '@/lib/error-handling/error-classifier';
import { cached, CacheProfiles } from '@/lib/cache/redis-cache';
import { ParsedBrief } from './briefParser';

const logger = getLogger('motivation-generator');

export interface PsychologicalMotivation {
  id: string;
  title: string;
  description: string;
  psychologyType: 'cognitive' | 'emotional' | 'social' | 'behavioral';
  motivationCategory: 
    | 'fear_of_missing_out' 
    | 'social_proof' 
    | 'authority' 
    | 'scarcity' 
    | 'reciprocity' 
    | 'commitment' 
    | 'aspiration' 
    | 'security' 
    | 'convenience' 
    | 'status' 
    | 'belonging' 
    | 'achievement';
  targetSegment: string;
  keyMessage: string;
  emotionalTriggers: string[];
  copyDirection: string;
  examples: string[];
  intensity: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface MotivationSet {
  id: string;
  briefId: string;
  motivations: PsychologicalMotivation[];
  generatedAt: Date;
  version: number;
  metadata: {},
        totalMotivations: number;
    diversityScore: number;
    averageConfidence: number;
    psychologyDistribution: Record<string, number>;
    targetCoverage: string[];
  
      };
}

export interface MotivationGenerationOptions {
  motivationCount?: number;
  diversityWeight?: number;
  includeNiche?: boolean;
  psychologyBalance?: boolean;
  customPrompts?: string[];
}

export class MotivationGenerator {
  private readonly DEFAULT_MOTIVATION_COUNT = 12;
  private readonly PSYCHOLOGY_TYPES = ['cognitive', 'emotional', 'social', 'behavioral'];
  private readonly MOTIVATION_CATEGORIES = [
    'fear_of_missing_out',
    'social_proof', 
    'authority',
    'scarcity',
    'reciprocity',
    'commitment',
    'aspiration',
    'security',
    'convenience',
    'status',
    'belonging',
    'achievement'
  ];

  async generateMotivations(
    brief: ParsedBrief,
    options: MotivationGenerationOptions = {}
  ): Promise<MotivationSet> {
    const {
      motivationCount = this.DEFAULT_MOTIVATION_COUNT,
      diversityWeight = 0.8,
      includeNiche = true,
      psychologyBalance = true,
      customPrompts = []
    } = options;

    try {
      logger.info('Starting motivation generation', {
        briefId: brief.id,
        motivationCount,
        options
      });

      // Generate core motivations using AI
      const coreMotivations = await this.generateCoreMotivations(brief, motivationCount);
      
      // Enhance with psychological analysis
      const enhancedMotivations = await this.enhanceWithPsychology(brief, coreMotivations);
      
      // Apply diversity and balance
      const balancedMotivations = this.balanceMotivations(
        enhancedMotivations, 
        motivationCount,
        diversityWeight,
        psychologyBalance
      );
      
      // Generate final motivation set
      const motivationSet: MotivationSet = {
        id: this.generateMotivationSetId(brief.id),
        briefId: brief.id,
        motivations: balancedMotivations,
        generatedAt: new Date(),
        version: 1,
        metadata: this.calculateMetadata(balancedMotivations)
      };

      logger.info('Motivation generation completed', {
        briefId: brief.id,
        motivationSetId: motivationSet.id,
        totalMotivations: motivationSet.motivations.length,
        averageConfidence: motivationSet.metadata.averageConfidence
      });

      return motivationSet;

    } catch (error: any) {
      const classified = classifyError(error as Error, {
        route: 'motivation-generator',
        metadata: { briefId: brief.id, motivationCount }
      });
      
      logger.error('Motivation generation failed', classified.originalError);
      throw error;
    }
  }

  private async generateCoreMotivations(
    brief: ParsedBrief,
    count: number
  ): Promise<Partial<PsychologicalMotivation>[]> {
    const cacheKey = `motivations_core_${this.hashBrief(brief)}_${count}`;
    
    return cached(
      async () => {
        const prompt = this.buildMotivationPrompt(brief, count);
        const response = await this.callAIService(prompt);
        return this.parseMotivationResponse(response);
      },
      () => cacheKey,
      CacheProfiles.AI_GENERATION
    )();
  }

  private buildMotivationPrompt(brief: ParsedBrief, count: number): string {
    return `
You are an expert consumer psychologist and marketing strategist. Generate ${count} distinct psychological motivations that would drive different customer segments to engage with this product/service.

Brief Analysis:
- Product: ${brief.product}
- Brand: ${brief.brand}
- Objective: ${brief.objective}
- Key Proposition: ${brief.keyProposition}
- Core Reason to Buy: ${brief.coreReasonToBuy}
- Target Audience: ${brief.targetAudience || 'Not specified'}

For each motivation, consider:
1. Different psychological triggers (fear, desire, social dynamics, personal goals)
2. Various customer segments and their unique drivers
3. Emotional and rational motivations
4. Immediate and long-term benefits
5. Personal vs. social motivations

Generate diverse motivations across these categories:
- Fear of Missing Out (FOMO)
- Social Proof & Belonging
- Authority & Trust
- Scarcity & Exclusivity
- Reciprocity & Gratitude
- Commitment & Consistency
- Aspiration & Achievement
- Security & Risk Reduction
- Convenience & Efficiency
- Status & Recognition

For each motivation, provide:
- Title (compelling 3-7 word headline)
- Description (2-3 sentence explanation)
- Psychology type (cognitive/emotional/social/behavioral)
- Target segment (who this appeals to most)
- Key message (core appeal in one sentence)
- Emotional triggers (3-4 specific emotions)
- Copy direction (tone and approach guidance)
- Example applications (2-3 concrete examples)
- Intensity level (low/medium/high)

Respond in JSON format:
{
  "motivations": [
    {
      "title": "Exclusive Early Access Advantage",
      "description": "Appeals to customers who value being first and having competitive advantages. Creates urgency through limited availability.",
      "psychologyType": "emotional",
      "motivationCategory": "scarcity",
      "targetSegment": "Early adopters and competitive professionals",
      "keyMessage": "Be among the first to gain the competitive edge others are waiting for",
      "emotionalTriggers": ["excitement", "superiority", "urgency", "pride"],
      "copyDirection": "Urgent, exclusive tone with emphasis on limited access and competitive advantage",
      "examples": ["Limited beta access for power users", "First 100 customers get premium features", "Be ahead of your competition"],
      "intensity": "high",
      "confidence": 0.85
    }
  ]
}

Ensure each motivation:
- Targets a different customer psychology
- Uses distinct emotional triggers
- Appeals to different demographic/psychographic segments
- Provides actionable copy direction
- Is relevant to the specific brief provided

Make them diverse, authentic, and psychologically grounded.
`;
  }

  private async callAIService(prompt: string): Promise<string> {
    // Placeholder for AI service integration
    // This would integrate with OpenAI, Anthropic, or your preferred AI service
    
    // For now, return mock response with realistic psychological motivations
    return JSON.stringify({
      motivations: [
        {
          title: "Stay Ahead of Trends",
          description: "Appeals to innovators who fear being left behind by technological or market changes. Creates urgency around competitive positioning.",
          psychologyType: "cognitive",
          motivationCategory: "fear_of_missing_out",
          targetSegment: "Forward-thinking professionals and early adopters",
          keyMessage: "Don't let your competitors get ahead while you're still catching up",
          emotionalTriggers: ["anxiety", "determination", "ambition", "urgency"],
          copyDirection: "Future-focused language with emphasis on competitive advantage and market leadership",
          examples: ["Industry leaders are already using this", "The future of [industry] starts here", "Join the innovators"],
          intensity: "high",
          confidence: 0.9 }
        {
          title: "Trusted by Experts",
          description: "Leverages authority and credibility to reduce risk perception. Appeals to customers who value expert validation.",
          psychologyType: "social",
          motivationCategory: "authority",
          targetSegment: "Risk-averse decision makers and quality-conscious buyers",
          keyMessage: "If it's good enough for the experts, it's good enough for you",
          emotionalTriggers: ["confidence", "trust", "security", "validation"],
          copyDirection: "Authoritative tone with credible testimonials and expert endorsements",
          examples: ["Recommended by 9/10 specialists", "Chosen by Fortune 500 companies", "Expert-approved solution"],
          intensity: "medium",
          confidence: 0.85 }
        {
          title: "Exclusive Community Access",
          description: "Taps into belonging and status needs. Creates desire through exclusivity and community membership.",
          psychologyType: "social",
          motivationCategory: "belonging",
          targetSegment: "Status-conscious individuals and community seekers",
          keyMessage: "Join an exclusive group of like-minded achievers",
          emotionalTriggers: ["belonging", "pride", "exclusivity", "connection"],
          copyDirection: "Inclusive yet exclusive language emphasizing community and shared values",
          examples: ["Member-only benefits", "Private community access", "Connect with industry leaders"],
          intensity: "medium",
          confidence: 0.8 }
        {
          title: "Effortless Results",
          description: "Appeals to convenience-seekers who want maximum results with minimal effort. Reduces friction and complexity.",
          psychologyType: "behavioral",
          motivationCategory: "convenience",
          targetSegment: "Busy professionals and efficiency-focused users",
          keyMessage: "Achieve more while doing less",
          emotionalTriggers: ["relief", "satisfaction", "ease", "accomplishment"],
          copyDirection: "Simple, clear language emphasizing ease of use and quick results",
          examples: ["Set it and forget it", "Results in minutes, not hours", "Automated for your convenience"],
          intensity: "medium",
          confidence: 0.88 }
        {
          title: "Risk-Free Investment",
          description: "Reduces purchase anxiety through guarantees and risk mitigation. Appeals to cautious buyers.",
          psychologyType: "cognitive",
          motivationCategory: "security",
          targetSegment: "Risk-averse buyers and first-time customers",
          keyMessage: "Try it risk-free - your satisfaction is guaranteed",
          emotionalTriggers: ["security", "confidence", "trust", "peace_of_mind"],
          copyDirection: "Reassuring tone with emphasis on guarantees and customer protection",
          examples: ["30-day money-back guarantee", "No-risk trial", "100% satisfaction guaranteed"],
          intensity: "low",
          confidence: 0.92 }
        {
          title: "Limited Time Opportunity",
          description: "Creates urgency through time-based scarcity. Motivates immediate action to avoid regret.",
          psychologyType: "emotional",
          motivationCategory: "scarcity",
          targetSegment: "Action-oriented buyers and deal seekers",
          keyMessage: "Act now before this opportunity disappears forever",
          emotionalTriggers: ["urgency", "regret_avoidance", "excitement", "determination"],
          copyDirection: "Urgent, time-sensitive language with clear deadlines",
          examples: ["Limited time offer", "Only 48 hours left", "Expires at midnight"],
          intensity: "high",
          confidence: 0.87 }
        {
          title: "Proven Track Record",
          description: "Uses social proof and past success to build confidence. Appeals to evidence-based decision makers.",
          psychologyType: "cognitive",
          motivationCategory: "social_proof",
          targetSegment: "Data-driven buyers and skeptical customers",
          keyMessage: "Join thousands who have already transformed their results",
          emotionalTriggers: ["confidence", "validation", "optimism", "belonging"],
          copyDirection: "Evidence-based language with statistics and success stories",
          examples: ["10,000+ satisfied customers", "98% success rate", "Real results from real people"],
          intensity: "medium",
          confidence: 0.9 }
        {
          title: "Achieve Your Dreams",
          description: "Connects product to personal aspirations and life goals. Appeals to ambitious individuals.",
          psychologyType: "emotional",
          motivationCategory: "aspiration",
          targetSegment: "Goal-oriented individuals and self-improvers",
          keyMessage: "Transform your aspirations into achievable reality",
          emotionalTriggers: ["inspiration", "hope", "determination", "pride"],
          copyDirection: "Inspirational tone focusing on personal transformation and achievement",
          examples: ["Unlock your potential", "Live the life you've imagined", "Make your dreams reality"],
          intensity: "high",
          confidence: 0.83 }
        {
          title: "Industry Recognition",
          description: "Appeals to status and professional recognition needs. Creates desire for peer acknowledgment.",
          psychologyType: "social",
          motivationCategory: "status",
          targetSegment: "Career-focused professionals and ambitious individuals",
          keyMessage: "Gain the recognition and respect you deserve",
          emotionalTriggers: ["pride", "ambition", "satisfaction", "superiority"],
          copyDirection: "Professional tone emphasizing career advancement and recognition",
          examples: ["Stand out from the crowd", "Earn industry respect", "Become the go-to expert"],
          intensity: "medium",
          confidence: 0.81 }
        {
          title: "Family Protection Priority",
          description: "Taps into protective instincts and family responsibility. Appeals to parents and caregivers.",
          psychologyType: "emotional",
          motivationCategory: "security",
          targetSegment: "Parents, caregivers, and family-focused individuals",
          keyMessage: "Protect what matters most to you",
          emotionalTriggers: ["love", "responsibility", "protection", "peace_of_mind"],
          copyDirection: "Caring, protective tone emphasizing family benefits and safety",
          examples: ["Keep your family safe", "For those who matter most", "Peace of mind for parents"],
          intensity: "high",
          confidence: 0.89 }
        {
          title: "Return the Favor",
          description: "Uses reciprocity principle by highlighting value received. Appeals to fairness-minded individuals.",
          psychologyType: "behavioral",
          motivationCategory: "reciprocity",
          targetSegment: "Fair-minded customers and relationship builders",
          keyMessage: "We've helped you succeed - now help us grow",
          emotionalTriggers: ["gratitude", "fairness", "loyalty", "connection"],
          copyDirection: "Appreciative tone emphasizing mutual benefit and relationship",
          examples: ["Return the favor", "Help us help others", "Be part of our success story"],
          intensity: "low",
          confidence: 0.75 }
        {
          title: "Smart Investment Choice",
          description: "Appeals to rational buyers focused on ROI and long-term value. Emphasizes financial wisdom.",
          psychologyType: "cognitive",
          motivationCategory: "achievement",
          targetSegment: "Analytical buyers and value-conscious customers",
          keyMessage: "Make the smart choice that pays for itself",
          emotionalTriggers: ["confidence", "pride", "satisfaction", "wisdom"],
          copyDirection: "Rational, value-focused language with emphasis on ROI and long-term benefits",
          examples: ["Best value for money", "Smart investment", "Pays for itself in months"],
          intensity: "medium",
          confidence: 0.86
        }
      ]
    });
  }

  private parseMotivationResponse(response: string): Partial<PsychologicalMotivation>[] {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.motivations || !Array.isArray(parsed.motivations)) {
        throw new Error('Invalid AI response format');
      }

      return parsed.motivations.map((motivation: any, index: number) => ({
        id: this.generateMotivationId(index),
        title: this.sanitizeString(motivation.title),
        description: this.sanitizeString(motivation.description),
        psychologyType: motivation.psychologyType,
        motivationCategory: motivation.motivationCategory,
        targetSegment: this.sanitizeString(motivation.targetSegment),
        keyMessage: this.sanitizeString(motivation.keyMessage),
        emotionalTriggers: Array.isArray(motivation.emotionalTriggers) 
          ? motivation.emotionalTriggers.map((t: string) => this.sanitizeString(t)).filter(Boolean)
          : [],
        copyDirection: this.sanitizeString(motivation.copyDirection),
        examples: Array.isArray(motivation.examples)
          ? motivation.examples.map((e: string) => this.sanitizeString(e)).filter(Boolean)
          : [],
        intensity: motivation.intensity || 'medium',
        confidence: typeof motivation.confidence === 'number' ? motivation.confidence : 0.5
      }));
    } catch (error: any) {
      logger.error('Failed to parse motivation response', error);
      throw new Error('Invalid AI response format');
    }
  }

  private async enhanceWithPsychology(
    brief: ParsedBrief,
    motivations: Partial<PsychologicalMotivation>[]
  ): Promise<PsychologicalMotivation[]> {
    return motivations.map((motivation, index) => {
      // Ensure all required fields are present
      const enhanced: PsychologicalMotivation = {
        id: motivation.id || this.generateMotivationId(index),
        title: motivation.title || 'Untitled Motivation',
        description: motivation.description || 'No description provided',
        psychologyType: motivation.psychologyType || 'emotional',
        motivationCategory: motivation.motivationCategory || 'aspiration',
        targetSegment: motivation.targetSegment || 'General audience',
        keyMessage: motivation.keyMessage || motivation.title || 'Key message not specified',
        emotionalTriggers: motivation.emotionalTriggers || ['interest'],
        copyDirection: motivation.copyDirection || 'Engaging and benefit-focused',
        examples: motivation.examples || ['Example not provided'],
        intensity: motivation.intensity || 'medium',
        confidence: motivation.confidence || 0.5
      };

      // Enhance confidence based on brief alignment
      enhanced.confidence = this.calculateConfidenceScore(brief, enhanced);

      return enhanced;
    });
  }

  private balanceMotivations(
    motivations: PsychologicalMotivation[],
    targetCount: number,
    diversityWeight: number,
    psychologyBalance: boolean
  ): PsychologicalMotivation[] {
    // Sort by confidence and diversity
    let balanced = [...motivations].sort((a, b) => {
      const confidenceScore = (b.confidence - a.confidence) * (1 - diversityWeight);
      const diversityScore = this.calculateDiversityScore(a, motivations) * diversityWeight;
      return confidenceScore + diversityScore;
    });

    // Apply psychology balance if requested
    if (psychologyBalance) {
      balanced = this.ensurePsychologyBalance(balanced);
    }

    // Return top motivations up to target count
    return balanced.slice(0, targetCount);
  }

  private ensurePsychologyBalance(motivations: PsychologicalMotivation[]): PsychologicalMotivation[] {
    const balanced: PsychologicalMotivation[] = [];
    const typeGroups = this.groupByPsychologyType(motivations);
    const targetPerType = Math.floor(motivations.length / this.PSYCHOLOGY_TYPES.length);

    // Add balanced selection from each type
    this.PSYCHOLOGY_TYPES.forEach((type: any) => {
      const typeMotivations = typeGroups[type] || [];
      const topFromType = typeMotivations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, Math.max(1, targetPerType));
      balanced.push(...topFromType);
    });

    // Fill remaining slots with highest confidence
    const remaining = motivations.length - balanced.length;
    if (remaining > 0) {
      const remainingMotivations = motivations
        .filter((m: any) => !balanced.includes(m))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, remaining);
      balanced.push(...remainingMotivations);
    }

    return balanced;
  }

  private groupByPsychologyType(motivations: PsychologicalMotivation[]): Record<string, PsychologicalMotivation[]> {
    return motivations.reduce((groups, motivation) => {
      const type = motivation.psychologyType;
      if (!groups[type]) groups[type] = [];
      groups[type].push(motivation);
      return groups;
    }, {} as Record<string, PsychologicalMotivation[]>);
  }

  private calculateConfidenceScore(brief: ParsedBrief, motivation: PsychologicalMotivation): number {
    let score = motivation.confidence || 0.5;
    
    // Boost score based on brief alignment
    if (brief.targetAudience && motivation.targetSegment.toLowerCase().includes(brief.targetAudience.toLowerCase())) {
      score += 0.1;
    }
    
    if (brief.objective && motivation.keyMessage.toLowerCase().includes(brief.objective.toLowerCase())) {
      score += 0.1;
    }
    
    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  private calculateDiversityScore(motivation: PsychologicalMotivation, allMotivations: PsychologicalMotivation[]): number {
    // Calculate how different this motivation is from others
    const typeScore = allMotivations.filter((m: any) => m.psychologyType === motivation.psychologyType).length / allMotivations.length;
    const categoryScore = allMotivations.filter((m: any) => m.motivationCategory === motivation.motivationCategory).length / allMotivations.length;
    
    // Lower scores mean more diverse (fewer similar motivations)
    return 1 - ((typeScore + categoryScore) / 2);
  }

  private calculateMetadata(motivations: PsychologicalMotivation[]): MotivationSet['metadata'] {
    const psychologyDistribution = motivations.reduce((dist, m) => {
      dist[m.psychologyType] = (dist[m.psychologyType] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    const totalConfidence = motivations.reduce((sum, m) => sum + m.confidence, 0);
    const averageConfidence = totalConfidence / motivations.length;

    const uniqueSegments = [...new Set(motivations.map((m: any) => m.targetSegment))];
    const diversityScore = uniqueSegments.length / motivations.length;

    return {
      totalMotivations: motivations.length,
      diversityScore,
      averageConfidence,
      psychologyDistribution,
      targetCoverage: uniqueSegments
    };
  }

  // Public utility methods
  async validateMotivationSet(motivationSet: MotivationSet): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check motivation count
    if (motivationSet.motivations.length < 8) {
      issues.push('Insufficient motivation variety (minimum 8 recommended)');
    }

    // Check psychology type balance
    const typeDistribution = motivationSet.metadata.psychologyDistribution;
    const typeCount = Object.keys(typeDistribution).length;
    if (typeCount < 3) {
      suggestions.push('Consider adding more psychology type diversity');
    }

    // Check confidence levels
    const lowConfidenceCount = motivationSet.motivations.filter((m: any) => m.confidence < 0.6).length;
    if (lowConfidenceCount > 3) {
      suggestions.push('Some motivations have low confidence - consider regenerating');
    }

    // Check diversity score
    if (motivationSet.metadata.diversityScore < 0.7) {
      suggestions.push('Motivations could be more diverse - consider different target segments');
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }

  async refineMotivations(
    motivationSet: MotivationSet,
    refinements: {},
  enhanceConfidence?: boolean;
      increaseDiversity?: boolean;
      balancePsychology?: boolean;
      targetSegments?: string[];
    }
  ): Promise<MotivationSet> {
    const { enhanceConfidence, increaseDiversity, balancePsychology, targetSegments } = refinements;

    let refinedMotivations = [...motivationSet.motivations];

    // Apply refinements
    if (enhanceConfidence) {
      refinedMotivations = await this.enhanceMotivationConfidence(refinedMotivations);
    }

    if (increaseDiversity) {
      refinedMotivations = this.increaseDiversity(refinedMotivations);
    }

    if (balancePsychology) {
      refinedMotivations = this.ensurePsychologyBalance(refinedMotivations);
    }

    if (targetSegments) {
      refinedMotivations = await this.alignWithSegments(refinedMotivations, targetSegments);
    }

    return {
      ...motivationSet,
      motivations: refinedMotivations,
      version: motivationSet.version + 1,
      metadata: this.calculateMetadata(refinedMotivations)
    };
  }

  private async enhanceMotivationConfidence(motivations: PsychologicalMotivation[]): Promise<PsychologicalMotivation[]> {
    // Use AI to enhance low-confidence motivations
    const lowConfidence = motivations.filter((m: any) => m.confidence < 0.7);
    const enhanced = await Promise.all(
      lowConfidence.map(async (motivation) => {
        const enhancementPrompt = this.buildEnhancementPrompt(motivation);
        try {
          const response = await this.callAIService(enhancementPrompt);
          const enhanced = this.parseEnhancementResponse(response);
          return { ...motivation, ...enhanced, confidence: Math.min(motivation.confidence + 0.2, 1.0) };
        } catch (error: any) {
          logger.warn('Failed to enhance motivation', error);
          return motivation;
        }
      })
    );

    // Replace original motivations with enhanced versions
    return motivations.map((original: any) => 
      enhanced.find((e: any) => e.id === original.id) || original
    );
  }

  private increaseDiversity(motivations: PsychologicalMotivation[]): PsychologicalMotivation[] {
    // Remove similar motivations, keeping highest confidence
    const diverse: PsychologicalMotivation[] = [];
    const seen = new Set<string>();

    motivations
      .sort((a, b) => b.confidence - a.confidence)
      .forEach((motivation: any) => {
        const key = `${motivation.psychologyType}_${motivation.motivationCategory}`;
        if (!seen.has(key)) {
          diverse.push(motivation);
          seen.add(key);
        }
      });

    return diverse;
  }

  private async alignWithSegments(motivations: PsychologicalMotivation[], segments: string[]): Promise<PsychologicalMotivation[]> {
    // Adjust motivations to better align with specified target segments
    return motivations.map((motivation: any) => ({
      ...motivation,
      targetSegment: this.findBestSegmentMatch(motivation, segments)
    }));
  }

  private findBestSegmentMatch(motivation: PsychologicalMotivation, segments: string[]): string {
    // Simple matching - in real implementation would use more sophisticated matching
    const currentSegment = motivation.targetSegment.toLowerCase();
    const match = segments.find((segment: any) => 
      currentSegment.includes(segment.toLowerCase()) || 
      segment.toLowerCase().includes(currentSegment)
    );
    return match || motivation.targetSegment;
  }

  private buildEnhancementPrompt(motivation: PsychologicalMotivation): string {
    return `
Enhance this psychological motivation to make it more compelling and specific:

Current Motivation:
- Title: ${motivation.title}
- Description: ${motivation.description}
- Target: ${motivation.targetSegment}
- Key Message: ${motivation.keyMessage}

Provide enhanced versions that are:
1. More specific and actionable
2. Have stronger emotional triggers
3. Include more concrete examples
4. Are more compelling for the target segment

Respond in JSON format with enhanced fields.
`;
  }

  private parseEnhancementResponse(response: string): Partial<PsychologicalMotivation> {
    try {
      return JSON.parse(response);
    } catch (error: any) {
      logger.warn('Failed to parse enhancement response', error);
      return {};
    }
  }

  // Utility methods
  private sanitizeString(value: any): string {
    if (typeof value !== 'string') return '';
    return value.trim().substring(0, 500); // Limit length
  }

  private generateMotivationSetId(briefId: string): string {
    return `motset_${briefId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateMotivationId(index: number): string {
    return `mot_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private hashBrief(brief: ParsedBrief): string {
    const key = `${brief.product}_${brief.brand}_${brief.objective}`;
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
let motivationGeneratorInstance: MotivationGenerator | null = null;

export const getMotivationGenerator = (): MotivationGenerator => {
  if (!motivationGeneratorInstance) {
    motivationGeneratorInstance = new MotivationGenerator();
  }
  return motivationGeneratorInstance;
};

// Convenience functions
export const generateMotivations = (
  brief: ParsedBrief, 
  options?: MotivationGenerationOptions
): Promise<MotivationSet> => {
  return getMotivationGenerator().generateMotivations(brief, options);
};

export const validateMotivationSet = (
  motivationSet: MotivationSet
): Promise<ReturnType<MotivationGenerator['validateMotivationSet']>> => {
  return getMotivationGenerator().validateMotivationSet(motivationSet);
};

export const refineMotivations = (
  motivationSet: MotivationSet,
  refinements: Parameters<MotivationGenerator['refineMotivations']>[1]
): Promise<MotivationSet> => {
  return getMotivationGenerator().refineMotivations(motivationSet, refinements);
};