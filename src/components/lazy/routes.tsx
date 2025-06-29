// Route-level code splitting for feature-specific pages
import dynamic from 'next/dynamic';
import React from 'react';
import { Box, Skeleton, Typography, CircularProgress } from '@mui/material';

// Enhanced route loading component with better UX
const RouteLoadingSkeleton = ({ 
  height = 400, 
  title = 'Loading page...',
  showProgress = true 
}) => (
  <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    {showProgress && (
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box>
    )}
    <Skeleton variant="rounded" height={height} sx={{ width: '100%', borderRadius: 2 }} />
  </Box>
);

// AI-powered features (heavy dependencies, specific routes)
export const LazyAIToolsPage = dynamic(() => import('../../pages/ai-tools'), {
  loading: () => <RouteLoadingSkeleton title="Loading AI Tools..." />,
  ssr: false,
});

export const LazyVideoStudioPage = dynamic(() => import('../../pages/video-studio'), {
  loading: () => <RouteLoadingSkeleton title="Loading Video Studio..." />,
  ssr: false,
});

// Analytics features (heavy charting dependencies)
export const LazyAnalyticsPage = dynamic(() => import('../../pages/analytics'), {
  loading: () => <RouteLoadingSkeleton title="Loading Analytics Dashboard..." />,
  ssr: false,
});

// Campaign management (complex workflow pages)
export const LazyCampaignBuilderPage = dynamic(() => import('../../pages/campaign-builder'), {
  loading: () => <RouteLoadingSkeleton title="Loading Campaign Builder..." />,
  ssr: false,
});

export const LazyMatrixPage = dynamic(() => import('../../pages/matrix'), {
  loading: () => <RouteLoadingSkeleton title="Loading Campaign Matrix..." />,
  ssr: false,
});

export const LazyExecutePage = dynamic(() => import('../../pages/execute'), {
  loading: () => <RouteLoadingSkeleton title="Loading Execution Monitor..." />,
  ssr: false,
});

// Social media features
export const LazySocialPublishingPage = dynamic(() => import('../../pages/social-publishing'), {
  loading: () => <RouteLoadingSkeleton title="Loading Social Publishing..." />,
  ssr: false,
});

// Asset management
export const LazyAssetsPage = dynamic(() => import('../../pages/assets'), {
  loading: () => <RouteLoadingSkeleton title="Loading Asset Library..." />,
  ssr: false,
});

// Strategic content features
export const LazyStrategicContentPage = dynamic(() => import('../../pages/strategic-content'), {
  loading: () => <RouteLoadingSkeleton title="Loading Strategic Content..." />,
  ssr: false,
});

export const LazyStrategyPage = dynamic(() => import('../../pages/strategy'), {
  loading: () => <RouteLoadingSkeleton title="Loading Strategy Tools..." />,
  ssr: false,
});

// Workflow and generation features
export const LazyFlowPage = dynamic(() => import('../../pages/flow'), {
  loading: () => <RouteLoadingSkeleton title="Loading Workflow..." />,
  ssr: false,
});

export const LazyGenerateEnhancedPage = dynamic(() => import('../../pages/generate-enhanced'), {
  loading: () => <RouteLoadingSkeleton title="Loading Content Generator..." />,
  ssr: false,
});

// Admin features (specific access level)
export const LazyAdminUsersPage = dynamic(() => import('../../pages/admin/users'), {
  loading: () => <RouteLoadingSkeleton title="Loading Admin Panel..." />,
  ssr: false,
});

// Template management
export const LazyTemplatesPage = dynamic(() => import('../../pages/templates'), {
  loading: () => <RouteLoadingSkeleton title="Loading Templates..." />,
  ssr: false,
});

// Approval workflows
export const LazyApprovalsPage = dynamic(() => import('../../pages/approvals'), {
  loading: () => <RouteLoadingSkeleton title="Loading Approvals..." />,
  ssr: false,
});

// Client management
export const LazyClientsPage = dynamic(() => import('../../pages/clients'), {
  loading: () => <RouteLoadingSkeleton title="Loading Client Management..." />,
  ssr: false,
});

export const LazyCreateClientPage = dynamic(() => import('../../pages/create-client'), {
  loading: () => <RouteLoadingSkeleton title="Loading Client Creation..." />,
  ssr: false,
});

// Development and debugging (only loaded in specific environments)
export const LazyDebugPage = dynamic(() => import('../../pages/debug'), {
  loading: () => <RouteLoadingSkeleton title="Loading Debug Console..." />,
  ssr: false,
});

export const LazySystemStatusPage = dynamic(() => import('../../pages/system-status'), {
  loading: () => <RouteLoadingSkeleton title="Loading System Status..." />,
  ssr: false,
});

export const LazyWebhooksPage = dynamic(() => import('../../pages/webhooks'), {
  loading: () => <RouteLoadingSkeleton title="Loading Webhooks..." />,
  ssr: false,
});

// Content generation features
export const LazyContentPage = dynamic(() => import('../../pages/content'), {
  loading: () => <RouteLoadingSkeleton title="Loading Content Tools..." />,
  ssr: false,
});

// API documentation (developer features)
export const LazyApiDocsPage = dynamic(() => import('../../pages/api-docs'), {
  loading: () => <RouteLoadingSkeleton title="Loading API Documentation..." />,
  ssr: false,
});