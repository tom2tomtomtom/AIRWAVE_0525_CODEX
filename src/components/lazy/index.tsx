// Dynamic imports for code splitting - Performance optimized components
import dynamic from 'next/dynamic';
import React from 'react';

// Heavy components (600+ lines) with lazy loading for better performance
export const LazyAssetBrowser = dynamic(() => import('../ui/AssetBrowser/EnhancedAssetBrowser'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-96 w-full rounded" />,
  ssr: false
});

export const LazyVideoExecutionPanel = dynamic(() => import('../VideoExecutionPanel'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64 w-full rounded" />,
  ssr: false
});

export const LazyApprovalWorkflow = dynamic(() => import('../ApprovalWorkflow'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-48 w-full rounded" />,
  ssr: false
});

export const LazyCampaignMatrix = dynamic(() => import('../CampaignMatrix'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-80 w-full rounded" />,
  ssr: false
});

export const LazyPublishingAnalytics = dynamic(() => import('../social/PublishingAnalytics'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64 w-full rounded" />,
  ssr: false
});

export const LazyMonitoringDashboard = dynamic(() => import('../monitoring/MonitoringDashboard'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-96 w-full rounded" />,
  ssr: false
});

export const LazyActivityFeed = dynamic(() => import('../ActivityFeed'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64 w-full rounded" />,
  ssr: false
});

export const LazyScheduledPosts = dynamic(() => import('../social/ScheduledPosts'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64 w-full rounded" />,
  ssr: false
});

export const LazyExecutionMonitor = dynamic(() => import('../ExecutionMonitor'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-48 w-full rounded" />,
  ssr: false
});
