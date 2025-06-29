import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/middleware/withAuth';

type Generation = {
  id: string;
  type: 'copy' | 'image' | 'video' | 'voice';
  content: string;
  prompt: string;
  dateCreated: string;
  clientId: string;
  userId: string;
  favorite?: boolean;
};

type ResponseData = {
  success: boolean;
  message?: string;
  generations?: Generation[];
};

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { clientId } = req.query;

    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Database connection error' });
    }

    let query = supabase
      .from('generated_content')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (clientId && typeof clientId === 'string') {
      query = query.eq('client_id', clientId);
    }

    const { data: generations, error } = await query;

    if (error) {
      throw error;
    }

    const formattedGenerations: Generation[] = (generations || []).map((gen: any) => ({
      id: gen.id,
      type: gen.type,
      content: gen.content,
      prompt: gen.prompt,
      dateCreated: gen.created_at,
      clientId: gen.client_id,
      userId: gen.user_id,
      favorite: gen.favorite || false }));

    return res.status(200).json({
      success: true,
      generations: formattedGenerations });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error fetching generations:', message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch generations' });
  }
}

export default withAuth(handler);
