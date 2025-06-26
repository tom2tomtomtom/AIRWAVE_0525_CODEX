import React from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import { WorkflowProvider } from './workflow/WorkflowProvider';
import { WorkflowContainer } from './workflow/WorkflowContainer';
import { MobileOptimizedWorkflow } from './MobileOptimizedWorkflow';

/**
 * UnifiedBriefWorkflow - Main workflow orchestrator for AIRWAVE platform
 * 
 * This component provides a responsive workflow interface for creating marketing campaigns.
 * It automatically switches between desktop and mobile optimized versions based on screen size.
 * 
 * Features:
 * - Responsive design (desktop/mobile adaptive)
 * - Multi-step workflow management
 * - Brief upload and parsing
 * - AI-powered content generation
 * - Asset management integration
 * - Campaign execution
 * 
 * @example
 * ```tsx
 * const [workflowOpen, setWorkflowOpen] = useState(false);
 * 
 * const handleWorkflowComplete = (data: WorkflowData) => {
 *   console.log('Workflow completed:', data);
 *   setWorkflowOpen(false);
 * };
 * 
 * return (
 *   <UnifiedBriefWorkflow
 *     open={workflowOpen}
 *     onClose={() => setWorkflowOpen(false)}
 *     onComplete={handleWorkflowComplete}
 *   />
 * );
 * ```
 */

interface UnifiedBriefWorkflowProps {
  /** Controls whether the workflow modal is open */
  open: boolean;
  
  /** Callback fired when the workflow should be closed */
  onClose: () => void;
  
  /** Callback fired when the workflow is completed successfully */
  onComplete: (data: WorkflowCompletionData) => void;
}

/**
 * Data structure returned when workflow completes
 */
interface WorkflowCompletionData {
  /** Generated campaign data */
  campaign: {
    id: string;
    name: string;
    brief: any;
    assets: any[];
    executions: any[];
  };
  
  /** Workflow execution metadata */
  metadata: {
    duration: number;
    stepsCompleted: number;
    generatedAssets: number;
  };
}

export const UnifiedBriefWorkflow: React.FC<UnifiedBriefWorkflowProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  const theme = useTheme();
  
  // Detect mobile devices using Material-UI breakpoints
  // Switches to mobile-optimized layout on screens smaller than 'md' (768px)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Mobile devices get a simplified, touch-optimized workflow
  if (isMobile) {
    return (
      <MobileOptimizedWorkflow 
        open={open} 
        onClose={onClose} 
        onComplete={onComplete} 
      />
    );
  }

  // Desktop/tablet devices get the full-featured workflow with context provider
  // WorkflowProvider manages global workflow state across all child components
  return (
    <WorkflowProvider>
      <WorkflowContainer 
        open={open} 
        onClose={onClose} 
        onComplete={onComplete} 
      />
    </WorkflowProvider>
  );
};

export default UnifiedBriefWorkflow;
