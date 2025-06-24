import React, { useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';
import { useClient } from '@/contexts/ClientContext';
import { WorkflowActions, WorkflowContext } from '@/lib/workflow/workflow-types';
import { workflowReducer, initialWorkflowState } from '@/lib/workflow/workflowReducer';
import { WorkflowContextProvider } from '@/lib/workflow/workflowContext';
import { WorkflowErrorBoundary } from './ErrorBoundary';
import {
  useBriefActions,
  useMotivationActions,
  useCopyActions,
  useNavigationActions,
  useAssetActions,
  useErrorHandling} from '@/hooks/workflow';

// Provider component
interface WorkflowProviderProps {
  children: ReactNode;
}

export const WorkflowProvider: React.FC<WorkflowProviderProps> = ({ children }) => {
  const { activeClient } = useClient();
  const [state, dispatch] = useReducer(workflowReducer, {
    ...initialWorkflowState,
    clientId: activeClient?.id || null });

  // Generate session ID for metrics tracking
  const sessionId = useMemo(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get client info for metrics
  const userId = activeClient?.id || 'anonymous';

  // Initialize custom hooks
  const { withErrorHandling, clearError, setError } = useErrorHandling({ dispatch });

  const { nextStep, previousStep, goToStep } = useNavigationActions({
    state: { currentStep: state.currentStep },
    dispatch,
    userId,
    sessionId});

  const { uploadBrief, confirmBrief, resetBrief } = useBriefActions({
    state: { originalBriefData: state.originalBriefData },
    dispatch,
    nextStep,
    withErrorHandling});

  const { generateMotivations, selectMotivation } = useMotivationActions({
    state: { briefData: state.briefData },
    dispatch,
    withErrorHandling,
    userId,
    sessionId});

  const { generateCopy, selectCopy, storeCopyVariations } = useCopyActions({
    state: { briefData: state.briefData, motivations: state.motivations },
    dispatch,
    userId});

  const { selectAsset, removeAsset, selectTemplate } = useAssetActions({ dispatch });

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    dispatch({ type: 'RESET_WORKFLOW' });
  }, []);

  // Memoize actions object to prevent unnecessary re-renders
  const actions: WorkflowActions = useMemo(
    () => ({
      nextStep,
      previousStep,
      goToStep,
      uploadBrief,
      confirmBrief,
      resetBrief,
      generateMotivations,
      selectMotivation,
      generateCopy,
      selectCopy,
      storeCopyVariations,
      selectAsset,
      removeAsset,
      selectTemplate,
      clearError,
      setError,
      resetWorkflow}),
    [
      nextStep,
      previousStep,
      goToStep,
      uploadBrief,
      confirmBrief,
      resetBrief,
      generateMotivations,
      selectMotivation,
      generateCopy,
      selectCopy,
      storeCopyVariations,
      selectAsset,
      removeAsset,
      selectTemplate,
      clearError,
      setError,
      resetWorkflow,
    ]
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: WorkflowContext = useMemo(
    () => ({
      state,
      actions}),
    [state, actions]
  );

  return (
    <WorkflowErrorBoundary
      context="WorkflowProvider"
      showDetails={process.env.NODE_ENV === 'development'}
    >
      <WorkflowContextProvider.Provider value={contextValue}>
        {children}
      </WorkflowContextProvider.Provider>
    </WorkflowErrorBoundary>
  );
};

// Hook to use workflow context
export const useWorkflow = (): WorkflowContext => {
  const context = useContext(WorkflowContextProvider);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};
