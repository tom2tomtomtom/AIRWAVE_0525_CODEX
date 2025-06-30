import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get environment variables
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasCreatomate = !!process.env.CREATOMATE_API_KEY;
    const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

    if (!hasOpenAI) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        environment: { hasOpenAI, hasCreatomate, hasElevenLabs },
      });
    }

    // Test OpenAI API call
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a video script writer. Create a 15-second video script for a product demo.',
        },
        {
          role: 'user',
          content: 'Create a script for TechFlow Pro headphones - emphasize 72-hour battery life',
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const script = completion.choices[0]?.message?.content || 'Error generating script';

    // Return success with generated content
    return res.status(200).json({
      success: true,
      message: 'Video generation API is working!',
      script: script,
      timestamp: new Date().toISOString(),
      environment: {
        hasOpenAI,
        hasCreatomate,
        hasElevenLabs,
        nodeEnv: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Video generation test error:', error);
    return res.status(500).json({
      error: 'Video generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
