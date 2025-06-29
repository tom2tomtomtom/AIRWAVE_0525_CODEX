// API endpoint for collecting Core Web Vitals and performance metrics
import { NextApiRequest, NextApiResponse } from 'next';

interface PerformanceMetricPayload {
  sessionId: string;
  timestamp: number;
  url: string;
  userAgent: string;
  connectionType?: string;
  metric: {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    entries: any[];
    id: string;
    navigationType: string;
  };
}

interface StoredMetric extends PerformanceMetricPayload {
  id: string;
  createdAt: string;
}

// In-memory storage for demo purposes (use database in production)
const metrics: StoredMetric[] = [];
const MAX_METRICS = 10000; // Limit stored metrics

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload: PerformanceMetricPayload = req.body;

    // Validate payload
    if (!payload.sessionId || !payload.metric || !payload.metric.name) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Store metric
    const storedMetric: StoredMetric = {
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    metrics.push(storedMetric);

    // Keep only the most recent metrics
    if (metrics.length > MAX_METRICS) {
      metrics.splice(0, metrics.length - MAX_METRICS);
    }

    // Log performance issues
    if (payload.metric.rating === 'poor') {
      console.warn(`Performance issue detected: ${payload.metric.name} = ${payload.metric.value}ms (${payload.url})`);
    }

    // Respond with success
    res.status(200).json({ 
      success: true, 
      metricId: storedMetric.id,
      totalMetrics: metrics.length 
    });

    // External analytics integration can be added here if needed

  } catch (error) {
    console.error('Error processing performance metric:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to send metrics to external analytics (commented out for now)
// This can be implemented when specific analytics providers are configured

// Export metrics for internal use
export { metrics };