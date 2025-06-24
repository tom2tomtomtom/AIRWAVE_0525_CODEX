import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { successResponse, errorResponse, handleApiError, methodNotAllowed, validateRequiredFields, ApiErrorCode } from '@/lib/api-response';
import { withFlowRateLimit } from '@/lib/rate-limiter';

interface CopyVariation {
  id: string;
  text: string;
  platform: string;
  motivation: string;
  wordCount: number;
  tone: string;
  cta: string;
}

interface StoreCopyRequest {
  selectedCopy: CopyVariation[];
  briefTitle: string;
  clientId: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = (req as any).user;
  const { selectedCopy, briefTitle, clientId }: StoreCopyRequest = req.body;

  // Validate required fields
  const missingFields = validateRequiredFields(req.body, ['selectedCopy', 'clientId']);
  if (missingFields.length > 0) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      `Missing required fields: ${missingFields.join(', ')}`,
      400
    );
  }

  if (!Array.isArray(selectedCopy) || selectedCopy.length === 0) {
    return errorResponse(
      res,
      ApiErrorCode.VALIDATION_ERROR,
      'Selected copy variations must be a non-empty array',
      400
    );
  }

  try {
        // Store each copy variation as a text asset
    const storedAssets = [];
    
    for (const copy of selectedCopy) {
      const assetData = {
        name: `Copy: ${copy.text.substring(0, 30)}${copy.text.length > 30 ? '...' : ''}`,
        type: 'text',
        url: '', // Text assets don't need URLs
        description: `Generated copy for ${copy.platform} - ${copy.motivation} motivation`,
        tags: [
          'copy',
          'generated',
          copy.platform.toLowerCase(),
          copy.motivation.toLowerCase().replace(/\s+/g, '_'),
          copy.tone,
          briefTitle.toLowerCase().replace(/\s+/g, '_')
        ],
        client_id: clientId,
        created_by: user.id,
        metadata: {},
        copyData: {},
  text: copy.text,
            platform: copy.platform,
            motivation: copy.motivation,
            wordCount: copy.wordCount,
            tone: copy.tone,
            cta: copy.cta,
            generatedFrom: 'flow_workflow',
            briefTitle: briefTitle },
  type: 'generated_copy',
          workflow_step: 'copy_generation'
        }
      };

      const { data: asset, error } = await supabase
        .from('assets')
        .insert(assetData)
        .select()
        .single();

      if (error) {
        console.error('Error storing copy asset:', error);
        throw new Error(`Failed to store copy: ${copy.text.substring(0, 20)}...`);
      }

      storedAssets.push({
        assetId: asset.id,
        copyId: copy.id,
        text: copy.text,
        platform: copy.platform
      });
    }

    return successResponse(res, {
      storedAssets,
      count: storedAssets.length,
      message: `${storedAssets.length} copy variations stored in assets library`
    }, 200);

  } catch (error: any) {
    return handleApiError(res, error, 'store-copy-assets');
  }
}

export default withAuth(withFlowRateLimit(handler));