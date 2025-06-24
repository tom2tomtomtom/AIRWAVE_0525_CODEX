import { useCallback } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { useCSRF } from '@/hooks/useCSRF';
import { BriefData } from '@/lib/workflow/workflow-types';
import { validateMotivations } from '@/lib/validation/workflow-validation';
import { estimateTokensForMotivations } from '@/utils/ai-cost-estimation';

// Conditional imports for server-side only
let aiRateLimiter: any = { checkLimit: () => Promise.resolve({ allowed: true, remaining: 100, resetTime: 0, totalRequests: 1 }) };
let aiResponseCache: any = { get: () => Promise.resolve(null), set: () => Promise.resolve() };
let aiCircuitBreaker: any = { execute: (fn: any) => fn() };
let workflowMetrics: any = { recordEvent: () => {}, recordMetric: () => {} };
let performanceTracker: any = { startTimer: () => {}, endTimer: () => {}, recordMetric: () => {} };

if (typeof window === 'undefined') {
  try {
    aiRateLimiter = require('@/lib/rate-limiting/ai-rate-limiter').aiRateLimiter;
    aiResponseCache = require('@/lib/caching/ai-response-cache').aiResponseCache;
    aiCircuitBreaker = require('@/lib/circuit-breaker/ai-circuit-breaker').aiCircuitBreaker;
    workflowMetrics = require('@/lib/monitoring/workflow-metrics').workflowMetrics;
    performanceTracker = require('@/lib/performance/performance-tracker').performanceTracker;
  } catch (error: any) {
    console.warn('Server-side dependencies not available, using fallbacks');
  }
}

interface UseMotivationActionsProps {
  state: {},
    briefData: BriefData | null;
  };
  dispatch: (action: any) => void;
  withErrorHandling: <T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: () => void
  ) => () => Promise<T | null>;
  userId: string;
  sessionId: string;
}

export const useMotivationActions = ({
  state,
  dispatch,
  withErrorHandling,
  userId,
  sessionId}: UseMotivationActionsProps) => {
  const { showNotification } = useNotification();
  const { makeCSRFRequest } = useCSRF();

  const generateMotivations = useCallback(async () => {
    if (!state.briefData) {
      showNotification('Brief data is required to generate motivations', 'error');
      return;
    }

    // Check rate limit before proceeding
    const rateLimitCheck = await aiRateLimiter.checkLimit(userId, 'generate-motivations');

    if (!rateLimitCheck.allowed) {
      showNotification(
        `Rate limit exceeded. Please wait ${Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000)} seconds before trying again.`,
        'warning'
      );
      return;
    }

    performanceTracker.start('workflow_generate_motivations');

    try {
      dispatch({ type: 'SET_PROCESSING', processing: true });

      const motivationOperation = async () => {
        const operationStartTime = Date.now();

        // Check cache first
        const cacheKey = { briefData: state.briefData, operation: 'generate-motivations' };
        const cachedMotivations = await aiResponseCache.get('generate-motivations', cacheKey);

        if (cachedMotivations) {
          console.log('🎯 Using cached motivations');
          return cachedMotivations;
        }

        // Pre-flight cost check
        const estimatedTokens = estimateTokensForMotivations(state.briefData!);
        const costCheck = await fetch('/api/ai/cost-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'openai',
            model: 'gpt-4o-mini',
            estimatedTokens,
            operation: 'generate-motivations'
          })
        });

        const { allowed, reason, fallbackModel, budgetRemaining } = await costCheck.json();

        if (!allowed) {
          console.warn('🚫 Motivation generation blocked by budget');
          throw new Error(`Budget limit reached: ${reason}`);
        }

        if (fallbackModel) {
          showNotification(`Using ${fallbackModel} to stay within budget ($${budgetRemaining?.toFixed(2)} remaining)`, 'info');
          console.log(`🔄 Using fallback model: ${fallbackModel}`);
        }

        // Execute with circuit breaker protection
        const response = await aiCircuitBreaker.execute(
          'openai',
          'generate-motivations',
          async () => {
            return await makeCSRFRequest('/api/flow/generate-motivations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                briefData: state.briefData,
                model: fallbackModel || 'gpt-4o-mini',
                budgetAware: true
              })});
          },
          async () => {
            // Fallback: provide generic motivations
            console.log('🔄 Using fallback motivations due to service unavailability');
            return new Response(JSON.stringify({
              success: true,
              data: [
                {
                  id: 'fallback-1',
                  title: 'Brand Awareness',
                  description: 'Increase brand recognition and visibility in the target market',
                  score: 0.8
                },
                {
                  id: 'fallback-2',
                  title: 'Customer Engagement',
                  description: 'Drive meaningful interactions with potential customers',
                  score: 0.7
                }
              ]
            }), { status: 200 });
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to generate motivations`);
        }

        const result = await response.json();

        if (result.success) {
          const motivationsWithSelection = result.data.map((motivation: any) => ({
            ...motivation,
            selected: false
          }));

          // Validate motivations before storing
          const motivationValidation = validateMotivations(motivationsWithSelection);
          if (!motivationValidation.valid) {
            throw new Error(`Motivation validation failed: ${motivationValidation.errors.join(', ')}`);
          }

          dispatch({ type: 'SET_MOTIVATIONS', motivations: motivationValidation.data || [] });
          showNotification(`Generated ${result.data.length} motivations!`, 'success');

          // Cache the result for future use
          await aiResponseCache.set('generate-motivations', cacheKey, result.data);

          // Track AI operation metrics
          await workflowMetrics.trackAIOperation(
            userId,
            sessionId,
            'generate-motivations',
            'openai',
            fallbackModel || 'gpt-4o-mini',
            estimatedTokens,
            0, // Cost would be calculated from actual usage
            Date.now() - operationStartTime,
            true
          );

          console.log(`✅ Generated ${result.data.length} motivations`);
          return result.data;
        } else {
          throw new Error(result.message || 'Failed to generate motivations');
        }
      };

      const fallback = () => {
        // Provide manual motivation entry option
        showNotification('You can manually enter motivations or try again later', 'info');
        console.log('⚠️ Motivation generation fallback triggered');
      };

      const result = await withErrorHandling(motivationOperation, 'Motivation Generation', fallback)();
      return result;
    } finally {
      dispatch({ type: 'SET_PROCESSING', processing: false });
      performanceTracker.end('workflow_generate_motivations');
    }
  }, [state.briefData, makeCSRFRequest, showNotification, withErrorHandling, sessionId, userId, dispatch]);

  const selectMotivation = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_MOTIVATION', id });
  }, [dispatch]);

  return {
    generateMotivations,
    selectMotivation};
};