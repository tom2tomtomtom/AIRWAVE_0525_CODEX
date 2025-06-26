import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withAIRateLimit } from '@/lib/rate-limiter';
import { withCSRFProtection } from '@/lib/csrf';
import OpenAI from 'openai';
import { loggers } from '@/lib/logger';


interface Motivation {
  id: string;
  title: string;
  description: string;
  score: number;
  reasoning: string;
  targetEmotions: string[];
  platforms: string[];
}

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

interface CopyVariation {
  id: string;
  text: string;
  platform: string;
  motivation: string;
  wordCount: number;
  tone: string;
  cta: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get authenticated user from middleware
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
  const { motivations, briefData }: { motivations: Motivation[]; briefData: BriefData } = req.body;

  if (!motivations || !Array.isArray(motivations) || motivations.length === 0) {
    return res.status(400).json({ success: false, message: 'Selected motivations are required' });
  }

  if (motivations.length < 1) {
    return res.status(400).json({ success: false, message: 'At least 1 motivation is required' });
  }

  if (!briefData) {
    return res.status(400).json({ success: false, message: 'Brief data is required' });
  }

  // Debug logging to see what data we're receiving
  console.log('🔍 COPY API - Received data:', {
    motivationCount: motivations.length,
    motivationTitles: motivations.map((m: any) => m.title),
    briefTitle: briefData.title,
    briefObjective: briefData.objective?.substring(0, 100) + '...',
    briefProduct: briefData.product,
    briefValueProp: briefData.valueProposition?.substring(0, 100) + '...',
  });

  try {
    // Generate 5 copy variations per motivation (max 10 words each)
    const copyVariations = await generateCopyFromMotivations(motivations, briefData);

    return res.status(200).json({
      success: true,
      data: copyVariations,
      message: 'Copy variations generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating copy:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate copy',
    });
  }
}

async function generateCopyFromMotivations(
  motivations: Motivation[],
  briefData: BriefData
): Promise<CopyVariation[]> {
  // Start with template generation for fast response
  const templateCopy = generateCopyWithTemplates(motivations, briefData);

  // Try AI-powered generation if API key is available and we have time
  if (process.env.OPENAI_API_KEY && templateCopy.length < 9) {
    try {
      const aiCopy = await generateCopyWithAI(motivations, briefData);
      if (aiCopy && aiCopy.length > 0) {
        // Merge template and AI copy for best of both
        return [...templateCopy, ...aiCopy].slice(0, 15);
      }
    } catch (error: any) {
      console.warn('OpenAI copy generation failed, using templates:', error);
    }
  }

  return templateCopy;
}

async function generateCopyWithAI(
  motivations: Motivation[],
  briefData: BriefData
): Promise<CopyVariation[]> {
  const prompt = `You are an expert copywriter specializing in conversion-focused ad copy. Create compelling copy that bridges the specific motivations with the exact product/service and target audience from the brief.

CREATIVE BRIEF CONTEXT:
Title: ${briefData.title},
  Objective: ${briefData.objective}
Target Audience: ${briefData.targetAudience}
Key Messages: ${briefData.keyMessages.join(', ')},
  Platforms: ${briefData.platforms.join(', ')}
Product/Service: ${briefData.product || briefData.service || 'Not specified'}
Value Proposition: ${briefData.valueProposition || 'Not specified'},
  Industry: ${briefData.industry || 'Not specified'}

SELECTED MOTIVATIONS TO ADDRESS:
${motivations.map((m, i) => `${i + 1}. "${m.title}": ${m.description}\n   Target Emotions: ${m.targetEmotions.join(', ')}\n   Reasoning: ${m.reasoning}`).join('\n\n')}
,
  TASK: Generate 3 copy variations for EACH motivation that:
1. Directly address the specific motivation described
2. Relate to the exact product/service in the brief
3. Speak to the target audience using their language/concerns
4. Incorporate the value proposition naturally
5. Are optimized for the primary platform: ${briefData.platforms[0] || 'Meta'}

COPY REQUIREMENTS:
- Maximum 10 words per copy
- Must connect the MOTIVATION → PRODUCT/SERVICE → TARGET AUDIENCE
- Include emotional triggers from the motivation's targetEmotions
- Platform-appropriate tone and style
- Clear, compelling call-to-action

PLATFORM OPTIMIZATION (${briefData.platforms[0] || 'Meta'}):
- Meta/Facebook: Conversational, benefit-focused, community-oriented
- Instagram: Visual, trendy, lifestyle-focused, emoji-friendly
- LinkedIn: Professional, value-driven, results-oriented, B2B tone
- TikTok: Trendy, catchy, youth-oriented, action-focused
- YouTube: Educational, engaging, story-driven
- Pinterest: Aspirational, visual, lifestyle-focused

For each copy variation, provide:
- id: unique identifier (copy_motivation1_var1, etc.)
- text: the actual copy (max 10 words)
- platform: ${briefData.platforms[0] || 'Meta'}
- motivation: exact motivation title it addresses
- wordCount: number of words
- tone: tone that matches the motivation's target emotions
- cta: strong 2-3 word call-to-action

CRITICAL: Each copy must clearly connect the motivation to the specific product/service. Don't create generic copy - make it specific to this brief's context.

Respond with JSON array only.`;

  const response = await Promise.race([
    openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use faster model for copy generation
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000, // Reduce tokens for faster response
    }),
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error('OpenAI request timeout')), 20000) // Shorter timeout for Netlify compatibility
    ),
  ]);

  const responseText = (response as any).choices[0]?.message?.content?.trim();
  if (!responseText) {
    throw new Error('No response from OpenAI');
  }

  try {
    // Clean up markdown formatting that OpenAI sometimes adds
    let cleanedResponse = responseText;
    if (cleanedResponse.includes('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    }
    if (cleanedResponse.includes('```')) {
      cleanedResponse = cleanedResponse.replace(/```/g, '');
    }

    const copyVariations = JSON.parse(cleanedResponse);

    if (!Array.isArray(copyVariations)) {
      throw new Error('Response is not an array');
    }

    // Validate and format copy variations
    return copyVariations
      .map((copy, index) => ({
        id: copy.id || `copy_${index + 1}`,
        text: copy.text || 'AI-generated copy',
        platform: copy.platform || briefData.platforms[0] || 'Meta',
        motivation: copy.motivation || motivations[0]?.title || 'Unknown',
        wordCount: copy.wordCount || (copy.text ? copy.text.split(' ').length : 0),
        tone: copy.tone || 'engaging',
        cta: copy.cta || 'Learn more',
      }))
      .slice(0, 100); // Limit to reasonable number
  } catch (parseError: any) {
    console.error('Failed to parse OpenAI copy response:', parseError);
    throw new Error('Invalid JSON response from OpenAI');
  }
}

function generateCopyWithTemplates(
  motivations: Motivation[],
  briefData: BriefData
): CopyVariation[] {
  const copyVariations: CopyVariation[] = [];

  // Copy templates for different tones and styles
  const copyTemplates: Record<string, string[]> = {
    emotional: [
      'Transform your {goal} with {solution}',
      'Discover the {benefit} you deserve',
      'Experience {transformation} like never before',
      'Join thousands who found {success}',
      'Unlock your potential with {offering}',
    ],
    social_proof: [
      'Trusted by {number} satisfied customers',
      '{Testimonial} - Customer Success Story',
      'See why experts choose {brand}',
      'Join the {community} movement',
      '{Rating} stars from verified users',
    ],
    innovation: [
      'Revolutionary {solution} changes everything',
      'Next-generation {technology} is here',
      'Pioneering the future of {industry}',
      'Advanced {feature} delivers results',
      'Innovation meets {user_need} perfectly',
    ],
    community: [
      'Join our thriving {community} today',
      'Connect with like-minded {audience}',
      'Be part of something bigger',
      'Together we achieve more',
      'Your {community} awaits you',
    ],
    problem_solution: [
      'Solve {problem} in minutes',
      'End {pain_point} forever',
      'Finally, a solution that works',
      'Say goodbye to {frustration}',
      'The answer to {challenge}',
    ],
    aspirational: [
      'Live the {lifestyle} you deserve',
      'Achieve your {dream} today',
      'Step into your best self',
      'Make {aspiration} your reality',
      'Become the {ideal_self} you envision',
    ],
    urgency: [
      'Limited time: {offer} expires soon',
      "Act now before it's gone",
      'Last chance for {benefit}',
      'Only {number} spots remaining',
      'Hurry, {opportunity} ends today',
    ],
    authority: [
      'Expert-approved {solution} delivers results',
      'Industry leaders trust {brand}',
      'Proven {method} with {result}',
      'Professional-grade {quality} guaranteed',
      'Award-winning {service} since {year}',
    ],
    transformation: [
      'Transform {current_state} into {desired_state}',
      'From {before} to {after}',
      'Your {transformation} journey starts here',
      'Become the {new_you} today',
      'Change your {life_aspect} forever',
    ],
    value: [
      'Save {amount} with {solution}',
      'Get {benefit} for less',
      'Maximum value, minimum cost',
      'ROI guaranteed or money back',
      'Best {category} value available',
    ],
  };

  // Platform-specific adaptations
  const platformAdaptations: Record<
    string,
    { maxWords: number; style: string; emojis: boolean; hashtags: boolean }
  > = {
    Instagram: {
      maxWords: 8,
      style: 'visual',
      emojis: true,
      hashtags: true,
    },
    Facebook: {
      maxWords: 10,
      style: 'conversational',
      emojis: false,
      hashtags: false,
    },
    LinkedIn: {
      maxWords: 10,
      style: 'professional',
      emojis: false,
      hashtags: false,
    },
    Twitter: {
      maxWords: 6,
      style: 'concise',
      emojis: true,
      hashtags: true,
    },
    TikTok: {
      maxWords: 7,
      style: 'trendy',
      emojis: true,
      hashtags: true,
    },
  };

  // Generate copy for available motivations (at least 1, up to 3 for performance)
  const topMotivations = motivations.slice(0, Math.min(motivations.length, 3));
  const primaryPlatform = briefData.platforms[0] || 'Meta';

  topMotivations.forEach((motivation, motivationIndex) => {
    const motivationType = getMotivationType(motivation.title);
    const templates = copyTemplates[motivationType] || copyTemplates.emotional;
    const platformConfig = platformAdaptations[primaryPlatform] || platformAdaptations.Facebook;

    // Generate 3 variations per motivation for faster processing
    for (let i = 0; i < 3; i++) {
      const template = templates[i % templates.length];

      // Generate copy text based on template and brief data
      const copyText = generateCopyText(template, briefData, motivation, platformConfig);

      // Ensure word count is within limit (max 10 words)
      const words = copyText.split(' ');
      const finalText = words.slice(0, Math.min(words.length, 10)).join(' ');

      copyVariations.push({
        id: `copy_${motivationIndex}_${i}_${primaryPlatform.toLowerCase()}`,
        text: finalText,
        platform: primaryPlatform,
        motivation: motivation.title,
        wordCount: finalText.split(' ').length,
        tone: getToneFromMotivation(motivation.title),
        cta: generateCTA(motivation, primaryPlatform),
      });
    }
  });

  // Return shuffled variations to provide variety
  return shuffleArray(copyVariations);
}

function getMotivationType(motivationTitle: string): string {
  const typeMap = {
    'Emotional Connection': 'emotional',
    'Social Proof': 'social_proof',
    Innovation: 'innovation',
    'Community Building': 'community',
    'Problem Solution': 'problem_solution',
    'Aspirational Lifestyle': 'aspirational',
    'Urgency and Scarcity': 'urgency',
    'Authority and Expertise': 'authority',
    'Personal Transformation': 'transformation',
    'Value and ROI': 'value',
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (motivationTitle.includes(key.split(' ')[0])) {
      return value;
    }
  }

  return 'emotional';
}

function generateCopyText(
  template: string,
  briefData: BriefData,
  motivation: Motivation,
  platformConfig: any
): string {
  let text = template;

  // Replace placeholders with brief data
  const replacements = {
    '{goal}': extractGoal(briefData.objective),
    '{solution}': extractSolution(briefData.keyMessages),
    '{benefit}': extractBenefit(briefData.objective),
    '{transformation}': extractTransformation(briefData.objective),
    '{success}': 'success',
    '{offering}': extractOffering(briefData.title),
    '{brand}': extractBrand(briefData.title),
    '{community}': extractCommunity(briefData.targetAudience),
    '{audience}': briefData.targetAudience.split(' ').slice(0, 2).join(' '),
    '{problem}': extractProblem(briefData.objective),
    '{pain_point}': extractPainPoint(briefData.objective),
    '{challenge}': 'challenges',
    '{lifestyle}': extractLifestyle(briefData.targetAudience),
    '{dream}': extractDream(briefData.objective),
    '{aspiration}': extractAspiration(briefData.objective),
    '{number}': getRandomNumber(),
    '{offer}': extractOffer(briefData.objective),
    '{opportunity}': 'opportunity',
    '{method}': 'approach',
    '{result}': extractResult(briefData.objective),
    '{quality}': 'quality',
    '{service}': extractService(briefData.title),
    '{year}': '2020',
    '{current_state}': extractCurrentState(briefData.objective),
    '{desired_state}': extractDesiredState(briefData.objective),
    '{before}': 'ordinary',
    '{after}': 'extraordinary',
    '{new_you}': 'best version',
    '{life_aspect}': 'approach',
    '{amount}': '$' + getRandomNumber(),
    '{category}': extractCategory(briefData.title),
  };

  // Apply replacements
  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  // Add platform-specific elements
  if (platformConfig.emojis && Math.random() > 0.5) {
    text = addRelevantEmoji(text, motivation);
  }

  return text;
}

function getToneFromMotivation(motivationTitle: string): string {
  if (motivationTitle.includes('Emotional')) return 'warm';
  if (motivationTitle.includes('Social Proof')) return 'confident';
  if (motivationTitle.includes('Innovation')) return 'exciting';
  if (motivationTitle.includes('Community')) return 'inclusive';
  if (motivationTitle.includes('Problem')) return 'helpful';
  if (motivationTitle.includes('Aspirational')) return 'inspiring';
  if (motivationTitle.includes('Urgency')) return 'urgent';
  if (motivationTitle.includes('Authority')) return 'professional';
  if (motivationTitle.includes('Transformation')) return 'motivational';
  if (motivationTitle.includes('Value')) return 'practical';
  return 'friendly';
}

function generateCTA(motivation: Motivation, platform: string): string {
  const ctas: Record<string, string[]> = {
    emotional: ['Join us', 'Start now', 'Connect today'],
    social_proof: ['See why', 'Join thousands', 'Learn more'],
    innovation: ['Try now', 'Discover', 'Experience'],
    community: ['Join us', 'Be part', 'Connect'],
    problem_solution: ['Get started', 'Solve now', 'Try free'],
    aspirational: ['Start journey', 'Begin today', 'Transform now'],
    urgency: ['Act now', 'Hurry', 'Limited time'],
    authority: ['Learn more', 'Get expert', 'Discover'],
    transformation: ['Start today', 'Transform', 'Begin change'],
    value: ['Save now', 'Get deal', 'Compare'],
  };

  const motivationType = getMotivationType(motivation.title);
  const typeCTAs = ctas[motivationType] || ctas.emotional;

  return typeCTAs[Math.floor(Math.random() * typeCTAs.length)];
}

// Helper functions for extracting content from brief data
function extractGoal(objective: string): string {
  if (objective.includes('awareness')) return 'awareness goals';
  if (objective.includes('engagement')) return 'engagement';
  if (objective.includes('sales')) return 'sales targets';
  return 'business goals';
}

function extractSolution(keyMessages: string[]): string {
  return keyMessages[0]?.split(' ').slice(0, 2).join(' ') || 'our solution';
}

function extractBenefit(objective: string): string {
  if (objective.includes('increase')) return 'growth';
  if (objective.includes('drive')) return 'results';
  if (objective.includes('build')) return 'success';
  return 'benefits';
}

function extractTransformation(objective: string): string {
  return 'transformation';
}

function extractOffering(title: string): string {
  return title.split(' ').slice(0, 2).join(' ') || 'solution';
}

function extractBrand(title: string): string {
  return title.split(' ')[0] || 'us';
}

function extractCommunity(audience: string): string {
  return audience.split(' ').slice(0, 2).join(' ') || 'community';
}

function extractProblem(objective: string): string {
  return 'your challenges';
}

function extractPainPoint(objective: string): string {
  return 'frustrations';
}

function extractLifestyle(audience: string): string {
  return 'lifestyle';
}

function extractDream(objective: string): string {
  return 'dreams';
}

function extractAspiration(objective: string): string {
  return 'aspirations';
}

function getRandomNumber(): string {
  const numbers = ['1000', '5000', '10000', '50000'];
  return numbers[Math.floor(Math.random() * numbers.length)];
}

function extractOffer(objective: string): string {
  return 'special offer';
}

function extractService(title: string): string {
  return title.split(' ').slice(-1)[0] || 'service';
}

function extractCurrentState(objective: string): string {
  return 'current situation';
}

function extractDesiredState(objective: string): string {
  return 'ideal outcome';
}

function extractCategory(title: string): string {
  return title.split(' ').slice(-1)[0] || 'solution';
}

function extractResult(objective: string): string {
  return 'proven results';
}

function addRelevantEmoji(text: string, motivation: Motivation): string {
  const emojiMap = {
    Emotional: '❤️',
    Social: '👥',
    Innovation: '🚀',
    Community: '🤝',
    Problem: '✅',
    Aspirational: '⭐',
    Urgency: '⏰',
    Authority: '🏆',
    Transformation: '✨',
    Value: '💰',
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (motivation.title.includes(key)) {
      return `${emoji} ${text}`;
    }
  }

  return text;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Apply authentication, AI rate limiting, and CSRF protection for security
export default withAuth(withAIRateLimit(withCSRFProtection(handler)));
