import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withAIRateLimit } from '@/lib/rate-limiter';
import { withCSRFProtection } from '@/lib/csrf';
import OpenAI from 'openai';


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
  reasoning: string;
  targetEmotions: string[];
  platforms: string[];
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY });

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get authenticated user from middleware
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required' });
  }
  const { briefData }: { briefData: BriefData } = req.body;

  if (!briefData) {
    return res.status(400).json({ success: false, message: 'Brief data is required' });
  }

  // Debug logging to see what brief data we're receiving
  console.log('🔍 MOTIVATIONS API - Received brief data:', {
    title: briefData.title,
    objective: briefData.objective?.substring(0, 100) + '...',
    targetAudience: briefData.targetAudience?.substring(0, 100) + '...',
    keyMessages: briefData.keyMessages,
    platforms: briefData.platforms,
    product: briefData.product,
    service: briefData.service,
    valueProposition: briefData.valueProposition?.substring(0, 100) + '...',
    industry: briefData.industry });

  try {
    // Generate motivations based on brief analysis
    const motivations = await generateMotivationsFromBrief(briefData);

    return res.status(200).json({
      success: true,
      data: motivations,
      message: 'Motivations generated successfully' });
  } catch (error: any) {
    console.error('Error generating motivations:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate motivations' });
  }
}

async function generateMotivationsFromBrief(briefData: BriefData): Promise<Motivation[]> {
  // Try AI-powered generation first for better contextual motivations
  if (process.env.OPENAI_API_KEY) {
    try {
      const aiMotivations = await generateMotivationsWithAI(briefData);
      if (aiMotivations && aiMotivations.length > 0) {
        return aiMotivations;
      }
    } catch (error: any) {
      console.warn('OpenAI motivation generation failed, falling back to templates:', error);
    }
  }

  // Use template-based generation as fallback
  return generateMotivationsWithTemplates(briefData);
}

async function generateMotivationsWithAI(briefData: BriefData): Promise<Motivation[]> {
  const prompt = `You are an expert marketing strategist and consumer psychologist. Analyze this creative brief and generate 8-10 consumer motivations that are SPECIFICALLY tailored to the exact product/service, target audience, and objectives described. These motivations must be contextual and unique to this brief - NOT generic templates.

CREATIVE BRIEF ANALYSIS:
Title: ${briefData.title},
  Objective: ${briefData.objective}
Target Audience: ${briefData.targetAudience}
Key Messages: ${briefData.keyMessages.join(', ')},
  Platforms: ${briefData.platforms.join(', ')}
Product/Service: ${briefData.product || briefData.service || 'Not specified'}
Value Proposition: ${briefData.valueProposition || 'Not specified'},
  Industry: ${briefData.industry || 'Not specified'},
  Budget: ${briefData.budget || 'Not specified'},
  Timeline: ${briefData.timeline || 'Not specified'}
,
  TASK: Generate motivations that answer "What would make THIS specific target audience want to buy/engage with THIS specific product/service to achieve THIS specific objective?"

Each motivation must be:
1. SPECIFIC to the product/service mentioned in the brief
2. RELEVANT to the exact target audience described
3. ALIGNED with the stated campaign objective
4. ACTIONABLE for the platforms mentioned
5. DISTINCT from each other (no overlapping concepts)

Generate as JSON array with each motivation containing:
- id: "motivation_1", "motivation_2", etc.
- title: Specific motivation name (2-4 words, not generic)
- description: How this motivation drives the TARGET AUDIENCE to want the SPECIFIC PRODUCT/SERVICE (2-3 sentences)
- score: Relevance score 1-100 based on brief alignment
- reasoning: Why this motivation works for THIS specific campaign context (1-2 sentences)
- targetEmotions: 2-3 emotions this motivation triggers in the target audience
- platforms: Which platforms from the brief would work best for this motivation

EXAMPLES OF WHAT TO AVOID:
❌ Generic: "Social Proof" → ✅ Specific: "Peer Success Stories" (if brief mentions community/networking)
❌ Generic: "Fear of Missing Out" → ✅ Specific: "Career Advancement Urgency" (if brief is about professional development)
❌ Generic: "Emotional Connection" → ✅ Specific: "Family Security Assurance" (if brief mentions family protection)

Focus on psychological drivers that are unique to:
- The specific industry mentioned
- The exact target demographic described
- The particular product/service benefits
- The stated campaign goals
- The cultural context of the audience

Respond ONLY with the JSON array.`;

  const response = await Promise.race([
    openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use faster model for motivations
      messages: [
        {
          role: 'user',
          content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500, // Reduce tokens for faster response
    }),
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error('OpenAI request timeout')), 8000) // 8 second timeout for Netlify
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

    const motivations = JSON.parse(cleanedResponse);

    if (!Array.isArray(motivations)) {
      throw new Error('Response is not an array');
    }

    // Validate and format motivations
    return motivations
      .map((motivation, index) => ({
        id: motivation.id || `motivation_${index + 1}`,
        title: motivation.title || `Motivation ${index + 1}`,
        description: motivation.description || 'AI-generated motivation description',
        score: Math.min(100, Math.max(1, motivation.score || 75)),
        reasoning: motivation.reasoning || 'AI-generated reasoning',
        targetEmotions: Array.isArray(motivation.targetEmotions)
          ? motivation.targetEmotions
          : ['engagement'],
        platforms: Array.isArray(motivation.platforms) ? motivation.platforms : briefData.platforms }))
      .slice(0, 12); // Ensure max 12 motivations
  } catch (parseError: any) {
    console.error('Failed to parse OpenAI motivations response:', parseError);
    throw new Error('Invalid JSON response from OpenAI');
  }
}

async function generateMotivationsWithTemplates(briefData: BriefData): Promise<Motivation[]> {
  // Analyze brief content to generate relevant motivations
  const { objective, targetAudience, keyMessages, platforms } = briefData;

  // Base motivation templates with scoring logic
  const motivationTemplates = [
    {
      title: 'Emotional Connection',
      description:
        'Build deep emotional bonds through authentic storytelling and relatable experiences',
      reasoning: 'Emotional connections drive 70% more engagement than rational appeals',
      targetEmotions: ['trust', 'belonging', 'excitement'],
      baseScore: 85 },
    {
      title: 'Social Proof Validation',
      description: 'Leverage testimonials, reviews, and community endorsements for credibility',
      reasoning: 'Social proof increases conversion rates by up to 15%',
      targetEmotions: ['confidence', 'trust', 'security'],
      baseScore: 82 },
    {
      title: 'Innovation Leadership',
      description: 'Position as industry pioneer with cutting-edge solutions and forward-thinking',
      reasoning: 'Innovation messaging appeals to early adopters and tech-savvy audiences',
      targetEmotions: ['excitement', 'curiosity', 'pride'],
      baseScore: 78 },
    {
      title: 'Community Building',
      description: 'Foster sense of belonging and shared values within target community',
      reasoning: 'Community-driven content generates 6x more engagement',
      targetEmotions: ['belonging', 'pride', 'connection'],
      baseScore: 80 },
    {
      title: 'Problem Solution Focus',
      description: 'Address specific pain points with clear, actionable solutions',
      reasoning: 'Problem-solution messaging has 40% higher click-through rates',
      targetEmotions: ['relief', 'hope', 'confidence'],
      baseScore: 88 },
    {
      title: 'Aspirational Lifestyle',
      description: 'Present idealized future state that audience aspires to achieve',
      reasoning: 'Aspirational content drives 25% more shares and saves',
      targetEmotions: ['desire', 'motivation', 'optimism'],
      baseScore: 75 },
    {
      title: 'Urgency and Scarcity',
      description: 'Create time-sensitive opportunities and limited availability messaging',
      reasoning: 'Urgency tactics increase immediate action by 30%',
      targetEmotions: ['urgency', 'excitement', 'fear of missing out'],
      baseScore: 72 },
    {
      title: 'Authority and Expertise',
      description: 'Establish thought leadership through expert insights and industry knowledge',
      reasoning: 'Authority positioning increases trust and premium pricing acceptance',
      targetEmotions: ['respect', 'confidence', 'trust'],
      baseScore: 79 },
    {
      title: 'Personal Transformation',
      description: 'Focus on individual growth and positive life changes',
      reasoning: 'Transformation stories resonate with 85% of personal development audiences',
      targetEmotions: ['hope', 'determination', 'pride'],
      baseScore: 81 },
    {
      title: 'Value and ROI Emphasis',
      description: 'Highlight concrete benefits, savings, and return on investment',
      reasoning: 'ROI-focused messaging appeals to decision-makers and budget holders',
      targetEmotions: ['satisfaction', 'security', 'confidence'],
      baseScore: 86 },
    {
      title: 'Behind-the-Scenes Authenticity',
      description: 'Show genuine process, people, and company culture for transparency',
      reasoning: 'Authentic content builds 3x stronger brand loyalty',
      targetEmotions: ['trust', 'connection', 'appreciation'],
      baseScore: 77 },
    {
      title: 'Trend and Zeitgeist Alignment',
      description: 'Align messaging with current cultural movements and trending topics',
      reasoning: 'Trend-aligned content receives 50% more organic reach',
      targetEmotions: ['relevance', 'excitement', 'inclusion'],
      baseScore: 73 },
  ];

  // Score and select top 10 motivations based on brief analysis
  const scoredMotivations = motivationTemplates.map((template, index) => {
    let score = template.baseScore;

    // Adjust score based on brief content relevance

    // Check objective alignment
    if (objective.toLowerCase().includes('engagement')) {
      if (template.title.includes('Emotional') || template.title.includes('Community')) {
        score += 8;
      }
    }

    if (objective.toLowerCase().includes('awareness')) {
      if (template.title.includes('Social Proof') || template.title.includes('Authority')) {
        score += 6;
      }
    }

    if (
      objective.toLowerCase().includes('conversion') ||
      objective.toLowerCase().includes('sales')
    ) {
      if (template.title.includes('Problem Solution') || template.title.includes('Value')) {
        score += 10;
      }
    }

    // Check target audience alignment
    if (
      targetAudience.toLowerCase().includes('young') ||
      targetAudience.toLowerCase().includes('millennial')
    ) {
      if (template.title.includes('Innovation') || template.title.includes('Trend')) {
        score += 5;
      }
    }

    if (
      targetAudience.toLowerCase().includes('professional') ||
      targetAudience.toLowerCase().includes('business')
    ) {
      if (template.title.includes('Authority') || template.title.includes('Value')) {
        score += 7;
      }
    }

    // Check key messages alignment
    keyMessages.forEach((message: any) => {
      if (message.toLowerCase().includes('quality') && template.title.includes('Authority')) {
        score += 4;
      }
      if (message.toLowerCase().includes('innovation') && template.title.includes('Innovation')) {
        score += 6;
      }
      if (message.toLowerCase().includes('community') && template.title.includes('Community')) {
        score += 5;
      }
    });

    // Platform-specific adjustments
    if (platforms.includes('Instagram') || platforms.includes('TikTok')) {
      if (template.title.includes('Aspirational') || template.title.includes('Behind-the-Scenes')) {
        score += 3;
      }
    }

    if (platforms.includes('LinkedIn')) {
      if (template.title.includes('Authority') || template.title.includes('Value')) {
        score += 4;
      }
    }

    // Add some randomization to prevent identical results
    score += Math.random() * 5 - 2.5;

    return {
      id: `motivation_${index + 1}`,
      title: template.title,
      description: template.description,
      score: Math.round(Math.max(0, Math.min(100, score))),
      reasoning: template.reasoning,
      targetEmotions: template.targetEmotions,
      platforms: platforms };
  });

  // Sort by score and return top 10
  return scoredMotivations.sort((a, b) => b.score - a.score).slice(0, 10);
}

// Apply authentication, AI rate limiting, and CSRF protection for security
export default withAuth(withAIRateLimit(withCSRFProtection(handler)));
