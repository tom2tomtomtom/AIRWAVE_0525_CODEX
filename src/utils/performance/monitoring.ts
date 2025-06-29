import { loggers } from '@/lib/logger';
import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';

interface VitalMetric {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: any[];
  navigationType: string;
}

// Performance metrics collection
const performanceMetrics: VitalMetric[] = [];

// Send metrics to analytics endpoint
const sendToAnalytics = (metric: VitalMetric) => {
  // Store metrics locally
  performanceMetrics.push(metric);

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    loggers.ai.info(`Core Web Vital - ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
    });
  }

  // Send to production analytics
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/analytics/vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metric),
    }).catch(error => {
      console.error('Failed to send analytics:', error);
    });
  }
};

// Track Core Web Vitals - PRODUCTION READY
export const setupPerformanceMonitoring = () => {
  try {
    // Track Cumulative Layout Shift
    onCLS(sendToAnalytics);

    // Track Interaction to Next Paint (replaces FID in newer versions)
    onINP(sendToAnalytics);

    // Track First Contentful Paint
    onFCP(sendToAnalytics);

    // Track Largest Contentful Paint
    onLCP(sendToAnalytics);

    // Track Time to First Byte
    onTTFB(sendToAnalytics);

    if (process.env.NODE_ENV === 'development') {
      loggers.ai.info('✅ Core Web Vitals monitoring enabled');
    }
  } catch (error) {
    console.error('Failed to setup performance monitoring:', error);
  }
};

// Get current performance metrics
export const getPerformanceMetrics = () => {
  return performanceMetrics;
};

// Get Core Web Vitals programmatically
export const getCurrentVitals = async () => {
  // Return the collected metrics instead of trying to get them synchronously
  return performanceMetrics.reduce(
    (acc, metric) => {
      acc[metric.name.toLowerCase()] = metric.value;
      return acc;
    },
    {} as Record<string, number>
  );
};

// Performance observer for custom metrics
export const observePerformance = () => {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        // Log performance entries in development only
        if (entry.entryType === 'navigation' && process.env.NODE_ENV === 'development') {
          loggers.ai.info('Navigation timing:', {
            name: entry.name,
            duration: entry.duration,
            entryType: entry.entryType,
          });
        }
      });
    });

    observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
  }
};
