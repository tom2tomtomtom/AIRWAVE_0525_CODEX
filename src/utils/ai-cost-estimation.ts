// src/utils/ai-cost-estimation.ts
// Token estimation utilities for AI cost control

interface BriefData {
  title: string;
  objective: string;
  targetAudience: string;
  keyMessages: string[];
  platforms: string[];
  budget: string;
  timeline: string;
  product?: string;
  service?: string;
  valueProposition?: string;
  brandGuidelines?: string;
  requirements?: string[];
  industry?: string;
  competitors?: string[];
}

interface Motivation {
  id: string;
  title: string;
  description: string;
  score: number;
  selected: boolean;
}

/**
 * Estimate tokens needed for motivation generation
 * Based on brief content length and complexity
 */
export function estimateTokensForMotivations(briefData: BriefData): number {
  const basePromptTokens = 500; // Base system prompt

  // Calculate input tokens based on brief content
  const briefText = [
    briefData.title,
    briefData.objective,
    briefData.targetAudience,
    briefData.valueProposition || '',
    briefData.brandGuidelines || '',
    ...(briefData.keyMessages || []),
    ...(briefData.requirements || []),
    ...(briefData.competitors || []),
  ].join(' ');

  const inputTokens = Math.ceil(briefText.length / 4); // Rough estimate: 4 chars per token

  // Expected output tokens (12 motivations with descriptions)
  const outputTokens = 1200; // ~100 tokens per motivation

  // Add 20% buffer for safety
  return Math.ceil((basePromptTokens + inputTokens + outputTokens) * 1.2);
}

/**
 * Estimate tokens needed for copy generation
 */
export function estimateTokensForCopy(
  motivations: Motivation[],
  briefData: BriefData,
  platforms: string[] = []
): number {
  const basePromptTokens = 600;

  // Input tokens from motivations and brief
  const motivationText = motivations
    .filter((m: any) => m.selected)
    .map((m: any) => `${m.title} ${m.description}`)
    .join(' ');

  const briefText = `${briefData.title} ${briefData.objective} ${briefData.targetAudience}`;
  const inputTokens = Math.ceil((motivationText + briefText).length / 4);

  // Output tokens: 3 copy variations per motivation per platform
  const selectedMotivations = motivations.filter((m: any) => m.selected).length;
  const targetPlatforms = platforms.length || briefData.platforms?.length || 3;
  const copyVariations = selectedMotivations * targetPlatforms * 3;
  const outputTokens = copyVariations * 50; // ~50 tokens per copy variation

  return Math.ceil((basePromptTokens + inputTokens + outputTokens) * 1.2);
}

/**
 * Estimate tokens for image generation prompts
 */
export function estimateTokensForImageGeneration(
  briefData: BriefData,
  _motivations: Motivation[],
  imageCount: number = 1
): number {
  const basePromptTokens = 200;

  // Enhanced prompt tokens based on brief and motivations
  const contextTokens = Math.ceil(
    (briefData.objective + briefData.valueProposition || '').length / 4
  );

  // DALL-E prompts are typically shorter but more descriptive
  const promptTokens = imageCount * 100; // ~100 tokens per image prompt

  return Math.ceil((basePromptTokens + contextTokens + promptTokens) * 1.1);
}

/**
 * Estimate tokens for brief parsing
 */
export function estimateTokensForBriefParsing(fileSize: number): number {
  // Rough estimation based on file size
  // PDF/Word files typically have ~2-3 chars per byte of actual text
  const estimatedTextLength = fileSize * 2;
  const inputTokens = Math.ceil(estimatedTextLength / 4);

  // System prompt for parsing
  const systemTokens = 800;

  // Expected structured output
  const outputTokens = 500;

  // Add buffer for complex documents
  return Math.ceil((systemTokens + inputTokens + outputTokens) * 1.3);
}

/**
 * Get cost estimate in dollars
 */
export function estimateCost(
  service: 'openai' | 'anthropic' | 'elevenlabs',
  model: string,
  tokens: number
): number {
  const costPerK: Record<string, Record<string, number>> = {
    openai: {
      'gpt-4': 0.06,
      'gpt-4o-mini': 0.002,
      'gpt-3.5-turbo': 0.002,
      'dall-e-3': 0.04,
    },
    anthropic: {
      'claude-3-opus': 0.06,
      'claude-3-sonnet': 0.012,
      'claude-3-haiku': 0.0008,
    },
    elevenlabs: {
      eleven_monolingual_v1: 0.3,
    },
  };

  const rate = costPerK[service]?.[model] || 0.01; // Default fallback
  return (tokens / 1000) * rate;
}

/**
 * Get recommended model based on budget constraints
 */
export function getRecommendedModel(
  service: 'openai' | 'anthropic',
  estimatedTokens: number,
  budgetRemaining: number,
  preferredModel: string
): {
  model: string;
  cost: number;
  reason: string;
} {
  const models = {
    openai: [
      { name: 'gpt-4', cost: 0.06, quality: 'highest' },
      { name: 'gpt-4o-mini', cost: 0.002, quality: 'high' },
      { name: 'gpt-3.5-turbo', cost: 0.002, quality: 'good' },
    ],
    anthropic: [
      { name: 'claude-3-opus', cost: 0.06, quality: 'highest' },
      { name: 'claude-3-sonnet', cost: 0.012, quality: 'high' },
      { name: 'claude-3-haiku', cost: 0.0008, quality: 'good' },
    ],
  };

  const serviceModels = models[service] || models.openai;

  // Try preferred model first
  const preferred = serviceModels.find((m: any) => m.name === preferredModel);
  if (preferred) {
    const cost = estimateCost(service, preferred.name, estimatedTokens);
    if (cost <= budgetRemaining) {
      return {
        model: preferred.name,
        cost,
        reason: 'Using preferred model within budget',
      };
    }
  }

  // Find most affordable model that fits budget
  for (const model of serviceModels.sort((a, b) => a.cost - b.cost)) {
    const cost = estimateCost(service, model.name, estimatedTokens);
    if (cost <= budgetRemaining) {
      return {
        model: model.name,
        cost,
        reason: preferred ? 'Downgraded to fit budget' : 'Best model within budget',
      };
    }
  }

  // If nothing fits, return cheapest with warning
  const cheapest = serviceModels[serviceModels.length - 1];
  if (!cheapest) {
    throw new Error(`No models available for service: ${service}`);
  }
  return {
    model: cheapest.name,
    cost: estimateCost(service, cheapest.name, estimatedTokens),
    reason: 'Budget exceeded - using cheapest model',
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(2)}¢`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Calculate daily burn rate and projection
 */
export function calculateBurnRate(
  monthlyUsage: number,
  daysElapsed: number
): {
  dailyRate: number;
  projectedMonthly: number;
  daysUntilBudgetExhausted: number;
  trend: 'increasing' | 'stable' | 'decreasing';
} {
  const dailyRate = monthlyUsage / daysElapsed;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projectedMonthly = dailyRate * daysInMonth;

  // Simple trend calculation (would be more sophisticated with historical data)
  const trend = 'stable'; // Placeholder - implement with historical data

  return {
    dailyRate,
    projectedMonthly,
    daysUntilBudgetExhausted: monthlyUsage > 0 ? Math.ceil(1000 / dailyRate) : Infinity, // Assuming $1000 budget
    trend,
  };
}
