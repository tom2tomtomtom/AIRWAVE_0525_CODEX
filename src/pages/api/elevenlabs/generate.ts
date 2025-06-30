import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/lib/auth';
import { withSecurityHeaders } from '@/lib/security';
import { loggers } from '@/lib/logger';

interface VoiceGenerationRequest {
  text: string;
  voice?: string;
  speed?: number;
  emotion?: string;
}

interface VoiceGenerationResponse {
  success: boolean;
  audioUrl?: string;
  audioData?: string; // base64 encoded audio
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoiceGenerationResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Check if ElevenLabs features are enabled
  const enableAI = process.env.ENABLE_AI_FEATURES === 'true';
  if (!enableAI) {
    return res.status(503).json({
      success: false,
      error: 'AI features are currently disabled',
    });
  }

  const {
    text,
    voice = 'professional-female',
    speed = 1.0,
    emotion = 'neutral',
  } = req.body as VoiceGenerationRequest;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Text is required for voice generation',
    });
  }

  if (text.length > 5000) {
    return res.status(400).json({
      success: false,
      error: 'Text is too long. Maximum 5000 characters allowed.',
    });
  }

  try {
    // Check if ElevenLabs API key is configured
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey || elevenLabsKey.includes('placeholder') || elevenLabsKey.includes('demo')) {
      loggers.general.warn('ElevenLabs API key not properly configured');
      return res.status(503).json({
        success: false,
        error: 'Voice generation service not configured. Please set up ElevenLabs API key.',
      });
    }

    // ElevenLabs API integration
    const voiceId = getVoiceId(voice);
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const elevenLabsResponse = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: emotion === 'confident' ? 0.8 : 0.5,
          speaking_rate: speed,
        },
      }),
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      loggers.general.error('ElevenLabs API error:', errorText);
      return res.status(500).json({
        success: false,
        error: 'Voice generation failed. Please try again.',
      });
    }

    // Get audio data
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    loggers.general.info(
      `Voice generated successfully. Text length: ${text.length}, Audio size: ${audioBuffer.byteLength} bytes`
    );

    return res.status(200).json({
      success: true,
      audioData: audioBase64,
      audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
    });
  } catch (error: any) {
    loggers.general.error('Voice generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during voice generation',
    });
  }
}

function getVoiceId(voiceName: string): string {
  // Map voice names to ElevenLabs voice IDs
  const voiceMap: Record<string, string> = {
    'professional-female': 'EXAVITQu4vr4xnSDxMaL', // Bella
    'professional-male': 'VR6AewLTigWG4xSOukaG', // Arnold
    'casual-female': 'ThT5KcBeYPX3keUQqHPh', // Dorothy
    'casual-male': 'ZQe5CZNOzWyzPSCn5a3c', // Bill
    confident: 'pNInz6obpgDQGcFmaJgB', // Adam
    friendly: 'Xb7hH8MSUJpSbSDYk0k2', // Alice
  };

  return voiceMap[voiceName] || voiceMap['professional-female'];
}

// Apply middleware
export default withSecurityHeaders(withAuth(handler));

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
