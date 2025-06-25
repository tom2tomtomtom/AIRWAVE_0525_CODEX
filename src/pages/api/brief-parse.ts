import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { z } from 'zod';
import OpenAI from 'openai';

const BriefParseSchema = z.object({
  brief_id: z.string().uuid() });

async function extractTextFromFile(fileUrl: string): Promise<string> {
  try {
    // Get the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(env.STORAGE_BUCKET)
      .download(fileUrl);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Convert to buffer
    const buffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Determine file type and extract text
    if (fileUrl.toLowerCase().endsWith('.txt')) {
      // For TXT files, simply convert buffer to string
      return new TextDecoder('utf-8').decode(uint8Array);
    } else if (fileUrl.toLowerCase().endsWith('.pdf')) {
      // For PDF files, try to extract text using pdf-parse
      try {
        const pdf = require('pdf-parse');
        const data = await pdf(uint8Array);
        return data.text;
      } catch (pdfError: any) {
        console.error('PDF parsing error:', pdfError);
        throw new Error('Failed to parse PDF file. Please ensure it contains readable text.');
      }
    } else if (fileUrl.toLowerCase().endsWith('.docx')) {
      // For DOCX files, try to extract text using mammoth
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: uint8Array });
        return result.value;
      } catch (docxError: any) {
        console.error('DOCX parsing error:', docxError);
        throw new Error('Failed to parse DOCX file. Please ensure it contains readable text.');
      }
    } else {
      throw new Error('Unsupported file type. Please upload TXT, PDF, or DOCX files only.');
    }
  } catch (error: any) {
    console.error('Text extraction error:', error);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

async function aiParseBrief(text: string): Promise<string> {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY });

  // Call OpenAI to extract structured info
  const prompt = `Extract the following information from the campaign brief and return it as a valid JSON object:

Required fields:
- title: Brief title or campaign name
- objectives: Campaign objectives/goals  
- target_audience: Target audience description
- key_messages: Array of key messaging points
- platforms: Array of marketing platforms/channels
- budget: Budget information (if mentioned)
- timeline: Timeline/duration (if mentioned)  
- tone: Brand voice/tone (if mentioned)
- deliverables: Array of expected deliverables

Return ONLY the JSON object, no additional text or formatting.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert campaign strategist. Extract information from briefs and return it as valid JSON only.' },
      {
        role: 'user',
        content: `${prompt}\n\nBrief Content:\n${text}` },
    ],
    temperature: 0.1,
    max_tokens: 1000 });

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    throw new Error('No response from AI parsing');
  }

  // Validate that we got valid JSON
  try {
    JSON.parse(result);
    return result;
  } catch (parseError: any) {
    console.error('AI returned invalid JSON:', result);
    // Return a minimal valid JSON structure
    return JSON.stringify({
      title: 'Extracted Brief',
      objectives: text.substring(0, 200) + '...',
      target_audience: 'Please define target audience',
      key_messages: [],
      platforms: ['Instagram', 'Facebook'],
      budget: 'Not specified',
      timeline: 'Not specified',
      tone: 'Professional',
      deliverables: [],
      extraction_note: 'AI parsing returned invalid format, please review manually',
    });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const parseResult = BriefParseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
  }
  const { brief_id } = parseResult.data;
  const { data: brief, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', brief_id)
    .single();
  if (error || !brief) {
    return res.status(404).json({ success: false, message: 'Brief not found' });
  }
  try {
    const text = await extractTextFromFile(brief.file_url);
    const parsed = await aiParseBrief(text);
    // Save parsed data to DB
    const { data: updatedBrief, error: updateError } = await supabase
      .from('briefs')
      .update({ extracted_data: parsed, status: 'parsed' })
      .eq('id', brief_id)
      .select()
      .single();
    if (updateError) {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to update brief', error: updateError.message });
    }
    return res.status(200).json({ success: true, brief: updatedBrief });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
