import { useCallback } from 'react';
import { workflowMetrics } from '@/lib/monitoring/workflow-metrics';

interface UseNavigationActionsProps {
  state: {},
    currentStep: number;
  };
  dispatch: (action: any) => void;
  userId: string;
  sessionId: string;
}

export const useNavigationActions = ({
  state,
  dispatch,
  userId,
  sessionId}: UseNavigationActionsProps) => {
  // Define workflow steps for navigation
  const workflowSteps = [
    { id: 'brief-upload', title: 'Upload Brief' },
    { id: 'brief-review', title: 'Review Brief' },
    { id: 'motivation-generation', title: 'Generate Motivations' },
    { id: 'motivation-selection', title: 'Select Motivations' },
    { id: 'copy-generation', title: 'Generate Copy' },
    { id: 'copy-selection', title: 'Select Copy' },
    { id: 'render-completion', title: 'Complete' }
  ];

  const nextStep = useCallback(() => {
    if (state.currentStep < 6) { // 7 steps total (0-6)
      const currentStepName = workflowSteps[state.currentStep]?.id || 'unknown';
      const nextStepName = workflowSteps[state.currentStep + 1]?.id || 'unknown';

      // Track step completion
      workflowMetrics.trackStepCompletion(userId, sessionId, currentStepName, true);

      dispatch({ type: 'SET_STEP', step: state.currentStep + 1 });

      // Track next step start
      workflowMetrics.trackStepStart(userId, sessionId, nextStepName);
    }
  }, [state.currentStep, sessionId, userId, dispatch, workflowSteps]);

  const previousStep = useCallback(() => {
    if (state.currentStep > 0) {
      dispatch({ type: 'SET_STEP', step: state.currentStep - 1 });
    }
  }, [state.currentStep, dispatch]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step <= 6) {
      dispatch({ type: 'SET_STEP', step });
    }
  }, [dispatch]);

  return {
    nextStep,
    previousStep,
    goToStep,
    workflowSteps};
};