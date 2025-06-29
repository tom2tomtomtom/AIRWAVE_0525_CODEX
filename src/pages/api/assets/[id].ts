import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/middleware/withAuth';

type ResponseData = {
  success: boolean;
  message?: string;
  asset?: any;
};

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ success: false, message: 'Invalid asset ID' });
  }

  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      return getAsset(req, res, id as string, userId);
    case 'PUT':
      return updateAsset(req, res, id as string, userId);
    case 'DELETE':
      return deleteAsset(req, res, id as string, userId);
    default:
      return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

async function getAsset(
  _req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
  assetId: string,
  userId: string
) {
  try {
    const { data: asset, error } = await supabase!
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Asset not found' });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      asset: asset });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error fetching asset:', message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function updateAsset(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
  assetId: string,
  userId: string
) {
  try {
    const { name, url, thumbnail_url, description, tags, favorite } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString() };

    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (favorite !== undefined) updateData.favorite = favorite;

    const { data: asset, error } = await supabase!
      .from('assets')
      .update(updateData)
      .eq('id', assetId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Asset not found' });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      asset: asset });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error updating asset:', message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function deleteAsset(
  _req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
  assetId: string,
  userId: string
) {
  try {
    const { data: asset, error } = await supabase!
      .from('assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Asset not found' });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: 'Asset deleted successfully',
      asset: asset });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error deleting asset:', message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export default withAuth(handler);
