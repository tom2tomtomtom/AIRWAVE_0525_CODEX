import { loggers } from '@/lib/logger';

// Performance monitoring setup
// import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'; // Package not installed

// Track Core Web Vitals
export const setupPerformanceMonitoring = () => {
  // Placeholder function - web-vitals package not installed
  if (process.env.NODE_ENV === 'development') {
    loggers.ai.info('Performance monitoring disabled - web-vitals package not installed');
  }
  /*
  getCLS((metric) => {
    // Log CLS metric
    if (process.env.NODE_ENV === 'development') {
      loggers.ai.info('CLS:', metric);
    }
  });
  getFID((metric) => {
    // Log FID metric
    if (process.env.NODE_ENV === 'development') {
      loggers.ai.info('FID:', metric);
    }
  });
  getFCP((metric) => {
    // Log FCP metric
    if (process.env.NODE_ENV === 'development') {
      loggers.ai.info('FCP:', metric);
    }
  });
  getLCP((metric) => {
    // Log LCP metric
    if (process.env.NODE_ENV === 'development') {
      loggers.ai.info('LCP:', metric);
    }
  });
  getTTFB((metric) => {
    // Log TTFB metric
    if (process.env.NODE_ENV === 'development') {
      loggers.ai.info('TTFB:', metric);
    }
  });
  */
};

// Performance observer for custom metrics
export const observePerformance = () => {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Log performance entries in development only
        if (entry.entryType === 'navigation' && process.env.NODE_ENV === 'development') {
          loggers.ai.info('Navigation timing:', { 
            name: entry.name,
            duration: entry.duration,
            entryType: entry.entryType
          });
        }
      });
    });
    
    observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
  }
};
