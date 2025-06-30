exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Manual Netlify Function is working!',
      timestamp: new Date().toISOString(),
      method: event.httpMethod,
      path: event.path,
      environment: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasCreatomate: !!process.env.CREATOMATE_API_KEY,
        hasElevenlabs: !!process.env.ELEVENLABS_API_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    })
  };
};