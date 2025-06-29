import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface LazyRouteOptions {
  preload?: boolean;
  condition?: () => boolean;
  fallbackPath?: string;
}

/**
 * Hook for managing lazy route loading with conditional logic
 * Allows for preloading routes based on user behavior and permissions
 */
export const useLazyRoute = (routePath: string, options: LazyRouteOptions = {}) => {
  const router = useRouter();
  const [isPreloaded, setIsPreloaded] = useState(false);
  const { preload = false, condition, fallbackPath } = options;

  useEffect(() => {
    // Check condition if provided
    if (condition && !condition()) {
      if (fallbackPath && router.pathname === routePath) {
        router.push(fallbackPath);
      }
      return;
    }

    // Preload route if enabled
    if (preload && !isPreloaded) {
      router.prefetch(routePath).then(() => {
        setIsPreloaded(true);
      });
    }
  }, [routePath, preload, condition, fallbackPath, router, isPreloaded]);

  return {
    isPreloaded,
    canAccess: !condition || condition(),
  };
};

/**
 * Hook for preloading routes based on user interactions
 * Preloads likely next routes when user hovers or focuses on navigation
 */
export const useRoutePreloader = () => {
  const router = useRouter();

  const preloadRoute = (path: string) => {
    router.prefetch(path);
  };

  const preloadOnHover = (path: string) => ({
    onMouseEnter: () => preloadRoute(path),
    onFocus: () => preloadRoute(path),
  });

  return {
    preloadRoute,
    preloadOnHover,
  };
};

/**
 * Common route groupings for intelligent preloading
 */
export const ROUTE_GROUPS = {
  AI_FEATURES: ['/ai-tools', '/video-studio', '/generate-enhanced'],
  CAMPAIGN_MANAGEMENT: ['/campaign-builder', '/matrix', '/execute', '/campaigns'],
  ANALYTICS: ['/analytics', '/dashboard'],
  CONTENT_CREATION: ['/content', '/strategic-content', '/templates'],
  SOCIAL_MEDIA: ['/social-publishing'],
  ADMIN: ['/admin/users', '/system-status', '/webhooks'],
  WORKFLOW: ['/flow', '/approvals'],
} as const;

/**
 * Hook for intelligent route preloading based on current page context
 */
export const useIntelligentPreloading = () => {
  const router = useRouter();
  const currentPath = router.pathname;

  useEffect(() => {
    // Find the route group that contains the current path
    const currentGroup = Object.entries(ROUTE_GROUPS).find(([, routes]) =>
      routes.some(route => currentPath.startsWith(route))
    );

    if (currentGroup) {
      const [, routes] = currentGroup;
      // Preload other routes in the same group
      routes.forEach(route => {
        if (route !== currentPath) {
          router.prefetch(route);
        }
      });
    }
  }, [currentPath, router]);

  return {
    currentGroup: Object.entries(ROUTE_GROUPS).find(([, routes]) =>
      routes.some(route => currentPath.startsWith(route))
    )?.[0],
  };
};