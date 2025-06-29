import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
import axios from 'axios';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface PlatformTokenRequest {
  platform: string;
  code: string;
  state: string;
  redirectUri: string;
}

async function exchangeCodeForToken(request: PlatformTokenRequest): Promise<TokenResponse> {
  const { platform, code, redirectUri } = request;

  switch (platform) {
    case 'facebook':
    case 'instagram':
      return await exchangeFacebookToken(code, redirectUri);
    case 'twitter':
      return await exchangeTwitterToken(code, redirectUri);
    case 'linkedin':
      return await exchangeLinkedInToken(code, redirectUri);
    default:
      throw new Error('Unsupported platform');
  }
}

async function exchangeFacebookToken(code: string, redirectUri: string): Promise<TokenResponse> {
  const response = await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', {
    client_id: process.env.FACEBOOK_CLIENT_ID,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri});

  return response.data;
}

async function exchangeTwitterToken(code: string, redirectUri: string): Promise<TokenResponse> {
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;
  
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post(
    'https://api.twitter.com/2/oauth2/token',
    new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: 'challenge', // This should match the code_challenge from auth
    }),
    {
      headers: {
        'Authorization': `Basic ${basicAuth
      }`,
        'Content-Type': 'application/x-www-form-urlencoded'}}
  );

  return response.data;
}

async function exchangeLinkedInToken(code: string, redirectUri: string): Promise<TokenResponse> {
  const response = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: redirectUri}),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }}
  );

  return response.data;
}

async function getUserProfile(platform: string, accessToken: string): Promise<any> {
  switch (platform) {
    case 'facebook':
      return await getFacebookProfile(accessToken);
    case 'instagram':
      return await getInstagramProfile(accessToken);
    case 'twitter':
      return await getTwitterProfile(accessToken);
    case 'linkedin':
      return await getLinkedInProfile(accessToken);
    default:
      throw new Error('Unsupported platform');
  }
}

async function getFacebookProfile(accessToken: string): Promise<any> {
  const response = await axios.get(
    `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
  );
  return response.data;
}

async function getInstagramProfile(accessToken: string): Promise<any> {
  // First get user's pages/accounts
  const pagesResponse = await axios.get(
    `https://graph.facebook.com/me/accounts?access_token=${accessToken}`
  );
  
  const pages = pagesResponse.data.data;
  
  // Get Instagram accounts connected to pages
  const instagramAccounts = [];
  for (const page of pages) {
    try {
      const igResponse = await axios.get(
        `https://graph.facebook.com/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      
      if (igResponse.data.instagram_business_account) {
        const igAccountResponse = await axios.get(
          `https://graph.facebook.com/${igResponse.data.instagram_business_account.id}?fields=id,username,name,profile_picture_url&access_token=${page.access_token}`
        );
        
        instagramAccounts.push({
          ...igAccountResponse.data,
          page_id: page.id,
          page_access_token: page.access_token});
      }
    } catch (error: any) {
      console.warn('Failed to get Instagram account for page:', page.id);
    }
  }
  
  return {
    accounts: instagramAccounts,
    primary: instagramAccounts[0] || null};
}

async function getTwitterProfile(accessToken: string): Promise<any> {
  const response = await axios.get('https://api.twitter.com/2/users/me', {
    headers: {
        'Authorization': `Bearer ${accessToken
      }`}});
  return response?.data?.data;
}

async function getLinkedInProfile(accessToken: string): Promise<any> {
  const response = await axios.get(
    'https://api.linkedin.com/v2/people/~:(id,firstName,lastName,profilePicture(displayImage~:playableStreams))',
    {
      headers: {
        'Authorization': `Bearer ${accessToken
      }`}}
  );
  return response.data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const { platform } = req.query;
  const { code, state, error: oauthError } = req.query;

  try {
    // Handle OAuth errors
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      res.redirect('/social-publishing?error=oauth_failed');
      return;
    }

    // Validate required parameters
    if (typeof platform !== 'string' || !code || !state) {
      res.redirect('/social-publishing?error=invalid_callback');
      return;
    }

    // Parse and validate state
    let stateData;
    try {
      stateData = JSON.parse(atob(state as string));
    } catch (error: any) {
      console.error('Invalid state parameter:', error);
      res.redirect('/social-publishing?error=invalid_state');
      return;
    }

    const { userId, clientId, timestamp } = stateData;

    // Check state freshness (15 minutes max)
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      res.redirect('/social-publishing?error=expired_state');
      return;
    }

    // Exchange code for access token
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/social/callback/${platform}`;

    const tokenResponse = await exchangeCodeForToken({
      platform,
      code: code as string,
      state: state as string,
      redirectUri});

    // Get user profile from the platform
    const profile = await getUserProfile(platform, tokenResponse.access_token);

    // Store the connection in database
    const connectionData = {
      user_id: userId,
      client_id: clientId,
      platform: platform,
      platform_user_id: profile.id || profile.primary?.id,
      platform_username: profile.username || profile.name || profile.firstName,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      token_expires_at: tokenResponse.expires_in 
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : null,
      scope: tokenResponse.scope,
      profile_data: profile,
      is_active: true,
      connected_at: new Date().toISOString()};

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('platform_user_id', connectionData.platform_user_id)
      .single();

    if (existingConnection) {
      // Update existing connection
      await supabase
        .from('social_connections')
        .update(connectionData)
        .eq('id', existingConnection.id);
    } else {
      // Create new connection
      await supabase
        .from('social_connections')
        .insert(connectionData);
    }

    // Redirect back to social publishing page with success
    res.redirect(`/social-publishing?success=${platform}&connected=true`);
    return;

  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('OAuth callback error:', error, 'Message:', message);
    res.redirect(`/social-publishing?error=connection_failed&platform=${platform}`);
    return;
  }
}