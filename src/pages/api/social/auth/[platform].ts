import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';

interface OAuthConfig {
  authUrl: string;
  clientId: string;
  scope: string;
  responseType: string;
  redirectUri: string;
}

function getOAuthConfig(platform: string): OAuthConfig | null {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/social/callback/${platform}`;

  switch (platform) {
    case 'facebook':
      return {
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        clientId: process.env.FACEBOOK_CLIENT_ID!,
        scope:
          'pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish',
        responseType: 'code',
        redirectUri};

    case 'instagram':
      // Instagram uses Facebook's API
      return {
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        clientId: process.env.FACEBOOK_CLIENT_ID!,
        scope: 'instagram_basic,instagram_content_publish,pages_show_list',
        responseType: 'code',
        redirectUri};

    case 'twitter':
      return {
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        clientId: process.env.TWITTER_CLIENT_ID!,
        scope: 'tweet.read tweet.write users.read offline.access',
        responseType: 'code',
        redirectUri};

    case 'linkedin':
      return {
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        clientId: process.env.LINKEDIN_CLIENT_ID!,
        scope: 'w_member_social',
        responseType: 'code',
        redirectUri};

    default:
      return null;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { platform } = req.query;
  const userId = req.headers['x-user-id'] as string;
  const clientId = req.headers['x-client-id'] as string;

  try {
    if (req.method === 'GET') {
      if (typeof platform !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid platform' });
      }

      const config = getOAuthConfig(platform);
      if (!config) {
        return res.status(400).json({ success: false, error: 'Unsupported platform' });
      }

      // Generate state parameter for CSRF protection
      const state = btoa(
        JSON.stringify({
          userId,
          clientId,
          platform,
          timestamp: Date.now() })
      );

      // Build OAuth URL
      const authUrl = new URL(config.authUrl);
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('scope', config.scope);
      authUrl.searchParams.set('response_type', config.responseType);
      authUrl.searchParams.set('state', state);

      // Add platform-specific parameters
      if (platform === 'twitter') {
        authUrl.searchParams.set('code_challenge', 'challenge');
        authUrl.searchParams.set('code_challenge_method', 'plain');
      }

      return res.status(200).json({
        success: true,
        authUrl: authUrl.toString(),
        state});
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('OAuth auth API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error' });
  }
}

export default withAuth(handler);
