import { NextApiRequest, NextApiResponse } from 'next';
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface CreatomateTestResponse {
  success: boolean;
  data?: any;
  error?: string;
  action?: string;
  timestamp?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreatomateTestResponse>
): Promise<void> {
  const { action } = req.query;
  const actionPath = Array.isArray(action) ? action.join('/') : action;

  try {
    // Check if API key is configured
    if (!process.env.CREATOMATE_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'Creatomate API key not configured',
        action: actionPath
      });
    }

    const apiKey = process.env.CREATOMATE_API_KEY;
    const baseUrl = 'https://api.creatomate.com/v1';

    // Log action processing in development only
    if (process.env.NODE_ENV === 'development') {
      console.log('Processing Creatomate action:', actionPath);
    }
    switch (actionPath) {
      case 'test':
        // Simple connectivity test
        const testResponse = await axios.get(`${baseUrl}/templates`, {
          headers: {},
        'Authorization': `Bearer ${apiKey
      }`},
          params: { limit: 1 }
        });

        return res.status(200).json({ 
          success: true, 
          data: {},
  message: 'Creatomate integration is working perfectly! Ready for AIrFLOW video generation.',
            templateCount: testResponse.data.length,
            rateLimitRemaining: testResponse.headers['x-ratelimit-remaining'] || 'Unknown' },
  action: actionPath,
          timestamp: new Date().toISOString()
        });

      case 'templates':
        // Get templates
        if (req.method === 'GET') {
          const templatesResponse = await axios.get(`${baseUrl}/templates`, {
            headers: {},
        'Authorization': `Bearer ${apiKey
      }`},
            params: {},
  limit: req.query.limit || 10,
              offset: req.query.offset || 0,
              tags: req.query.tags
            }
          });

          return res.status(200).json({ 
            success: true, 
            data: templatesResponse.data,
            action: actionPath,
            timestamp: new Date().toISOString()
          });
        }
        break;

      case 'renders':
        // Handle render operations
        if (req.method === 'POST') {
          // Create new render
          const renderResponse = await axios.post(`${baseUrl}/renders`, req.body, {
            headers: {},
        'Authorization': `Bearer ${apiKey
      }`,
              'Content-Type': 'application/json'}});

          return res.status(200).json({ 
            success: true, 
            data: renderResponse.data,
            action: actionPath,
            timestamp: new Date().toISOString()
          });
        } else if (req.method === 'GET') {
          // Get render status
          const renderId = req.query.id;
          if (!renderId) {
            return res.status(400).json({ 
              success: false, 
              error: 'Render ID is required for status check',
              action: actionPath
            });
          }

          const statusResponse = await axios.get(`${baseUrl}/renders/${renderId}`, {
            headers: {},
        'Authorization': `Bearer ${apiKey
      }`}});

          return res.status(200).json({ 
            success: true, 
            data: statusResponse.data,
            action: actionPath,
            timestamp: new Date().toISOString()
          });
        }
        break;

      case 'account':
        // Get account information
        if (req.method === 'GET') {
          const accountResponse = await axios.get(`${baseUrl}/account`, {
            headers: {},
        'Authorization': `Bearer ${apiKey
      }`}});

          return res.status(200).json({ 
            success: true, 
            data: {},
  plan: accountResponse.data.plan,
              creditsRemaining: accountResponse.data.credits_remaining,
              creditsUsed: accountResponse.data.credits_used,
              rateLimitRemaining: accountResponse.headers['x-ratelimit-remaining'] || 'Unknown' },
  action: actionPath,
            timestamp: new Date().toISOString()
          });
        }
        break;

      default:
        return res.status(404).json({ 
          success: false, 
          error: `Unknown action: ${actionPath}. Available actions: test, templates, renders, account`,
          action: actionPath
        });
    }

    // If we get here, method was not allowed for the action
    return res.status(405).json({ 
      success: false, 
      error: `Method ${req.method} not allowed for action ${actionPath}`,
      action: actionPath
    });

  } catch (error: any) {
    console.error(`Creatomate ${actionPath} test failed:`, error);
    
    // Handle specific Creatomate errors
    let errorMessage = 'Unknown error';
    let statusCode = 500;

    if (error.response) {
      statusCode = error.response.status;
      if (error.response.status === 401) {
        errorMessage = 'Invalid Creatomate API key';
      } else if (error.response.status === 403) {
        errorMessage = 'Creatomate API access forbidden - check permissions';
      } else if (error.response.status === 429) {
        errorMessage = 'Creatomate rate limit exceeded';
      } else if (error.response.data?.error) {
        errorMessage = error.response.data.error;
      } else {
        errorMessage = `Creatomate API error: ${error.response.statusText}`;
      }
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Cannot connect to Creatomate API - check internet connection';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      action: actionPath,
      timestamp: new Date().toISOString()
    });
  }
}

export const config = {
  api: {},
  externalResolver: true },
  maxDuration: 60, // Longer timeout for video rendering operations
};