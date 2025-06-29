// Dynamic imports for code splitting - Performance optimized components
import dynamic from 'next/dynamic';
import React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';

// Enhanced loading component for better UX
const LazyLoadingSkeleton = ({ 
  height = 200, 
  title = 'Loading component...',
  variant = 'rectangular' as const 
}) => (
  <Box sx={{ p: 2 }}>
    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
      {title}
    </Typography>
    <Skeleton variant={variant} height={height} sx={{ borderRadius: 2 }} />
  </Box>
);

// Heavy components (600+ lines) with lazy loading for better performance
export const LazyAssetBrowser = dynamic(
  () =>
    import('../ui/AssetBrowser/EnhancedAssetBrowser').then(mod => ({
      default: mod.EnhancedAssetBrowser,
    })),
  {
    loading: () => <LazyLoadingSkeleton height={384} title="Loading Asset Browser..." />,
    ssr: false,
  }
);

export const LazyVideoExecutionPanel = dynamic(() => import('../VideoExecutionPanel'), {
  loading: () => <LazyLoadingSkeleton height={256} title="Loading Video Execution Panel..." />,
  ssr: false,
});

export const LazyApprovalWorkflow = dynamic(() => import('../ApprovalWorkflow'), {
  loading: () => <LazyLoadingSkeleton height={192} title="Loading Approval Workflow..." />,
  ssr: false,
});

export const LazyCampaignMatrix = dynamic(() => import('../CampaignMatrix'), {
  loading: () => <LazyLoadingSkeleton height={320} title="Loading Campaign Matrix..." />,
  ssr: false,
});

export const LazyPublishingAnalytics = dynamic(() => import('../social/PublishingAnalytics'), {
  loading: () => <LazyLoadingSkeleton height={256} title="Loading Analytics Dashboard..." />,
  ssr: false,
});

export const LazyMonitoringDashboard = dynamic(() => import('../monitoring/MonitoringDashboard'), {
  loading: () => <LazyLoadingSkeleton height={384} title="Loading Monitoring Dashboard..." />,
  ssr: false,
});

export const LazyActivityFeed = dynamic(() => import('../ActivityFeed'), {
  loading: () => <LazyLoadingSkeleton height={256} title="Loading Activity Feed..." />,
  ssr: false,
});

export const LazyScheduledPosts = dynamic(() => import('../social/ScheduledPosts'), {
  loading: () => <LazyLoadingSkeleton height={256} title="Loading Scheduled Posts..." />,
  ssr: false,
});

export const LazyExecutionMonitor = dynamic(() => import('../ExecutionMonitor'), {
  loading: () => <LazyLoadingSkeleton height={192} title="Loading Execution Monitor..." />,
  ssr: false,
});

// AI-powered components (heavy dependencies)
export const LazyAIImageGenerator = dynamic(() => import('../AIImageGenerator'), {
  loading: () => <LazyLoadingSkeleton height={256} title="Loading AI Image Generator..." />,
  ssr: false,
});

// Workflow step components (wizard-based, load on demand)
export const LazyTemplateSelectionStep = dynamic(
  () => import('../workflow/steps/TemplateSelectionStep').then(mod => ({ default: mod.TemplateSelectionStep })),
  {
    loading: () => <LazyLoadingSkeleton height={320} title="Loading Template Selection..." />,
    ssr: false,
  }
);

export const LazyAssetSelectionStep = dynamic(
  () => import('../workflow/steps/AssetSelectionStep').then(mod => ({ default: mod.AssetSelectionStep })),
  {
    loading: () => <LazyLoadingSkeleton height={320} title="Loading Asset Selection..." />,
    ssr: false,
  }
);

export const LazyRenderStep = dynamic(
  () => import('../workflow/steps/RenderStep').then(mod => ({ default: mod.RenderStep })),
  {
    loading: () => <LazyLoadingSkeleton height={256} title="Loading Render Step..." />,
    ssr: false,
  }
);

// Modal components (only load when opened)
export const LazyOnboardingWizard = dynamic(
  () => import('../OnboardingWizard').then(mod => ({ default: mod.OnboardingWizard })),
  {
    loading: () => <LazyLoadingSkeleton height={384} title="Loading Onboarding Wizard..." />,
    ssr: false,
  }
);

export const LazyBriefUploadModal = dynamic(
  () => import('../BriefUploadModal').then(mod => ({ default: mod.BriefUploadModal })),
  {
    loading: () => <LazyLoadingSkeleton height={256} title="Loading Brief Upload..." />,
    ssr: false,
  }
);

export const LazyBriefDialog = dynamic(() => import('../strategic/BriefDialog'), {
  loading: () => <LazyLoadingSkeleton height={384} title="Loading Brief Dialog..." />,
  ssr: false,
});

export const LazyAssetUploadModal = dynamic(() => import('../AssetUploadModal'), {
  loading: () => <LazyLoadingSkeleton height={256} title="Loading Asset Upload..." />,
  ssr: false,
});

// Social media components (feature-specific)
export const LazySocialPublisher = dynamic(() => import('../social/SocialPublisher'), {
  loading: () => <LazyLoadingSkeleton height={256} title="Loading Social Publisher..." />,
  ssr: false,
});

// Mobile-specific components
export const LazyMobileOptimizedWorkflow = dynamic(
  () => import('../MobileOptimizedWorkflow').then(mod => ({ default: mod.MobileOptimizedWorkflow })),
  {
    loading: () => <LazyLoadingSkeleton height={600} title="Loading Mobile Workflow..." />,
    ssr: false,
  }
);

// Re-export route-level lazy components
export * from './routes';

// Re-export lazy loading utilities
export * from './withLazyLoading';

// Re-export modal lazy loading utilities
export * from './modals';
