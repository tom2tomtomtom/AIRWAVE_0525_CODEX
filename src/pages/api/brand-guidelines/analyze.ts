import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { env, hasOpenAI } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import mammoth from 'mammoth';

// Temporarily disabled - type issues with pdf-parse
// import pdf from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface BrandGuidelines {
  colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
  };
  toneOfVoice: {
    personality: string[];
    communication_style: string;
    dos: string[];
    donts: string[];
  };
  typography: {
    primary_font: string;
    secondary_font: string;
    font_weights: string[];
  };
  logoGuidelines?: {
    usage_rules: string[];
    spacing: string;
    variations: string[];
  };
  imagery?: {
    style: string;
    guidelines: string[];
  };
}

interface AnalysisResponse {
  success: boolean;
  guidelines?: BrandGuidelines;
  clientId?: string;
  error?: string;
}

// Initialize OpenAI client
const openai = hasOpenAI
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

async function extractTextFromFile(file: formidable.File): Promise<string> {
  const buffer = await fs.readFile(file.filepath);

  if (file.mimetype === 'application/pdf') {
    // PDF parsing temporarily disabled due to type issues
    throw new Error('PDF parsing is temporarily unavailable. Please upload DOCX or TXT files.');
    // const data = await pdf(buffer);
    // return data.text;
  } else if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (file.mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  } else {
    throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT files.');
  }
}

async function analyzeBrandGuidelines(text: string): Promise<BrandGuidelines> {
  if (!openai) {
    throw new Error(
      'OpenAI service not configured. Please set OPENAI_API_KEY environment variable.'
    );
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a brand analysis expert. Analyze the provided brand guidelines document and extract key information in a structured JSON format. Extract:
          
          1. Colors (hex codes if mentioned, or color names)
          2. Tone of voice and communication style
          3. Typography/fonts
          4. Logo usage guidelines
          5. Imagery style guidelines
          
          Return ONLY a valid JSON object with this structure:
          {
            "colors": {
              "primary": ["#color1", "#color2"],
              "secondary": ["#color3"],
              "accent": ["#color4"]
            },
            "toneOfVoice": {
              "personality": ["trait1", "trait2"],
              "communication_style": "description",
              "dos": ["guideline1", "guideline2"],
              "donts": ["avoid1", "avoid2"]
            },
            "typography": {
              "primary_font": "font name",
              "secondary_font": "font name",
              "font_weights": ["weight1", "weight2"]
            },
            "logoGuidelines": {
              "usage_rules": ["rule1", "rule2"],
              "spacing": "spacing info",
              "variations": ["variation1", "variation2"]
            },
            "imagery": {
              "style": "style description",
              "guidelines": ["guideline1", "guideline2"]
            }
          }`,
        },
        {
          role: 'user',
          content: `Analyze this brand guidelines document and extract the key brand elements:\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse the JSON response
    try {
      return JSON.parse(content);
    } catch (parseError: any) {
      console.error('Failed to parse OpenAI response as JSON:', content);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  } catch (error: any) {
    console.error('OpenAI analysis error:', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Get client ID from headers or query
    const clientId = (req.headers['x-client-id'] as string) || (req.query.clientId as string);

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Client ID is required' });
    }

    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      maxFiles: 1,
    });

    const [_fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Extract text from document
    const documentText = await extractTextFromFile(file);

    if (!documentText || documentText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        error: 'Document appears to be empty or too short for analysis',
      });
    }

    // Analyze the document with AI
    const guidelines = await analyzeBrandGuidelines(documentText);

    // Save guidelines to client profile
    const { error: updateError } = await supabase!
      .from('clients')
      .update({
        brand_guidelines: guidelines,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Error saving brand guidelines:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save brand guidelines to client profile',
      });
    }

    // Clean up temporary file
    try {
      await fs.unlink(file.filepath);
    } catch (cleanupError: any) {
      console.warn('Failed to cleanup temp file:', cleanupError);
    }

    return res.status(200).json({
      success: true,
      guidelines,
      clientId,
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Brand guidelines analysis error:', error);
    return res.status(500).json({
      success: false,
      error: message || 'Failed to analyze brand guidelines',
    });
  }
}
