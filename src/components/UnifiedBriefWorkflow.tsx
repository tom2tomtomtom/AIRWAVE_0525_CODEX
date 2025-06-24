import React from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import { WorkflowProvider } from './workflow/WorkflowProvider';
import { WorkflowContainer } from './workflow/WorkflowContainer';
import { MobileOptimizedWorkflow } from './MobileOptimizedWorkflow';

interface UnifiedBriefWorkflowProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

export const UnifiedBriefWorkflow: React.FC<UnifiedBriefWorkflowProps> = ({
  open,
  onClose,
  onComplete}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Return mobile version for mobile devices
  if (isMobile) {
    return <MobileOptimizedWorkflow open={open} onClose={onClose} onComplete={onComplete} />;
  }

  // Return desktop version with new architecture
  return (
    <WorkflowProvider>
      <WorkflowContainer open={open} onClose={onClose} onComplete={onComplete} />
    </WorkflowProvider>
  );
};
