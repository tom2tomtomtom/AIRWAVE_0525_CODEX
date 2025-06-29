// Modal-specific lazy loading with dynamic imports
import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';
import { 
  Box, 
  Skeleton, 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  CircularProgress,
  Typography 
} from '@mui/material';
// Simplified inline error boundary for modals
class ModalErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: () => React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback();
    }
    return this.props.children;
  }
}

// Modal loading skeleton
const ModalLoadingSkeleton = ({ 
  height = 300, 
  title = 'Loading...',
  showSpinner = true 
}) => (
  <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    {showSpinner && (
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
      </Box>
    )}
    <Skeleton variant="rounded" height={height} sx={{ width: '100%', borderRadius: 1 }} />
  </Box>
);

// Higher-order component for modal lazy loading
export const withModalLazyLoading = <T extends object>(
  Component: React.ComponentType<T>,
  loadingTitle = 'Loading modal...'
) => {
  const LazyModalComponent = React.forwardRef<any, T>((props, ref) => (
    <Suspense fallback={<ModalLoadingSkeleton title={loadingTitle} />}>
      <ModalErrorBoundary
        fallback={() => (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="error">Failed to load modal content</Typography>
          </Box>
        )}
      >
        <Component {...props} ref={ref} />
      </ModalErrorBoundary>
    </Suspense>
  ));

  LazyModalComponent.displayName = `LazyModal(${Component.displayName || Component.name})`;
  return LazyModalComponent;
};

// Lazy modal wrapper for external modals
export const LazyModalWrapper: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  loadingHeight?: number;
}> = ({ 
  open, 
  onClose, 
  title, 
  maxWidth = 'md', 
  children, 
  loadingHeight = 400 
}) => (
  <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
    {title && <DialogTitle>{title}</DialogTitle>}
    <DialogContent>
      <Suspense 
        fallback={
          <ModalLoadingSkeleton 
            height={loadingHeight} 
            title="Loading modal content..." 
          />
        }
      >
        <ModalErrorBoundary
          fallback={() => (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="error">Failed to load modal content</Typography>
            </Box>
          )}
        >
          {children}
        </ModalErrorBoundary>
      </Suspense>
    </DialogContent>
  </Dialog>
);

// Pre-configured lazy modals for common use cases
export const LazyOnboardingWizardModal = dynamic(
  () => import('../OnboardingWizard').then(mod => ({ default: mod.OnboardingWizard })),
  {
    loading: () => <ModalLoadingSkeleton title="Loading Onboarding Wizard..." height={500} />,
    ssr: false,
  }
);

export const LazyBriefUploadModal = dynamic(
  () => import('../BriefUploadModal').then(mod => ({ default: mod.BriefUploadModal })),
  {
    loading: () => <ModalLoadingSkeleton title="Loading Brief Upload..." height={350} />,
    ssr: false,
  }
);

export const LazyAssetUploadModal = dynamic(() => import('../AssetUploadModal'), {
  loading: () => <ModalLoadingSkeleton title="Loading Asset Upload..." height={400} />,
  ssr: false,
});

export const LazyBriefDialog = dynamic(() => import('../strategic/BriefDialog'), {
  loading: () => <ModalLoadingSkeleton title="Loading Brief Dialog..." height={450} />,
  ssr: false,
});

// AI-powered modals that require heavy dependencies
export const LazyAIImageGeneratorModal = dynamic(
  () => import('../AIImageGenerator').then(mod => ({ default: mod.AIImageGenerator })),
  {
    loading: () => <ModalLoadingSkeleton title="Loading AI Image Generator..." height={400} />,
    ssr: false,
  }
);

// Placeholder components for future modal implementations
const PlaceholderModal = ({ title }: { title: string }) => (
  <Box sx={{ p: 3, textAlign: 'center' }}>
    <Typography variant="h6" gutterBottom>{title}</Typography>
    <Typography color="text.secondary">This modal is not yet implemented</Typography>
  </Box>
);

// Future modal implementations (placeholders for now)
export const LazyClientFormModal = () => <PlaceholderModal title="Client Form" />;
export const LazyTemplateEditorModal = () => <PlaceholderModal title="Template Editor" />;
export const LazyCampaignSettingsModal = () => <PlaceholderModal title="Campaign Settings" />;
export const LazyAssetPreviewModal = () => <PlaceholderModal title="Asset Preview" />;
export const LazyVideoPlayerModal = () => <PlaceholderModal title="Video Player" />;
export const LazyAnalyticsDetailsModal = () => <PlaceholderModal title="Analytics Details" />;
export const LazySocialPublishModal = () => <PlaceholderModal title="Social Publisher" />;
export const LazyApprovalWorkflowModal = () => <PlaceholderModal title="Approval Workflow" />;
export const LazyUserManagementModal = () => <PlaceholderModal title="User Management" />;