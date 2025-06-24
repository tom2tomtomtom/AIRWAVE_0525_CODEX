import { useCallback } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { useCSRF } from '@/hooks/useCSRF';
import { BriefData } from '@/lib/workflow/workflow-types';
import { validateFile, validateBriefData } from '@/lib/validation/workflow-validation';
import { performanceTracker } from '@/lib/performance/performance-tracker';

interface UseBriefActionsProps {
  state: {},
    originalBriefData: BriefData | null;
  };
  dispatch: (action: any) => void;
  nextStep: () => void;
  withErrorHandling: <T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: () => void
  ) => () => Promise<T | null>;
}

export const useBriefActions = ({
  state,
  dispatch,
  nextStep,
  withErrorHandling}: UseBriefActionsProps) => {
  const { showNotification } = useNotification();
  const { makeCSRFRequest } = useCSRF();

  const uploadBrief = useCallback(async (file: File) => {
    performanceTracker.start('workflow_upload_brief');

    try {
      // Validate file before processing
      const fileValidation = validateFile(file);
      if (!fileValidation.valid) {
        throw new Error(`File validation failed: ${fileValidation.errors.join(', ')}`);
      }

      dispatch({ type: 'SET_PROCESSING', processing: true });
      dispatch({ type: 'SET_UPLOADED_FILE', file });

      const briefOperation = async () => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await makeCSRFRequest('/api/flow/parse-brief', {
          method: 'POST',
          body: formData});

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          // Validate and sanitize the parsed brief data
          const briefValidation = validateBriefData(result.data);
          if (!briefValidation.valid) {
            throw new Error(`Brief data validation failed: ${briefValidation.errors.join(', ')}`);
          }

          dispatch({
            type: 'SET_BRIEF_DATA',
            briefData: briefValidation.data,
            originalBriefData: briefValidation.data});
          dispatch({ type: 'SET_SHOW_BRIEF_REVIEW', show: true });
          showNotification('Brief processed successfully! Please review and edit the parsed content.', 'success');

          return result.data;
        } else {
          throw new Error(result.message || 'Failed to parse brief');
        }
      };

      const fallback = () => {
        dispatch({ type: 'SET_UPLOADED_FILE', file: null });
      };

      const result = await withErrorHandling(briefOperation, 'Brief Upload', fallback)();
      return result;
    } finally {
      dispatch({ type: 'SET_PROCESSING', processing: false });
      performanceTracker.end('workflow_upload_brief');
    }
  }, [makeCSRFRequest, showNotification, withErrorHandling, dispatch]);

  const confirmBrief = useCallback((briefData: BriefData) => {
    // Validate brief data before confirming
    const briefValidation = validateBriefData(briefData);
    if (!briefValidation.valid) {
      showNotification(`Brief validation failed: ${briefValidation.errors.join(', ')}`, 'error');
      return;
    }

    dispatch({ 
      type: 'SET_BRIEF_DATA', 
      briefData: briefValidation.data, 
      originalBriefData: state.originalBriefData! 
    });
    dispatch({ type: 'SET_BRIEF_CONFIRMED', confirmed: true });
    dispatch({ type: 'SET_SHOW_BRIEF_REVIEW', show: false });
    nextStep();
  }, [state.originalBriefData, nextStep, showNotification, dispatch]);

  const resetBrief = useCallback(() => {
    if (state.originalBriefData) {
      dispatch({
        type: 'SET_BRIEF_DATA',
        briefData: state.originalBriefData,
        originalBriefData: state.originalBriefData});
    }
  }, [state.originalBriefData, dispatch]);

  return {
    uploadBrief,
    confirmBrief,
    resetBrief};
};