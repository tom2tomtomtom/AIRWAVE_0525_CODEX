// Core Web Vitals tracking and performance monitoring
// Note: web-vitals package may not be available - using fallback approach
let onCLS: any, onFID: any, onFCP: any, onLCP: any, onTTFB: any;
try {
  const webVitals = require('web-vitals');
  ({ onCLS, onFID, onFCP, onLCP, onTTFB } = webVitals);
} catch (e) {
  // Fallback functions if web-vitals is not available
  const fallback = (callback: any) => {
    // Mock implementation for development
    setTimeout(() => callback({ name: 'fallback', value: 0, rating: 'good' }), 1000);
  };
  onCLS = onFID = onFCP = onLCP = onTTFB = fallback;
}

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: any[];
  id: string;
  navigationType: string;
}

interface PerformanceThresholds {
  lcp: { good: number; poor: number };
  fid: { good: number; poor: number };
  cls: { good: number; poor: number };
  fcp: { good: number; poor: number };
  ttfb: { good: number; poor: number };
}

// Web Vitals thresholds based on Google recommendations
const THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, poor: 4000 },  // Largest Contentful Paint
  fid: { good: 100, poor: 300 },    // First Input Delay
  cls: { good: 0.1, poor: 0.25 },   // Cumulative Layout Shift
  fcp: { good: 1800, poor: 3000 },  // First Contentful Paint
  ttfb: { good: 800, poor: 1800 },  // Time to First Byte
};

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private observers: Set<(metric: PerformanceMetric) => void> = new Set();
  private sessionId: string = this.generateSessionId();
  private startTime: number = Date.now();

  constructor() {
    this.initializeWebVitals();
    this.trackCustomMetrics();
    this.trackResourceTimings();
  }

  /**
   * Initialize Core Web Vitals tracking
   */
  private initializeWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint
    onLCP((metric: any) => {
      this.reportMetric({
        ...metric,
        name: 'LCP',
        rating: this.getRating('lcp', metric.value),
      });
    });

    // First Input Delay
    onFID((metric: any) => {
      this.reportMetric({
        ...metric,
        name: 'FID',
        rating: this.getRating('fid', metric.value),
      });
    });

    // Cumulative Layout Shift
    onCLS((metric: any) => {
      this.reportMetric({
        ...metric,
        name: 'CLS',
        rating: this.getRating('cls', metric.value),
      });
    });

    // First Contentful Paint
    onFCP((metric: any) => {
      this.reportMetric({
        ...metric,
        name: 'FCP',
        rating: this.getRating('fcp', metric.value),
      });
    });

    // Time to First Byte
    onTTFB((metric: any) => {
      this.reportMetric({
        ...metric,
        name: 'TTFB',
        rating: this.getRating('ttfb', metric.value),
      });
    });
  }

  /**
   * Track custom performance metrics
   */
  private trackCustomMetrics(): void {
    if (typeof window === 'undefined') return;

    // Track bundle loading time
    this.trackBundleLoadTime();
    
    // Track route changes
    this.trackRouteChanges();
    
    // Track React hydration
    this.trackHydrationTime();
    
    // Track cache performance
    this.trackCachePerformance();
  }

  private trackBundleLoadTime(): void {
    if (window.performance && window.performance.timing) {
      const navigation = window.performance.timing;
      const loadTime = navigation.loadEventEnd - navigation.navigationStart;
      
      this.reportCustomMetric('bundle-load-time', loadTime, {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        domInteractive: navigation.domInteractive - navigation.navigationStart,
      });
    }
  }

  private trackRouteChanges(): void {
    let routeChangeStart = Date.now();
    
    // Listen for Next.js route changes
    if (typeof window !== 'undefined' && window.history) {
      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        routeChangeStart = Date.now();
        return originalPushState.apply(this, args);
      };

      // Track when route change completes
      setTimeout(() => {
        const routeChangeTime = Date.now() - routeChangeStart;
        this.reportCustomMetric('route-change-time', routeChangeTime);
      }, 100);
    }
  }

  private trackHydrationTime(): void {
    if (typeof window !== 'undefined') {
      // Track React hydration
      const hydrationStart = performance.now();
      
      // Use a mutation observer to detect when React has hydrated
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-reactroot]') || document.querySelector('#__next')) {
          const hydrationTime = performance.now() - hydrationStart;
          this.reportCustomMetric('react-hydration-time', hydrationTime);
          observer.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      
      // Fallback timeout
      setTimeout(() => {
        observer.disconnect();
      }, 5000);
    }
  }

  private trackCachePerformance(): void {
    // Track cache hit rates and performance
    const cacheMetrics = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
    };

    // Override fetch to track cache performance
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const start = performance.now();
        const response = await originalFetch(...args);
        const duration = performance.now() - start;
        
        cacheMetrics.totalRequests++;
        
        // Check if response came from cache
        if (response.headers.get('x-cache') === 'HIT' || duration < 50) {
          cacheMetrics.hits++;
        } else {
          cacheMetrics.misses++;
        }
        
        // Report cache metrics periodically
        if (cacheMetrics.totalRequests % 10 === 0) {
          const hitRate = (cacheMetrics.hits / cacheMetrics.totalRequests) * 100;
          this.reportCustomMetric('cache-hit-rate', hitRate, cacheMetrics);
        }
        
        return response;
      };
    }
  }

  /**
   * Track resource loading performance
   */
  private trackResourceTimings(): void {
    if (typeof window === 'undefined') return;

    // Track resource loading
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          this.analyzeResourceTiming(entry as PerformanceResourceTiming);
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  private analyzeResourceTiming(entry: PerformanceResourceTiming): void {
    const resourceType = this.getResourceType(entry.name);
    const loadTime = entry.responseEnd - entry.startTime;
    
    // Report slow resources
    if (loadTime > 1000) {
      this.reportCustomMetric(`slow-resource-${resourceType}`, loadTime, {
        url: entry.name,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
      });
    }
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
    if (url.match(/\.(mp4|webm|ogg)$/)) return 'video';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  /**
   * Get rating based on thresholds
   */
  private getRating(metric: keyof PerformanceThresholds, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = THRESHOLDS[metric];
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Report performance metric
   */
  private reportMetric(metric: PerformanceMetric): void {
    this.metrics.set(metric.name, metric);
    
    // Notify observers
    this.observers.forEach(observer => observer(metric));
    
    // Send to analytics if configured
    this.sendToAnalytics(metric);
  }

  /**
   * Report custom metric
   */
  private reportCustomMetric(name: string, value: number, metadata?: any): void {
    const metric: PerformanceMetric = {
      name,
      value,
      rating: 'good', // Custom metrics don't have predefined ratings
      delta: value,
      entries: metadata ? [metadata] : [],
      id: this.generateMetricId(),
      navigationType: 'navigate',
    };
    
    this.reportMetric(metric);
  }

  /**
   * Send metrics to analytics service
   */
  private sendToAnalytics(metric: PerformanceMetric): void {
    if (typeof window === 'undefined') return;

    // Send to our performance API
    fetch('/api/performance/vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        metric,
      }),
    }).catch(error => {
      console.warn('Failed to send performance metric:', error);
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Subscribe to performance metrics
   */
  public subscribe(observer: (metric: PerformanceMetric) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Get all collected metrics
   */
  public getMetrics(): Map<string, PerformanceMetric> {
    return new Map(this.metrics);
  }

  /**
   * Get performance summary
   */
  public getSummary() {
    const metrics = Array.from(this.metrics.values());
    const coreWebVitals = metrics.filter(m => ['LCP', 'FID', 'CLS'].includes(m.name));
    
    return {
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.startTime,
      totalMetrics: metrics.length,
      coreWebVitals: coreWebVitals.map(m => ({
        name: m.name,
        value: m.value,
        rating: m.rating,
      })),
      overallRating: this.calculateOverallRating(coreWebVitals),
      customMetrics: metrics.filter(m => !['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].includes(m.name)),
    };
  }

  private calculateOverallRating(coreWebVitals: PerformanceMetric[]): 'good' | 'needs-improvement' | 'poor' {
    if (coreWebVitals.length === 0) return 'good';
    
    const ratings = coreWebVitals.map(m => m.rating);
    
    if (ratings.every(r => r === 'good')) return 'good';
    if (ratings.some(r => r === 'poor')) return 'poor';
    return 'needs-improvement';
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Export types
export type { PerformanceMetric, PerformanceThresholds };