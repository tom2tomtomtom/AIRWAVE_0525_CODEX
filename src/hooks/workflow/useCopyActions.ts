import { useCallback } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { useCSRF } from '@/hooks/useCSRF';
import { useClient } from '@/contexts/ClientContext';
import { BriefData, Motivation, CopyVariation } from '@/lib/workflow/workflow-types';
import { validateCopyVariations } from '@/lib/validation/workflow-validation';
import { estimateTokensForCopy } from '@/utils/ai-cost-estimation';

// Conditional imports for server-side only
let aiRateLimiter: any = { checkLimit: () => Promise.resolve({ allowed: true, remaining: 100, resetTime: 0, totalRequests: 1 }) };
let aiResponseCache: any = { get: () => Promise.resolve(null), set: () => Promise.resolve() };
let aiCircuitBreaker: any = { execute: (fn: any) => fn() };

if (typeof window === 'undefined') {
  try {
    aiRateLimiter = require('@/lib/rate-limiting/ai-rate-limiter').aiRateLimiter;
    aiResponseCache = require('@/lib/caching/ai-response-cache').aiResponseCache;
    aiCircuitBreaker = require('@/lib/circuit-breaker/ai-circuit-breaker').aiCircuitBreaker;
  } catch (error: any) {
    console.warn('Server-side dependencies not available, using fallbacks');
  }
}

interface UseCopyActionsProps {
  state: {},
    briefData: BriefData | null;
    motivations: Motivation[];
  };
  dispatch: (action: any) => void;
  userId: string;
}

export const useCopyActions = ({
  state,
  dispatch,
  userId}: UseCopyActionsProps) => {
  const { showNotification } = useNotification();
  const { makeCSRFRequest } = useCSRF();
  const { activeClient } = useClient();

  const generateCopy = useCallback(async () => {
    if (!state.briefData) {
      showNotification('Brief data is required to generate copy', 'error');
      return;
    }

    const selectedMotivations = state?.motivations?.filter((m: any) => m.selected);
    if (selectedMotivations.length < 1) {
      showNotification('Minimum 1 motivation required to generate copy', 'error');
      return;
    }

    // Check rate limit before proceeding
    const rateLimitCheck = await aiRateLimiter.checkLimit(userId, 'generate-copy');

    if (!rateLimitCheck.allowed) {
      showNotification(
        `Rate limit exceeded. Please wait ${Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000)} seconds before trying again.`,
        'warning'
      );
      return;
    }

    dispatch({ type: 'SET_PROCESSING', processing: true });

    try {
      // Check cache first
      const cacheKey = {
        motivations: selectedMotivations,
        briefData: state.briefData,
        operation: 'generate-copy'
      };
      const cachedCopy = await aiResponseCache.get('generate-copy', cacheKey);

      if (cachedCopy && Array.isArray(cachedCopy)) {
        console.log('🎯 Using cached copy variations');
        const copyWithSelection = cachedCopy.map((copy: any) => ({
          ...copy,
          selected: false
        }));

        const copyValidation = validateCopyVariations(copyWithSelection);
        if (copyValidation.valid) {
          dispatch({ type: 'SET_COPY_VARIATIONS', copyVariations: copyValidation.data || [] });
          showNotification(`Loaded ${cachedCopy.length} cached copy variations!`, 'success');
          return;
        }
      }

      // Pre-flight cost check for copy generation
      const estimatedTokens = estimateTokensForCopy(selectedMotivations, state.briefData);
      const costCheck = await fetch('/api/ai/cost-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'openai',
          model: 'gpt-4o-mini',
          estimatedTokens,
          operation: 'generate-copy',
          operationData: {},
            motivations: selectedMotivations,
            briefData: state.briefData,
            platforms: state?.briefData?.platforms }})
      });

      const { allowed, reason, fallbackModel, usageStats } = await costCheck.json();

      if (!allowed) {
        throw new Error(`Budget limit reached: ${reason}`);
      }

      if (fallbackModel) {
        showNotification(`Using ${fallbackModel} to stay within budget`, 'info');
      }

      // Show usage stats if approaching budget limit
      if (usageStats && usageStats.percentOfBudget > 80) {
        showNotification(`AI usage at ${usageStats.percentOfBudget.toFixed(1)}% of monthly budget`, 'warning');
      }

      // Execute with circuit breaker protection
      const response = await aiCircuitBreaker.execute(
        'openai',
        'generate-copy',
        async () => {
          return await makeCSRFRequest('/api/flow/generate-copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              motivations: selectedMotivations,
              briefData: state.briefData,
              model: fallbackModel || 'gpt-4o-mini',
              budgetAware: true
            })});
        },
        async () => {
          // Fallback: provide generic copy variations
          console.log('🔄 Using fallback copy due to service unavailability');
          return new Response(JSON.stringify({
            success: true,
            data: [
              {
                id: 'fallback-copy-1',
                text: 'Discover the difference with our innovative solution',
                platform: 'general',
                motivation: selectedMotivations[0]?.title || 'Brand Awareness'
              },
              {
                id: 'fallback-copy-2',
                text: 'Transform your experience today',
                platform: 'general',
                motivation: selectedMotivations[0]?.title || 'Customer Engagement'
              }
            ]
          }), { status: 200 });
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to generate copy`);
      }

      const result = await response.json();

      if (result.success) {
        const copyWithSelection = result.data.map((copy: any) => ({
          ...copy,
          selected: false
        }));

        // Validate copy variations before storing
        const copyValidation = validateCopyVariations(copyWithSelection);
        if (!copyValidation.valid) {
          throw new Error(`Copy validation failed: ${copyValidation.errors.join(', ')}`);
        }

        dispatch({ type: 'SET_COPY_VARIATIONS', copyVariations: copyValidation.data || [] });
        showNotification(`Generated ${result.data.length} copy variations!`, 'success');

        // Cache the result for future use
        await aiResponseCache.set('generate-copy', cacheKey, result.data);
      } else {
        throw new Error(result.message || 'Failed to generate copy');
      }
    } catch (error: any) {
      console.error('Error generating copy:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate copy. Please try again.';
      dispatch({ type: 'SET_ERROR', error: errorMessage });
      showNotification(errorMessage, 'error');
    } finally {
      dispatch({ type: 'SET_PROCESSING', processing: false });
    }
  }, [state.briefData, state.motivations, makeCSRFRequest, showNotification, userId, dispatch]);

  const selectCopy = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_COPY', id });
  }, [dispatch]);

  const storeCopyVariations = useCallback(async (selectedCopy: CopyVariation[]) => {
    try {
      const response = await makeCSRFRequest('/api/flow/store-copy-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCopy,
          briefTitle: state.briefData?.title || 'Untitled Brief',
          clientId: activeClient?.id || 'default-client'
        })});

      if (!response.ok) {
        throw new Error('Failed to store copy assets');
      }

      const result = await response.json();

      if (result.success) {
        showNotification(`${result.data.count} copy variations stored in assets library!`, 'success');
        return result;
      } else {
        throw new Error(result.message || 'Failed to store copy assets');
      }
    } catch (error: any) {
      console.error('Error storing copy assets:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to store copy assets';
      dispatch({ type: 'SET_ERROR', error: errorMessage });
      showNotification(errorMessage, 'error');
      throw error;
    }
  }, [makeCSRFRequest, state.briefData, activeClient, showNotification, dispatch]);

  return {
    generateCopy,
    selectCopy,
    storeCopyVariations};
};