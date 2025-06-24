import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { z } from 'zod';

const PostCreateSchema = z.object({
  content: z.object({
    text: z.string().min(1, 'Content text is required'),
    images: z.array(z.string()).optional(),
    video: z.string().optional(),
    link: z.string().url().optional() }),
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  scheduledAt: z.string().optional(),
  clientId: z.string().uuid() });

const PostUpdateSchema = z.object({
  content: z
    .object({
      text: z.string().optional(),
      images: z.array(z.string()).optional(),
      video: z.string().optional(),
      link: z.string().url().optional() })
    .optional(),
  platforms: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  status: z.enum(['scheduled', 'published', 'paused', 'cancelled']).optional()});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const user = (req as any).user;

  try {
    switch (method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handleCreate(req, res, user);
      case 'PUT':
        return handleUpdate(req, res, user);
      case 'DELETE':
        return handleDelete(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Social Posts API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : undefined });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const { client_id, status, platform, limit = '50', offset = '0', date_from, date_to } = req.query;

  try {
    // Get user's accessible clients
    const { data: userClients } = await supabase
      .from('user_clients')
      .select('client_id')
      .eq('user_id', user.id);

    if (!userClients || userClients.length === 0) {
      return res.json({ data: [], count: 0 });
    }

    const clientIds = userClients.map((uc: any) => uc.client_id);

    let query = supabase
      .from('social_posts')
      .select(
        `
        *,
        clients(id, name),
        social_post_platforms(platform),
        social_post_results(platform, success, post_id, error, published_at)
      `
      )
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })
      .range(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string) - 1
      );

    // Apply filters
    if (client_id && clientIds.includes(client_id as string)) {
      query = query.eq('client_id', client_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (date_from) {
      query = query.gte('scheduled_at', date_from);
    }

    if (date_to) {
      query = query.lte('scheduled_at', date_to);
    }

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Error fetching social posts:', error);
      return res.status(500).json({ error: 'Failed to fetch social posts' });
    }

    // Filter by platform if specified
    let filteredPosts = posts || [];
    if (platform) {
      filteredPosts = filteredPosts.filter((post: any) =>
        post.social_post_platforms?.some((p: any) => p.platform === platform)
      );
    }

    return res.json({
      data: filteredPosts,
      count: count || 0 });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error in handleGet:', error);
    return res.status(500).json({ error: 'Failed to fetch social posts' });
  }
}

async function handleCreate(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const validationResult = PostCreateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues });
  }

  const postData = validationResult.data;

  try {
    // Verify user has access to the client
    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('client_id', postData.clientId)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Verify platform connections
    const { data: platformConnections } = await supabase
      .from('social_platform_connections')
      .select('platform, status')
      .eq('client_id', postData.clientId)
      .in('platform', postData.platforms)
      .eq('status', 'active');

    const connectedPlatforms = platformConnections?.map((p: any) => p.platform) || [];
    const missingPlatforms = postData.platforms.filter((p: any) => !connectedPlatforms.includes(p));

    if (missingPlatforms.length > 0) {
      return res.status(400).json({
        error: `Platforms not connected or inactive: ${missingPlatforms.join(', ')}`});
    }

    // Determine if this is a scheduled post
    const isScheduled = postData.scheduledAt && new Date(postData.scheduledAt) > new Date();
    const status = isScheduled ? 'scheduled' : 'publishing';

    // Create the post
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        client_id: postData.clientId,
        content: postData.content,
        status,
        scheduled_at: postData.scheduledAt || new Date().toISOString(),
        created_by: user.id })
      .select()
      .single();

    if (postError) {
      console.error('Error creating social post:', postError);
      return res.status(500).json({ error: 'Failed to create social post' });
    }

    // Create platform associations
    const platformPromises = postData.platforms.map((platform: any) =>
      supabase.from('social_post_platforms').insert({
        post_id: post.id,
        platform})
    );

    await Promise.all(platformPromises);

    if (!isScheduled) {
      // Publish immediately
      const publishResults = await publishToMPlatforms(post, postData.platforms, postData.clientId);

      // Update post status based on results
      const allSuccessful = publishResults.every(r => r.success);
      const newStatus = allSuccessful ? 'published' : 'failed';

      await supabase.from('social_posts').update({ status: newStatus }).eq('id', post.id);

      // Save publish results
      const resultPromises = publishResults.map((result: any) =>
        supabase.from('social_post_results').insert({
          post_id: post.id,
          platform: result.platform,
          success: result.success,
          post_id_external: result.postId,
          error: result.error,
          published_at: result.success ? new Date().toISOString() : null })
      );

      await Promise.all(resultPromises);

      return res.status(201).json({
        data: { ...post, status: newStatus  }
        publishResults,
        message: allSuccessful
          ? 'Post published successfully'
          : 'Post published with some failures'});
    } else {
      // Return scheduled post
      return res.status(201).json({
        data: post,
        message: 'Post scheduled successfully' });
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error creating social post:', error);
    return res.status(500).json({ error: 'Failed to create social post' });
  }
}

async function handleUpdate(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const { post_id } = req.query;

  if (!post_id) {
    return res.status(400).json({ error: 'post_id is required' });
  }

  const validationResult = PostUpdateSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.issues });
  }

  const updateData = validationResult.data;

  try {
    // Verify user has access to the post
    const { data: post } = await supabase
      .from('social_posts')
      .select('id, client_id, status')
      .eq('id', post_id)
      .single();

    if (!post) {
      return res.status(404).json({ error: 'Social post not found' });
    }

    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', post.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this social post' });
    }

    // Only allow updates to scheduled posts
    if (post.status !== 'scheduled' && post.status !== 'paused') {
      return res.status(400).json({ error: 'Can only update scheduled or paused posts' });
    }

    // Update the post
    const { data: updatedPost, error } = await supabase
      .from('social_posts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString() })
      .eq('id', post_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating social post:', error);
      return res.status(500).json({ error: 'Failed to update social post' });
    }

    // Update platforms if provided
    if (updateData.platforms) {
      // Delete existing platform associations
      await supabase.from('social_post_platforms').delete().eq('post_id', post_id);

      // Create new platform associations
      const platformPromises = updateData.platforms.map((platform: any) =>
        supabase.from('social_post_platforms').insert({
          post_id: post_id,
          platform})
      );

      await Promise.all(platformPromises);
    }

    return res.json({
      data: updatedPost,
      message: 'Social post updated successfully' });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error updating social post:', error);
    return res.status(500).json({ error: 'Failed to update social post' });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any): Promise<void> {
  const { post_id } = req.query;

  if (!post_id) {
    return res.status(400).json({ error: 'post_id is required' });
  }

  try {
    // Verify user has access to the post
    const { data: post } = await supabase
      .from('social_posts')
      .select('id, client_id, status')
      .eq('id', post_id)
      .single();

    if (!post) {
      return res.status(404).json({ error: 'Social post not found' });
    }

    const { data: clientAccess } = await supabase
      .from('user_clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', post.client_id)
      .single();

    if (!clientAccess) {
      return res.status(403).json({ error: 'Access denied to this social post' });
    }

    // Only allow deletion of scheduled posts
    if (post.status !== 'scheduled' && post.status !== 'paused') {
      return res.status(400).json({ error: 'Can only delete scheduled or paused posts' });
    }

    // Delete the post (cascade will handle related records)
    const { error } = await supabase.from('social_posts').delete().eq('id', post_id);

    if (error) {
      console.error('Error deleting social post:', error);
      return res.status(500).json({ error: 'Failed to delete social post' });
    }

    return res.json({ message: 'Social post deleted successfully' });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error deleting social post:', error);
    return res.status(500).json({ error: 'Failed to delete social post' });
  }
}

// Helper function to publish to multiple platforms
async function publishToMPlatforms(
  post: any,
  platforms: string[],
  clientId: string
): Promise<any[]> {
  const results = [];

  for (const platform of platforms) {
    try {
      // Get platform connection
      const { data: connection } = await supabase
        .from('social_platform_connections')
        .select('access_token')
        .eq('client_id', clientId)
        .eq('platform', platform)
        .eq('status', 'active')
        .single();

      if (!connection) {
        results.push({
          platform,
          success: false,
          error: 'Platform not connected or inactive' });
        continue;
      }

      // Simulate platform publishing (in real implementation, call actual platform APIs)
      const isSuccess = Math.random() > 0.2; // 80% success rate for simulation

      if (isSuccess) {
        results.push({
          platform,
          success: true,
          postId: `${platform}_${Math.random().toString(36).substr(2, 9)}`});
      } else {
        results.push({
          platform,
          success: false,
          error: 'Platform API error' });
      }
    } catch (error: any) {
      results.push({
        platform,
        success: false,
        error: getErrorMessage(error) });
    }
  }

  return results;
}

export default withAuth(withSecurityHeaders(handler));
