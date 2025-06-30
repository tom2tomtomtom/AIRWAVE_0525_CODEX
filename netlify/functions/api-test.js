exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Check if we can access environment variables
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasCreatomate = !!process.env.CREATOMATE_API_KEY;
    const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Manual Netlify Function is working!',
        timestamp: new Date().toISOString(),
        method: event.httpMethod,
        path: event.path,
        environment: {
          hasOpenAI,
          hasCreatomate,  
          hasElevenLabs,
          nodeEnv: process.env.NODE_ENV
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};