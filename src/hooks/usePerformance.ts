// React hooks for performance monitoring and optimization
import { useState, useEffect, useCallback, useRef } from 'react';
import { performanceMonitor, PerformanceMetric } from '@/lib/performance/webVitals';

/**
 * Hook for monitoring Core Web Vitals in real-time
 */
export const useWebVitals = () => {
  const [metrics, setMetrics] = useState<Map<string, PerformanceMetric>>(new Map());
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    // Subscribe to performance metrics
    const unsubscribe = performanceMonitor.subscribe((metric) => {
      setMetrics(prev => new Map(prev).set(metric.name, metric));
    });

    // Get initial metrics
    setMetrics(performanceMonitor.getMetrics());

    // Update summary periodically
    const interval = setInterval(() => {
      setSummary(performanceMonitor.getSummary());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getCoreWebVitals = useCallback(() => {
    const lcp = metrics.get('LCP');
    const fid = metrics.get('FID');
    const cls = metrics.get('CLS');
    
    return { lcp, fid, cls };
  }, [metrics]);

  const getLoadingMetrics = useCallback(() => {
    const fcp = metrics.get('FCP');
    const ttfb = metrics.get('TTFB');
    
    return { fcp, ttfb };
  }, [metrics]);

  return {
    metrics,
    summary,
    coreWebVitals: getCoreWebVitals(),
    loadingMetrics: getLoadingMetrics(),
  };
};

/**
 * Hook for measuring component render performance
 */
export const useRenderPerformance = (componentName: string) => {
  const renderStartTime = useRef<number>();
  const [renderMetrics, setRenderMetrics] = useState<{
    renderTime: number;
    renderCount: number;
    averageRenderTime: number;
  }>({
    renderTime: 0,
    renderCount: 0,
    averageRenderTime: 0,
  });

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      
      setRenderMetrics(prev => {
        const newRenderCount = prev.renderCount + 1;
        const totalTime = prev.averageRenderTime * prev.renderCount + renderTime;
        const newAverageTime = totalTime / newRenderCount;
        
        return {
          renderTime,
          renderCount: newRenderCount,
          averageRenderTime: newAverageTime,
        };
      });

      // Report slow renders
      if (renderTime > 16) { // > 16ms might cause frame drops
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    }
  });

  return renderMetrics;
};

/**
 * Hook for tracking user interactions and their performance impact
 */
export const useInteractionTracking = () => {
  const [interactions, setInteractions] = useState<Array<{
    type: string;
    timestamp: number;
    duration: number;
    target: string;
  }>>([]);

  const trackInteraction = useCallback((type: string, target: string) => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      
      setInteractions(prev => [...prev.slice(-9), {
        type,
        timestamp: Date.now(),
        duration,
        target,
      }]);

      // Report slow interactions
      if (duration > 100) {
        console.warn(`Slow interaction detected: ${type} on ${target} took ${duration.toFixed(2)}ms`);
      }
    };
  }, []);

  const getAverageInteractionTime = useCallback((type?: string) => {
    const filteredInteractions = type 
      ? interactions.filter(i => i.type === type)
      : interactions;
    
    if (filteredInteractions.length === 0) return 0;
    
    const totalTime = filteredInteractions.reduce((sum, i) => sum + i.duration, 0);
    return totalTime / filteredInteractions.length;
  }, [interactions]);

  return {
    interactions,
    trackInteraction,
    getAverageInteractionTime,
  };
};

/**
 * Hook for monitoring memory usage
 */
export const useMemoryMonitoring = () => {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usagePercentage: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const isHighMemoryUsage = memoryInfo ? memoryInfo.usagePercentage > 80 : false;

  return {
    memoryInfo,
    isHighMemoryUsage,
  };
};

/**
 * Hook for tracking resource loading performance
 */
export const useResourcePerformance = () => {
  const [resourceMetrics, setResourceMetrics] = useState<{
    slowResources: Array<{
      url: string;
      type: string;
      loadTime: number;
      size: number;
    }>;
    totalResources: number;
    averageLoadTime: number;
  }>({
    slowResources: [],
    totalResources: 0,
    averageLoadTime: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceResourceTiming[];
      
      entries.forEach(entry => {
        const loadTime = entry.responseEnd - entry.startTime;
        const type = getResourceType(entry.name);
        
        setResourceMetrics(prev => {
          const newTotalResources = prev.totalResources + 1;
          const newAverageLoadTime = (prev.averageLoadTime * prev.totalResources + loadTime) / newTotalResources;
          
          const updatedSlowResources = loadTime > 1000 
            ? [...prev.slowResources.slice(-9), {
                url: entry.name,
                type,
                loadTime,
                size: entry.transferSize || 0,
              }]
            : prev.slowResources;
          
          return {
            slowResources: updatedSlowResources,
            totalResources: newTotalResources,
            averageLoadTime: newAverageLoadTime,
          };
        });
      });
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => observer.disconnect();
  }, []);

  return resourceMetrics;
};

/**
 * Hook for monitoring bundle size and loading performance
 */
export const useBundlePerformance = () => {
  const [bundleMetrics, setBundleMetrics] = useState<{
    initialBundleSize: number;
    loadedChunks: number;
    totalLoadTime: number;
    cacheHitRate: number;
  }>({
    initialBundleSize: 0,
    loadedChunks: 0,
    totalLoadTime: 0,
    cacheHitRate: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Calculate initial bundle size
    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = resourceEntries.filter(entry => entry.name.includes('.js'));
    
    const initialSize = jsResources.reduce((total, entry) => total + (entry.transferSize || 0), 0);
    const totalLoadTime = jsResources.reduce((total, entry) => total + (entry.responseEnd - entry.startTime), 0);
    
    setBundleMetrics(prev => ({
      ...prev,
      initialBundleSize: initialSize,
      loadedChunks: jsResources.length,
      totalLoadTime,
    }));

    // Monitor chunk loading
    const observer = new PerformanceObserver((list) => {
      const newChunks = list.getEntries().filter(entry => 
        entry.name.includes('.js') && entry.name.includes('chunk')
      );
      
      if (newChunks.length > 0) {
        setBundleMetrics(prev => ({
          ...prev,
          loadedChunks: prev.loadedChunks + newChunks.length,
        }));
      }
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => observer.disconnect();
  }, []);

  return bundleMetrics;
};

/**
 * Hook for real-time performance alerts
 */
export const usePerformanceAlerts = () => {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'warning' | 'error';
    message: string;
    timestamp: number;
    metric?: string;
    value?: number;
  }>>([]);

  useEffect(() => {
    const unsubscribe = performanceMonitor.subscribe((metric) => {
      // Check for performance issues
      if (metric.rating === 'poor') {
        setAlerts(prev => [...prev.slice(-4), {
          id: `${Date.now()}-${metric.name}`,
          type: 'error',
          message: `Poor ${metric.name}: ${metric.value}ms`,
          timestamp: Date.now(),
          metric: metric.name,
          value: metric.value,
        }]);
      } else if (metric.rating === 'needs-improvement') {
        setAlerts(prev => [...prev.slice(-4), {
          id: `${Date.now()}-${metric.name}`,
          type: 'warning',
          message: `${metric.name} needs improvement: ${metric.value}ms`,
          timestamp: Date.now(),
          metric: metric.name,
          value: metric.value,
        }]);
      }
    });

    return unsubscribe;
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  return {
    alerts,
    dismissAlert,
  };
};

// Utility function
const getResourceType = (url: string): string => {
  if (url.includes('.js')) return 'javascript';
  if (url.includes('.css')) return 'stylesheet';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
  if (url.match(/\.(mp4|webm|ogg)$/)) return 'video';
  if (url.includes('/api/')) return 'api';
  return 'other';
};