/**
 * Core Web Vitals Analytics Endpoint
 * Collects and stores performance metrics from client-side monitoring
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { withSecurityHeaders } from '@/middleware/withSecurityHeaders';
import { withRateLimit } from '@/middleware/withRateLimit';
import { loggers } from '@/lib/logger';

interface VitalMetric {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: any[];
  navigationType: string;
  url?: string;
  userAgent?: string;
  timestamp?: number;
}

// In-memory storage for development (replace with database in production)
const vitalsStorage: VitalMetric[] = [];
const maxStorageSize = 1000;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const metric: VitalMetric = req.body;

    // Validate required fields
    if (!metric.name || typeof metric.value !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid metric data',
      });
    }

    // Enhance metric with server-side data
    const enhancedMetric: VitalMetric = {
      ...metric,
      url: req.headers.referer || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: Date.now(),
    };

    // Store metric (replace with database storage in production)
    vitalsStorage.push(enhancedMetric);

    // Keep storage size manageable
    if (vitalsStorage.length > maxStorageSize) {
      vitalsStorage.splice(0, vitalsStorage.length - maxStorageSize);
    }

    // Log performance issue if metric is poor
    if (metric.rating === 'poor') {
      loggers.general.error(`Poor performance detected - ${metric.name}: ${metric.value}`, {
        url: enhancedMetric.url,
        userAgent: enhancedMetric.userAgent,
        rating: metric.rating,
      });
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      loggers.ai.info(`Web Vital collected - ${metric.name}:`, {
        value: metric.value,
        rating: metric.rating,
        url: enhancedMetric.url,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Metric recorded',
    });
  } catch (error) {
    console.error('Error processing vital metric:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

// Get stored vitals (for admin dashboard)
async function getVitals(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const vitals = vitalsStorage.slice(-limit);

    // Calculate averages by metric type
    const averages: Record<string, { avg: number; count: number; good: number; poor: number }> = {};

    vitals.forEach(vital => {
      if (!averages[vital.name]) {
        averages[vital.name] = { avg: 0, count: 0, good: 0, poor: 0 };
      }
      const stats = averages[vital.name]!;
      stats.avg += vital.value;
      stats.count += 1;
      if (vital.rating === 'good') stats.good += 1;
      if (vital.rating === 'poor') stats.poor += 1;
    });

    // Calculate final averages
    Object.keys(averages).forEach(key => {
      const stats = averages[key]!;
      stats.avg = stats.avg / stats.count;
    });

    res.status(200).json({
      success: true,
      data: {
        recent: vitals,
        summary: averages,
        total: vitalsStorage.length,
      },
    });
  } catch (error) {
    console.error('Error getting vitals:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

// Main handler with middleware
const mainHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    return handler(req, res);
  } else if (req.method === 'GET') {
    return getVitals(req, res);
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }
};

// Apply middleware with correct withRateLimit usage
export default withRateLimit('api')(withSecurityHeaders(mainHandler));
