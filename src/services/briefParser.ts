import { getLogger } from '@/lib/logger';
import { classifyError } from '@/lib/error-handling/error-classifier';
import { cached, CacheProfiles } from '@/lib/cache/redis-cache';

const logger = getLogger('brief-parser');

export interface ParsedBrief {
  id: string;
  product: string;
  brand: string;
  objective: string;
  keyProposition: string;
  coreReasonToBuy: string;
  targetAudience?: string;
  platforms?: string[];
  budget?: string;
  timeline?: string;
  rawContent: string;
  extractedSections: Record<string, string>;
  confidence: number;
  metadata: {
    fileType: string;
    wordCount: number;
    extractedAt: Date;
    source: 'upload' | 'manual' | 'api';
  };
}

export interface BriefExtractionOptions {
  enhanceWithAI?: boolean;
  validateRequiredFields?: boolean;
  confidenceThreshold?: number;
}

export class BriefParser {
  private readonly REQUIRED_FIELDS = [
    'product',
    'brand',
    'objective',
    'keyProposition',
    'coreReasonToBuy',
  ];

  async parse(file: File, options: BriefExtractionOptions = {}): Promise<ParsedBrief> {
    const {
      enhanceWithAI = true,
      validateRequiredFields = true,
      confidenceThreshold = 0.7,
    } = options;

    try {
      logger.info(
        'Starting brief parsing: ' + file.name + ', size: ' + file.size + ', type: ' + file.type
      );

      // 1. Extract text from file
      const extractedText = await this.extractText(file);

      // 2. Parse with AI if enabled
      let parsed: Partial<ParsedBrief>;
      if (enhanceWithAI) {
        parsed = await this.aiExtract(extractedText);
      } else {
        parsed = await this.basicExtract(extractedText);
      }

      // 3. Validate and enhance
      const briefData: ParsedBrief = {
        id: this.generateBriefId(),
        product: parsed.product || '',
        brand: parsed.brand || '',
        objective: parsed.objective || '',
        keyProposition: parsed.keyProposition || '',
        coreReasonToBuy: parsed.coreReasonToBuy || '',
        ...(parsed.targetAudience && { targetAudience: parsed.targetAudience }),
        platforms: parsed.platforms || [],
        ...(parsed.budget && { budget: parsed.budget }),
        ...(parsed.timeline && { timeline: parsed.timeline }),
        rawContent: extractedText,
        extractedSections: parsed.extractedSections || {},
        confidence: parsed.confidence || 0,
        metadata: {
          fileType: file.type,
          wordCount: extractedText.split(/\s+/).length,
          extractedAt: new Date(),
          source: 'upload',
        },
      };

      // 4. Validate if required
      if (validateRequiredFields) {
        this.validateBrief(briefData, confidenceThreshold);
      }

      logger.info('Brief parsing completed', {
        briefId: briefData.id,
        confidence: briefData.confidence,
        wordCount: briefData.metadata.wordCount,
        fieldsExtracted: Object.keys(briefData.extractedSections).length,
      });

      return briefData;
    } catch (error: any) {
      const classified = classifyError(error as Error, {
        action: 'brief-parser',
        metadata: { fileName: file.name, fileSize: file.size },
      } as any);

      logger.error('Brief parsing failed', classified.originalError);
      throw error;
    }
  }

  private async extractText(file: File): Promise<string> {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
      if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        return await this.extractFromText(file);
      } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return await this.extractFromPDF(file);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
      ) {
        return await this.extractFromDocx(file);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error: any) {
      logger.error('Text extraction failed', error);
      throw new Error(`Failed to extract text from ${fileType}: ${error}`);
    }
  }

  private async extractFromText(file: File): Promise<string> {
    return await file.text();
  }

  private async extractFromPDF(file: File): Promise<string> {
    // In a real implementation, you'd use a PDF parsing library like pdf-parse
    // For now, we'll use a placeholder
    await file.arrayBuffer();

    try {
      // This would use pdf-parse or similar library
      // const pdf = await pdfParse(buffer);
      // return pdf.text;

      // Placeholder implementation
      throw new Error('PDF parsing not yet implemented. Please convert to text or DOCX format.');
    } catch (error: any) {
      throw new Error(`PDF extraction failed: ${error}`);
    }
  }

  private async extractFromDocx(file: File): Promise<string> {
    // In a real implementation, you'd use a library like mammoth
    await file.arrayBuffer();

    try {
      // This would use mammoth or similar library
      // const result = await mammoth.extractRawText({ buffer });
      // return result.value;

      // Placeholder implementation
      throw new Error('DOCX parsing not yet implemented. Please convert to text format.');
    } catch (error: any) {
      throw new Error(`DOCX extraction failed: ${error}`);
    }
  }

  private async aiExtract(text: string): Promise<Partial<ParsedBrief>> {
    const cacheKey = `brief_extract_${this.hashText(text)}`;

    return cached(
      async () => {
        const prompt = this.buildExtractionPrompt(text);

        // This would integrate with your AI service (OpenAI, Anthropic, etc.)
        const response = await this.callAIService(prompt);

        return this.parseAIResponse(response);
      },
      () => cacheKey,
      CacheProfiles.AI_GENERATION
    )();
  }

  private buildExtractionPrompt(text: string): string {
    return `
You are an expert marketing strategist analyzing a creative brief. Extract the following key information from this brief:

1. **Product/Service**: The main product or service being advertised
2. **Brand**: The brand or company name
3. **Campaign Objective**: What the campaign aims to achieve
4. **Key Value Proposition**: The main benefit or unique selling point
5. **Core Reason to Buy**: The fundamental driver for purchase/engagement
6. **Target Audience**: Who the campaign is targeting (demographics, psychographics)
7. **Platforms**: Which channels/platforms mentioned (social media, TV, digital, etc.)
8. **Budget**: Any budget information mentioned
9. **Timeline**: Any dates or timeline information

Brief content:
"""
${text}
"""

Respond in JSON format with high confidence scores (0-1) for each extracted field:

{
  "product": "extracted product name",
  "brand": "extracted brand name", 
  "objective": "extracted campaign objective",
  "keyProposition": "extracted value proposition",
  "coreReasonToBuy": "extracted reason to buy",
  "targetAudience": "extracted target audience",
  "platforms": ["platform1", "platform2"],
  "budget": "extracted budget info",
  "timeline": "extracted timeline",
  "extractedSections": {
    "background": "relevant background section",
    "target": "target audience section",
    "strategy": "strategy section"
  },
  "confidence": 0.85
}

If information is not clearly stated, use null for that field. Be accurate and don't hallucinate information.
    `;
  }

  private async callAIService(_prompt: string): Promise<string> {
    // Placeholder for AI service integration
    // This would integrate with OpenAI, Anthropic, or your preferred AI service

    // For now, return a mock response for development
    return JSON.stringify({
      product: 'Example Product',
      brand: 'Example Brand',
      objective: 'Increase brand awareness and drive sales',
      keyProposition: 'Revolutionary solution that saves time',
      coreReasonToBuy: 'Exclusive benefits for early adopters',
      targetAudience: 'Tech-savvy professionals aged 25-45',
      platforms: ['social media', 'digital'],
      budget: null,
      timeline: null,
      extractedSections: {
        background: 'Company background information',
        target: 'Target audience details',
        strategy: 'Strategic approach',
      },
      confidence: 0.8,
    });
  }

  private parseAIResponse(response: string): Partial<ParsedBrief> {
    try {
      const parsed = JSON.parse(response);

      // Validate the response structure
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid AI response format');
      }

      return {
        product: this.sanitizeString(parsed.product),
        brand: this.sanitizeString(parsed.brand),
        objective: this.sanitizeString(parsed.objective),
        keyProposition: this.sanitizeString(parsed.keyProposition),
        coreReasonToBuy: this.sanitizeString(parsed.coreReasonToBuy),
        targetAudience: this.sanitizeString(parsed.targetAudience),
        platforms: Array.isArray(parsed.platforms)
          ? parsed.platforms.map((p: any) => this.sanitizeString(p)).filter(Boolean)
          : [],
        budget: this.sanitizeString(parsed.budget),
        timeline: this.sanitizeString(parsed.timeline),
        extractedSections: parsed.extractedSections || {},
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      };
    } catch (error: any) {
      logger.error('Failed to parse AI response', error);
      throw new Error('Invalid AI response format');
    }
  }

  private async basicExtract(text: string): Promise<Partial<ParsedBrief>> {
    // Basic keyword-based extraction as fallback
    const sections = this.extractSections(text);

    return {
      product: this.extractByKeywords(text, ['product', 'service', 'offering']),
      brand: this.extractByKeywords(text, ['brand', 'company', 'client']),
      objective: this.extractByKeywords(text, ['objective', 'goal', 'aim', 'target']),
      keyProposition: this.extractByKeywords(text, ['proposition', 'benefit', 'advantage']),
      coreReasonToBuy: this.extractByKeywords(text, ['reason', 'why', 'motivation']),
      extractedSections: sections,
      confidence: 0.4, // Lower confidence for basic extraction
    };
  }

  private extractSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = text.split('\n');

    let currentSection = '';
    let currentContent: string[] = [];

    const sectionHeaders = [
      'background',
      'objective',
      'target',
      'strategy',
      'brief',
      'context',
      'audience',
      'goals',
    ];

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      // Check if line is a section header
      const matchedHeader = sectionHeaders.find(
        (header: any) => trimmed.includes(header) && trimmed.length < 50
      );

      if (matchedHeader) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }

        // Start new section
        currentSection = matchedHeader;
        currentContent = [];
      } else if (currentSection && line.trim()) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private extractByKeywords(text: string, keywords: string[]): string {
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (keywords.some(keyword => lowerSentence.includes(keyword))) {
        return sentence.trim();
      }
    }

    return '';
  }

  private validateBrief(brief: ParsedBrief, threshold: number): void {
    const missing: string[] = [];

    for (const field of this.REQUIRED_FIELDS) {
      const value = brief[field as keyof ParsedBrief];
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (brief.confidence < threshold) {
      throw new Error(
        `Extraction confidence (${brief.confidence}) below threshold (${threshold}). ` +
          'Please review and manually input missing information.'
      );
    }
  }

  private sanitizeString(value: any): string {
    if (typeof value !== 'string') return '';
    return value.trim().substring(0, 1000); // Limit length
  }

  private generateBriefId(): string {
    return `brief_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private hashText(text: string): string {
    // Simple hash for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Public utility methods
  async validateParsedBrief(brief: ParsedBrief): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check field completeness
    for (const field of this.REQUIRED_FIELDS) {
      const value = brief[field as keyof ParsedBrief] as string;
      if (!value || value.trim().length < 10) {
        issues.push(`${field} needs more detail (minimum 10 characters)`);
      }
    }

    // Check for specific content quality
    if (brief.objective && !brief.objective.toLowerCase().includes('objective')) {
      if (brief.objective.length < 20) {
        suggestions.push('Consider expanding the campaign objective with more specific goals');
      }
    }

    if (brief.keyProposition && brief.keyProposition.length < 15) {
      suggestions.push('Key proposition could be more detailed and compelling');
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  async enhanceBrief(brief: ParsedBrief): Promise<ParsedBrief> {
    // Use AI to enhance/expand brief fields that are too short or generic
    const enhancements = await this.generateEnhancements(brief);

    return {
      ...brief,
      ...enhancements,
      metadata: {
        ...brief.metadata,
        enhanced: true,
        enhancedAt: new Date(),
      } as any,
    };
  }

  private async generateEnhancements(brief: ParsedBrief): Promise<Partial<ParsedBrief>> {
    const prompt = `
Enhance this creative brief by expanding and improving the following fields. Keep the core meaning but make them more strategic and actionable:

Current brief:
- Product: ${brief.product}
- Brand: ${brief.brand}
- Objective: ${brief.objective}
- Key Proposition: ${brief.keyProposition}
- Core Reason to Buy: ${brief.coreReasonToBuy}

Provide enhanced versions that are:
1. More specific and actionable
2. Include relevant marketing terminology
3. Are suitable for creative development
4. Maintain the original intent

Respond in JSON format with only the enhanced fields that need improvement.
    `;

    try {
      const response = await this.callAIService(prompt);
      return this.parseAIResponse(response);
    } catch (error: any) {
      logger.warn('Brief enhancement failed, returning original', error);
      return {};
    }
  }
}

// Singleton instance
let briefParserInstance: BriefParser | null = null;

export const getBriefParser = (): BriefParser => {
  if (!briefParserInstance) {
    briefParserInstance = new BriefParser();
  }
  return briefParserInstance;
};

// Convenience functions
export const parseBrief = (file: File, options?: BriefExtractionOptions): Promise<ParsedBrief> => {
  return getBriefParser().parse(file, options);
};

export const validateBrief = (brief: ParsedBrief) => {
  return getBriefParser().validateParsedBrief(brief);
};
