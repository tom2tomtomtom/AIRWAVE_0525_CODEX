import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { id } = req.query;
  const user = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Brief ID is required' });
  }

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // First verify user has access to this brief and get its data
    const { data: brief, error } = await supabase
      .from('briefs')
      .select(`
        id,
        name,
        raw_content,
        document_url,
        client_id,
        parsing_status
      `)
      .eq('id', id)
      .single();

    if (error || !brief) {
      return res.status(404).json({ error: 'Brief not found' });
    }

    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', brief.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this brief' });
    }

    // Check if brief has content to reparse
    if (!brief.raw_content && !brief.document_url) {
      return res.status(400).json({ 
        error: 'No content available to reparse',
        details: 'Brief must have raw_content or document_url to be reparsed'
      });
    }

    // Check if already processing
    if (brief.parsing_status === 'processing') {
      return res.status(409).json({ 
        error: 'Brief is already being processed',
        details: 'Please wait for current parsing to complete'
      });
    }

    // Update status to processing
    const { error: updateError } = await supabase
      .from('briefs')
      .update({
        parsing_status: 'processing',
        parsed_at: null,
        confidence_scores: null,
        updated_at: new Date().toISOString()})
      .eq('id', id);

    if (updateError) {
      console.error('Error updating brief status:', updateError);
      return res.status(500).json({ error: 'Failed to update brief status' });
    }

    // Get content to parse - prefer raw_content over document_url
    let contentToparse = brief.raw_content;
    
    if (!contentToparse && brief.document_url) {
      // If no raw content but has document URL, we'll need to re-extract
      try {
        const parseResponse = await fetch(`${req.headers.origin}/api/brief-upload`, {
          method: 'POST',
          headers: {},
        'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || ''
      },
          body: JSON.stringify({
            document_url: brief.document_url,
            reparse: true,
            brief_id: id})});

        if (!parseResponse.ok) {
          throw new Error('Failed to re-extract document content');
        }

        const parseData = await parseResponse.json();
        contentToparse = parseData.raw_content;
      } catch (extractError: any) {
        console.error('Error re-extracting document:', extractError);
        
        // Revert status on error
        await supabase
          .from('briefs')
          .update({
            parsing_status: 'error',
            updated_at: new Date().toISOString()})
          .eq('id', id);

        return res.status(500).json({ 
          error: 'Failed to extract document content for reparsing',
          details: extractError instanceof Error ? extractError.message : String(extractError)
        });
      }
    }

    // Trigger the parsing process
    try {
      const parseResponse = await fetch(`${req.headers.origin}/api/brief-parse`, {
        method: 'POST',
        headers: {},
        'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
      },
        body: JSON.stringify({
          brief_id: id,
          content: contentToparse,
          reparse: true})});

      if (!parseResponse.ok) {
        throw new Error('Failed to trigger brief parsing');
      }

      return res.json({
        message: 'Brief reparsing initiated successfully',
        data: {},
  brief_id: id,
          name: brief.name,
          status: 'processing',
          estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes estimate
        }
      });

    } catch (parseError: any) {
      console.error('Error triggering brief parsing:', parseError);
      
      // Revert status on error
      await supabase
        .from('briefs')
        .update({
          parsing_status: 'error',
          updated_at: new Date().toISOString()})
        .eq('id', id);

      return res.status(500).json({ 
        error: 'Failed to initiate brief reparsing',
        details: parseError instanceof Error ? parseError.message : String(parseError)
      });
    }

  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Brief reparse API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}

export default withAuth(withSecurityHeaders(handler));