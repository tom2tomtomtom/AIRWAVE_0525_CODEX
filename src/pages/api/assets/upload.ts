import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { withUploadRateLimit } from '@/lib/rate-limiter';

export const config = {
  api: {},
  bodyParser: false}};

interface UploadResponse {
  success: boolean;
  assets?: any[];
  error?: string;
  message?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const user = (req as any).user;
    const userId = user?.id;
    const clientId = req.headers['x-client-id'] as string || req.query.clientId as string;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

        // Parse the multipart form data with enhanced error handling
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      keepExtensions: true,
      multiples: true});

    let fields: any;
    let files: any;

    try {
      [fields, files] = await form.parse(req);
          } catch (parseError: any) {
      console.error('❌ Form parsing error:', parseError);
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to parse upload data' 
      });
    }

    // Handle both single and multiple files
    const fileArray = files.files ? (Array.isArray(files.files) ? files.files : [files.files]) : [];
    
    if (!fileArray.length || fileArray.every((f: any) => !f)) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

        const uploadedAssets = [];
    const errors = [];

    for (const [index, file] of fileArray.entries()) {
      if (!file || !file.filepath) {
        errors.push(`File ${index + 1}: Invalid file data`);
        continue;
      }

      try {
                // Validate file
        if (!file.originalFilename) {
          errors.push(`File ${index + 1}: File must have a name`);
          continue;
        }

        // Read file content
        const fileContent = fs.readFileSync(file.filepath);
                // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const ext = path.extname(file.originalFilename);
        const filename = `${timestamp}_${randomId}${ext}`;
        const storagePath = `${userId}/${filename}`;

        // Determine asset type from MIME type
        const mimeType = file.mimetype || 'application/octet-stream';
        let assetType = 'text'; // default
        
        if (mimeType.startsWith('image/')) {
          assetType = 'image';
        } else if (mimeType.startsWith('video/')) {
          assetType = 'video';
        } else if (mimeType.startsWith('audio/')) {
          assetType = 'voice';
        }

        console.log(`🏷️ Asset type determined: ${assetType} (${mimeType})`);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('assets')
          .upload(storagePath, fileContent, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Storage upload error:', uploadError);
          errors.push(`${file.originalFilename}: Upload failed - ${uploadError.message}`);
          continue;
        }

                // Get public URL
        const { data: urlData } = supabase.storage
          .from('assets')
          .getPublicUrl(storagePath);

        if (!urlData.publicUrl) {
          errors.push(`${file.originalFilename}: Failed to get public URL`);
          await supabase.storage.from('assets').remove([storagePath]);
          continue;
        }

                // Save asset metadata to database with proper field mapping
        const assetData = {
          name: file.originalFilename,
          type: assetType,
          file_url: urlData.publicUrl, // Use file_url to match database schema
          mime_type: mimeType,
          file_size: file.size,
          client_id: clientId || null,
          created_by: userId,
          metadata: {},
        original_filename: file.originalFilename,
            uploaded_at: new Date().toISOString(),
            storage_path: storagePath,
            upload_method: 'web_interface' },
  created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: assetRecord, error: dbError } = await supabase
          .from('assets')
          .insert(assetData)
          .select(`
            id,
            name,
            type,
            file_url,
            thumbnail_url,
            description,
            tags,
            client_id,
            created_by,
            metadata,
            file_size,
            mime_type,
            duration,
            dimensions,
            created_at
          `)
          .single();

        if (dbError) {
          console.error('❌ Database error:', dbError);
          errors.push(`${file.originalFilename}: Database save failed - ${dbError.message}`);
          await supabase.storage.from('assets').remove([storagePath]);
          continue;
        }

                // Map database record to frontend format
        const asset = {
          id: assetRecord.id,
          name: assetRecord.name,
          type: assetRecord.type,
          url: assetRecord.file_url, // Map file_url to url for frontend
          thumbnailUrl: assetRecord.thumbnail_url,
          description: assetRecord.description,
          tags: assetRecord.tags || [],
          dateCreated: assetRecord.created_at,
          clientId: assetRecord.client_id,
          userId: assetRecord.created_by,
          metadata: assetRecord.metadata,
          size: assetRecord.file_size,
          mimeType: assetRecord.mime_type,
          duration: assetRecord.duration,
          width: assetRecord.dimensions?.width,
          height: assetRecord.dimensions?.height};

        uploadedAssets.push(asset);
              } catch (fileError: any) {
        console.error(`❌ File processing error for ${file.originalFilename}:`, fileError);
        errors.push(`${file.originalFilename}: Processing failed - ${fileError instanceof Error ? fileError.message : String(fileError)}`);
      } finally {
        // Clean up temporary file
        try {
          if (file.filepath && fs.existsSync(file.filepath)) {
            fs.unlinkSync(file.filepath);
          }
        } catch (cleanupError: any) {
          console.warn('⚠️ Failed to clean up temp file:', cleanupError);
        }
      }
    }

    // Return results
    if (uploadedAssets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files were uploaded successfully',
        message: errors.join('; ')
      });
    }

    const response: UploadResponse = {
      success: true,
      assets: uploadedAssets
    };

    if (errors.length > 0) {
      response.message = `Some files failed to upload: ${errors.join('; ')}`;
    }

        return res.status(200).json(response);

  } catch (error: any) {
    console.error('❌ Upload handler error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during upload'
    });
  }
}

export default withSecurityHeaders(withAuth(withUploadRateLimit(handler)));
