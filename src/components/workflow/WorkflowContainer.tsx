import React, { useCallback, Suspense, lazy } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Skeleton} from '@mui/material';
import {
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as ContentCopyIcon,
  Image as ImageIcon,
  VideoLibrary as VideoLibraryIcon,
  GridView as GridViewIcon,
  PlayArrow as PlayArrowIcon} from '@mui/icons-material';
import { useWorkflow } from './WorkflowProvider';

// Conditional performance tracker import for server-side only
let performanceTracker: any = null;
if (typeof window === 'undefined') {
  try {
    performanceTracker = require('@/lib/performance/performance-tracker').performanceTracker;
  } catch (error: any) {
    // Performance tracker not available, use noop
    performanceTracker = {
      startTimer: () => {},
      endTimer: () => {},
      recordMetric: () => {}
    };
  }
} else {
  // Client-side noop implementation
  performanceTracker = {
    startTimer: () => {},
    endTimer: () => {},
    recordMetric: () => {}
  };
}

// Lazy load step components for better performance
const BriefUploadStep = lazy(() =>
  import('./steps/BriefUploadStep').then(module => ({ default: module.BriefUploadStep }))
);
const MotivationSelectionStep = lazy(() =>
  import('./steps/MotivationSelectionStep').then(module => ({ default: module.MotivationSelectionStep }))
);
const CopyGenerationStep = lazy(() =>
  import('./steps/CopyGenerationStep').then(module => ({ default: module.CopyGenerationStep }))
);
const AssetSelectionStep = lazy(() =>
  import('./steps/AssetSelectionStep').then(module => ({ default: module.AssetSelectionStep }))
);
const TemplateSelectionStep = lazy(() =>
  import('./steps/TemplateSelectionStep').then(module => ({ default: module.TemplateSelectionStep }))
);
const MatrixBuildStep = lazy(() =>
  import('./steps/MatrixBuildStep').then(module => ({ default: module.MatrixBuildStep }))
);
const RenderStep = lazy(() =>
  import('./steps/RenderStep').then(module => ({ default: module.RenderStep }))
);

interface WorkflowContainerProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

// Skeleton loading components for each step
const StepSkeleton: React.FC<{ stepType: string }> = ({ stepType }) => {
  return (
    <div>Content</div>
  );
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Loading {stepType}...
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width="60%" height={40} />
        <Skeleton variant="text" width="80%" height={24} sx={{ mt: 1 }} />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {[1, 2, 3].map((i: any) => (
          <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', mt: 4 }}>
        <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 1 }} />
      </Box>
    </Box>
  );
};

// Define workflow steps
const workflowSteps = [
  {
    id: 'upload',
    label: 'Upload Brief',
    description: 'Upload and review your campaign brief',
    icon: <CloudUploadIcon /> },
  {
    id: 'motivations',
    label: 'Motivations',
    description: 'Generate and select strategic motivations',
    icon: <AutoAwesomeIcon /> },
  {
    id: 'copy',
    label: 'Copy Generation',
    description: 'Create copy variations for your campaign',
    icon: <ContentCopyIcon /> },
  {
    id: 'assets',
    label: 'Asset Selection',
    description: 'Choose images, videos, and other assets',
    icon: <ImageIcon /> },
  {
    id: 'template',
    label: 'Template',
    description: 'Select a video template for your campaign',
    icon: <VideoLibraryIcon /> },
  {
    id: 'matrix',
    label: 'Campaign Matrix',
    description: 'Review and build your campaign matrix',
    icon: <GridViewIcon /> },
  {
    id: 'render',
    label: 'Render Videos',
    description: 'Generate your final campaign videos',
    icon: <PlayArrowIcon /> }
];

export const WorkflowContainer: React.FC<WorkflowContainerProps> = ({
  open,
  onClose,
  onComplete}) => {  const { state, actions } = useWorkflow();
  const { currentStep } = state;
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Handle step navigation
  const handleNext = useCallback(() => {
    actions.nextStep();
  }, [actions]);

  const handlePrevious = useCallback(() => {
    actions.previousStep();
  }, [actions]);

  const handleStepClick = useCallback((stepIndex: number) => {
    // Only allow navigation to completed steps or the next step
    if (stepIndex <= currentStep + 1) {
      actions.goToStep(stepIndex);
    }
  }, [currentStep, actions]);

  // Handle workflow completion
  const handleWorkflowComplete = useCallback((data: any) => {
    actions.resetWorkflow();
    onComplete(data);
  }, [actions, onComplete]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    // Reset workflow when closing
    actions.resetWorkflow();
    onClose();
  }, [actions, onClose]);

  // Performance tracking for current step
  const stepName = workflowSteps[currentStep]?.id || 'unknown';

  // Start performance tracking for step render
  React.useEffect(() => {
    const operationName = `workflow_step_${stepName}`;
    performanceTracker.start(operationName);
    return () => {
      performanceTracker.end(operationName);
    };
  }, [currentStep, stepName]);

  // Render current step component with lazy loading
  const renderStepContent = () => {

    const stepComponents = {
      0: () => (
        <Suspense fallback={<StepSkeleton stepType="Brief Upload" />}>
          <BriefUploadStep onNext={handleNext} />
        </Suspense>
      ),
      1: () => (
        <Suspense fallback={<StepSkeleton stepType="Motivation Selection" />}>
          <MotivationSelectionStep onNext={handleNext} onPrevious={handlePrevious} />
        </Suspense>
      ),
      2: () => (
        <Suspense fallback={<StepSkeleton stepType="Copy Generation" />}>
          <CopyGenerationStep onNext={handleNext} onPrevious={handlePrevious} />
        </Suspense>
      ),
      3: () => (
        <Suspense fallback={<StepSkeleton stepType="Asset Selection" />}>
          <AssetSelectionStep onNext={handleNext} onPrevious={handlePrevious} />
        </Suspense>
      ),
      4: () => (
        <Suspense fallback={<StepSkeleton stepType="Template Selection" />}>
          <TemplateSelectionStep onNext={handleNext} onPrevious={handlePrevious} />
        </Suspense>
      ),
      5: () => (
        <Suspense fallback={<StepSkeleton stepType="Matrix Build" />}>
          <MatrixBuildStep onNext={handleNext} onPrevious={handlePrevious} />
        </Suspense>
      ),
      6: () => (
        <Suspense fallback={<StepSkeleton stepType="Video Rendering" />}>
          <RenderStep onPrevious={handlePrevious} onComplete={handleWorkflowComplete} />
        </Suspense>
      )
    };

    const StepComponent = stepComponents[currentStep as keyof typeof stepComponents];
    return StepComponent ? StepComponent() : null;
  };

  // Check if step is completed
  const isStepCompleted = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return state.briefConfirmed;
      case 1:
        return state?.motivations?.some(m => m.selected);
      case 2:
        return state?.copyVariations?.some(c => c.selected);
      case 3:
        return state?.selectedAssets?.length > 0;
      case 4:
        return state.selectedTemplate !== null;
      case 5:
        return true; // Matrix step is always considered complete once reached
      case 6:
        return true; // Render step is always considered complete once reached
      default:
        return false;
    }
  };

  // Check if step is active
  const isStepActive = (stepIndex: number) => {
    return stepIndex === currentStep;
  };

  return (
    <div>Content</div>
  );
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {},
          height: isMobile ? '100vh' : '90vh',
          maxHeight: isMobile ? '100vh' : '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider' }}>
        <Box>
          <Typography variant="h5" component="div">
            AIRWAVE Campaign Builder
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {workflowSteps[currentStep]?.description}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Stepper */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Stepper 
          activeStep={currentStep} 
          alternativeLabel={!isMobile}
          orientation={isMobile ? 'vertical' : 'horizontal'}
        >
          {workflowSteps.map((step, index) => (
            <Step 
              key={step.id} 
              completed={isStepCompleted(index)}
              sx={{
                cursor: index <= currentStep + 1 ? 'pointer' : 'default',
                '& .MuiStepLabel-root': {
                  cursor: index <= currentStep + 1 ? 'pointer' : 'default' }}}
              onClick={() => handleStepClick(index)}
            >
              <StepLabel
                icon={step.icon}
                StepIconProps={{
                  sx: {},
                    color: isStepCompleted(index) ? 'success.main' : 
                           isStepActive(index) ? 'primary.main' : 'grey.400'}}}
              >
                <Box sx={{ textAlign: isMobile ? 'left' : 'center' }}>
                  <Typography variant="body2" fontWeight="medium">
                    {step.label}
                  </Typography>
                  {!isMobile && (
                    <Typography variant="caption" color="text.secondary">
                      {step.description}
                    </Typography>
                  )}
                </Box>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Step Content */}
      <DialogContent sx={{ 
        flex: 1, 
        overflow: 'auto',
        p: 0, // Remove default padding since steps handle their own
      }}>
        {renderStepContent()}
      </DialogContent>

      {/* Optional Footer - could be used for global actions */}
      {/* 
      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Step {currentStep + 1} of {workflowSteps.length}
        </Typography>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
      */}
    </Dialog>
  );
};
