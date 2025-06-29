import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import { withAuth } from '@/middleware/withAuth';
import axios from 'axios';

interface PublishRequest {
  platforms: string[];
  content: {
    text?: string;
    images?: string[];
    video?: string;
    link?: string;
  };
  scheduledAt?: string;
  clientId: string;
}

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

async function publishToFacebook(
  accessToken: string,
  content: any
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('message', content.text || '');
    formData.append('access_token', accessToken);

    if (content.link) {
      formData.append('link', content.link);
    }

    const response = await fetch('https://graph.facebook.com/v18.0/me/feed', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error?.message || 'Facebook API error' };
    }

    return { success: true, postId: result.id };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function publishToTwitter(
  accessToken: string,
  content: any
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: content.text || '',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.detail || 'Twitter API error' };
    }

    return { success: true, postId: result.data?.id };
  } catch (error: any) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function publishToInstagram(
  accessToken: string,
  pageId: string,
  content: any
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // For Instagram, we need to create a media container first, then publish it
    let mediaResponse;

    if (content.images && content.images.length > 0) {
      // Image post
      mediaResponse = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/media`, {
        image_url: content.images[0],
        caption: content.text || '',
        access_token: accessToken,
      });
    } else if (content.video) {
      // Video post
      mediaResponse = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/media`, {
        video_url: content.video,
        caption: content.text || '',
        media_type: 'VIDEO',
        access_token: accessToken,
      });
    } else {
      return { success: false, error: 'Instagram requires an image or video' };
    }

    if (!mediaResponse.data.id) {
      return { success: false, error: 'Failed to create Instagram media container' };
    }

    // Publish the media container
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${pageId}/media_publish`,
      {
        creation_id: mediaResponse.data.id,
        access_token: accessToken,
      }
    );

    return { success: true, postId: publishResponse.data.id };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error?.message || getErrorMessage(error),
    };
  }
}

async function publishToLinkedIn(
  accessToken: string,
  profileId: string,
  content: any
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const postData = {
      author: `urn:li:person:${profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content.text || '',
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // If there's a link, add it as media
    if (content.link) {
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      (postData.specificContent['com.linkedin.ugc.ShareContent'] as any).media = [
        {
          status: 'READY',
          originalUrl: content.link,
        },
      ];
    }

    const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    return { success: true, postId: response?.data?.id };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || getErrorMessage(error) };
  }
}

async function publishToPlatform(
  platform: string,
  connection: any,
  content: any
): Promise<PublishResult> {
  let result: { success: boolean; postId?: string; error?: string };

  switch (platform) {
    case 'facebook':
      result = await publishToFacebook(connection.access_token, content);
      break;
    case 'instagram':
      // Instagram requires the page ID from the connection profile
      const instagramPageId =
        connection.profile_data?.primary?.page_id || connection.profile_data?.page_id;
      if (!instagramPageId) {
        result = { success: false, error: 'Instagram page ID not found in connection' };
      } else {
        result = await publishToInstagram(connection.access_token, instagramPageId, content);
      }
      break;
    case 'twitter':
      result = await publishToTwitter(connection.access_token, content);
      break;
    case 'linkedin':
      // LinkedIn requires the profile ID
      const profileId = connection.platform_user_id || connection.profile_data?.id;
      if (!profileId) {
        result = { success: false, error: 'LinkedIn profile ID not found in connection' };
      } else {
        result = await publishToLinkedIn(connection.access_token, profileId, content);
      }
      break;
    default:
      result = { success: false, error: 'Unsupported platform' };
  }

  return {
    platform,
    success: result.success,
    ...(result.postId && { postId: result.postId }),
    ...(result.error && { error: result.error }),
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const userId = req.headers['x-user-id'] as string;
  const clientId = req.headers['x-client-id'] as string;

  try {
    if (req.method === 'POST') {
      const { platforms, content, scheduledAt }: PublishRequest = req.body;

      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ success: false, error: 'No platforms specified' });
      }

      if (!content || !content.text) {
        return res.status(400).json({ success: false, error: 'No content provided' });
      }

      // If scheduled, we would queue this for later processing
      if (scheduledAt) {
        // TODO: Implement scheduling logic
        return res.status(501).json({ success: false, error: 'Scheduling not yet implemented' });
      }

      // Get social media connections
      const { data: connections, error: connectionsError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('platform', platforms);

      if (connectionsError) {
        return res.status(500).json({ success: false, error: connectionsError.message });
      }

      const results: PublishResult[] = [];

      // Publish to each platform
      for (const platform of platforms) {
        const connection = connections?.find((c: any) => c.platform === platform);

        if (!connection || !connection.access_token) {
          results.push({
            platform,
            success: false,
            error: 'Platform not connected or token missing',
          });
          continue;
        }

        // Check if token is expired
        if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
          results.push({
            platform,
            success: false,
            error: 'Access token expired, please reconnect your account',
          });
          continue;
        }

        const result = await publishToPlatform(platform, connection, content);
        results.push(result);

        // Log the publish result
        await supabase.from('social_posts').insert({
          user_id: userId,
          client_id: clientId,
          platform,
          platform_post_id: result.postId,
          content: content,
          status: result.success ? 'published' : 'failed',
          error_message: result.error,
          published_at: result.success ? new Date().toISOString() : null,
        });
      }

      // Log the publish attempt
      await supabase.from('campaign_analytics').insert({
        platform: 'multi',
        date: new Date().toISOString().split('T')[0],
        client_id: clientId,
        raw_data: {
          publish_attempt: {
            platforms,
            content,
            results,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return res.status(200).json({
        success: true,
        results,
        summary: {
          total: results.length,
          successful: results.filter((r: any) => r.success).length,
          failed: results.filter((r: any) => !r.success).length,
        },
      });
    }

    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Publish API error:', error, 'Message:', message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

export default withAuth(handler);
