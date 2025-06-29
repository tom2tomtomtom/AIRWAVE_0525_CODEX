import type { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import formidable from 'formidable';
import fs from 'fs/promises';
import { z } from 'zod';
import mammoth from 'mammoth';
import { PDFExtract } from 'pdf.js-extract';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Request schema
const BriefUploadSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
});

// Supported file types
const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  // Get user info from headers
  const userId = req.headers['x-user-id'] as string;

  try {
    // Parse form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);

    // Validate fields
    const validationResult = BriefUploadSchema.safeParse({
      client_id: fields.client_id?.[0],
      name: fields.name?.[0],
      description: fields.description?.[0],
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: validationResult.error.errors,
      });
    }

    const { client_id, name, description } = validationResult.data;

    // Get uploaded file
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Validate file type
    const fileType = SUPPORTED_TYPES[uploadedFile.mimetype as keyof typeof SUPPORTED_TYPES];

    if (!fileType) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.',
      });
    }

    // Read file content
    const fileContent = await fs.readFile(uploadedFile.filepath);

    // Extract text based on file type
    let extractedText = '';

    switch (fileType) {
      case 'txt':
        extractedText = fileContent.toString('utf-8');
        break;

      case 'docx': {
        const docxResult = await mammoth.extractRawText({ buffer: fileContent });
        extractedText = docxResult.value;
        break;
      }

      case 'pdf': {
        const pdfExtract = new PDFExtract();
        const pdfData = await new Promise<any>((resolve, reject) => {
          pdfExtract.extract(uploadedFile.filepath, {}, (err: any, data: any) => {
            if (err) reject(err);
            else resolve(data);
          });
        });

        extractedText = pdfData.pages
          .map((page: any) => page.content.map((item: any) => item.str).join(' '))
          .join('\n');
        break;
      }
    }

    // Upload file to Supabase storage
    const fileName = `${Date.now()}-${uploadedFile.originalFilename}`;
    const { data: _uploadData, error: uploadError } = await supabase!.storage
      .from('briefs')
      .upload(`${client_id}/${fileName}`, fileContent, {
        contentType: uploadedFile.mimetype || 'application/octet-stream',
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file',
      });
    }

    // Get public URL
    const { data: urlData } = supabase!.storage
      .from('briefs')
      .getPublicUrl(`${client_id}/${fileName}`);

    // Create brief record
    const { data: brief, error: briefError } = await supabase!
      .from('briefs')
      .insert({
        client_id,
        name,
        description,
        document_url: urlData.publicUrl,
        document_type: fileType,
        raw_content: extractedText.substring(0, 50000), // Limit to 50k chars
        parsing_status: 'pending',
        created_by: userId,
      })
      .select()
      .single();

    if (briefError) {
      console.error('Brief creation error:', briefError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create brief record',
      });
    }

    // Trigger AI parsing in the background
    // We'll return immediately and parse asynchronously
    parseBriefAsync(brief.id, extractedText);

    return res.status(200).json({
      success: true,
      message: 'Brief uploaded successfully. AI parsing in progress.',
      brief: {
        id: brief.id,
        name: brief.name,
        document_url: brief.document_url,
        parsing_status: brief.parsing_status,
      },
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Brief upload error:', message, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload brief',
    });
  }
}

// Async function to parse brief with AI
async function parseBriefAsync(briefId: string, content: string): Promise<void> {
  try {
    // Make API call to parse endpoint
    await fetch(`${env.NEXT_PUBLIC_API_URL}/api/briefs/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brief_id: briefId,
        content,
      }),
    });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Failed to trigger parsing:', message, error);
  }
}
