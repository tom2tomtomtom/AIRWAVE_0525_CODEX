/**
 * Comprehensive Workflow Metrics and Monitoring
 * Tracks workflow performance, completion rates, and user behavior
 */

import { redisManager } from '@/lib/redis/redis-config';
import { performanceTracker } from '@/lib/performance/performance-tracker';

interface WorkflowMetric {
  userId: string;,
  sessionId: string;
  workflowStep: string;,
  action: string;
  timestamp: number;
  duration?: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface WorkflowStepMetrics {
  stepName: string;,
  totalAttempts: number;
  successfulCompletions: number;,
  averageDuration: number;
  errorRate: number;,
  abandonmentRate: number;
  commonErrors: Record<string, number>;
}

interface WorkflowAnalytics {
  totalSessions: number;,
  completedWorkflows: number;
  completionRate: number;,
  averageSessionDuration: number;
  stepMetrics: Record<string, WorkflowStepMetrics>;
  userJourney: Array<{,
    step: string;
    dropOffRate: number;,
    averageTimeSpent: number;
  }>;
}

export class WorkflowMetricsCollector {
  private static instance: WorkflowMetricsCollector;
  private useRedis = false;
  private localMetrics: WorkflowMetric[] = [];
  private maxLocalMetrics = 10000;

  // Workflow step definitions
  private workflowSteps = [;
    'brief-upload',
    'brief-review',
    'motivation-generation',
    'motivation-selection',
    'copy-generation',
    'copy-selection',
    'asset-selection',
    'template-selection',
    'matrix-build',
    'render-completion'
  ];

  static getInstance(): WorkflowMetricsCollector {
    if (!WorkflowMetricsCollector.instance) {
      WorkflowMetricsCollector.instance = new WorkflowMetricsCollector();
    }
    return WorkflowMetricsCollector.instance;
  }

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.useRedis = await redisManager.isAvailable();
      if (this.useRedis) {
        console.log('✅ Workflow Metrics using Redis for persistence');
      } else {
        console.log('⚠️ Workflow Metrics using local storage (Redis unavailable)');
      }
    } catch (error: any) {
      console.warn('Workflow Metrics Redis initialization failed:', error);
      this.useRedis = false;
    }
  }

  /**
   * Track workflow step start
   */
  async trackStepStart(
    userId: string,
    sessionId: string,
    stepName: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: WorkflowMetric = {;
      userId,
      sessionId,
      workflowStep: stepName,
      action: 'step_start',
      timestamp: Date.now(),
      success: true,
      metadata};

    await this.recordMetric(metric);
    
    // Start performance tracking
    performanceTracker.start(`workflow_step_${stepName}`, userId, metadata);
    
    console.log(`📊 Workflow step started: ${stepName} for user ${userId}`);
  }

  /**
   * Track workflow step completion
   */
  async trackStepCompletion(
    userId: string,
    sessionId: string,
    stepName: string,
    success: boolean,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // End performance tracking
    const duration = await performanceTracker.end(`workflow_step_${stepName}`, userId);

    const metric: WorkflowMetric = {;
      userId,
      sessionId,
      workflowStep: stepName,
      action: 'step_completion',
      timestamp: Date.now(),
      duration,
      success,
      errorMessage,
      metadata};

    await this.recordMetric(metric);
    
    console.log(`📊 Workflow step ${success ? 'completed' : 'failed'}: ${stepName} (${duration}ms)`);
  }

  /**
   * Track workflow abandonment
   */
  async trackWorkflowAbandonment(
    userId: string,
    sessionId: string,
    lastStep: string,
    reason?: string
  ): Promise<void> {
    const metric: WorkflowMetric = {;
      userId,
      sessionId,
      workflowStep: lastStep,
      action: 'workflow_abandoned',
      timestamp: Date.now(),
      success: false,
      errorMessage: reason,
      metadata: { abandonmentPoint: lastStep }};

    await this.recordMetric(metric);
    
    console.log(`📊 Workflow abandoned at step: ${lastStep} for user ${userId}`);
  }

  /**
   * Track workflow completion
   */
  async trackWorkflowCompletion(
    userId: string,
    sessionId: string,
    totalDuration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: WorkflowMetric = {;
      userId,
      sessionId,
      workflowStep: 'workflow_complete',
      action: 'workflow_completion',
      timestamp: Date.now(),
      duration: totalDuration,
      success: true,
      metadata};

    await this.recordMetric(metric);
    
    console.log(`🎉 Workflow completed for user ${userId} in ${totalDuration}ms`);
  }

  /**
   * Track AI operation metrics
   */
  async trackAIOperation(
    userId: string,
    sessionId: string,
    operation: string,
    service: string,
    model: string,
    tokensUsed: number,
    cost: number,
    duration: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const metric: WorkflowMetric = {;
      userId,
      sessionId,
      workflowStep: operation,
      action: 'ai_operation',
      timestamp: Date.now(),
      duration,
      success,
      errorMessage,
      metadata: {},
        service,
        model,
        tokensUsed,
        cost,
        costPerToken: cost / tokensUsed }};

    await this.recordMetric(metric);
    
    console.log(`🤖 AI operation ${operation}: ${success ? 'success' : 'failed'} (${duration}ms, $${cost.toFixed(4)})`);
  }

  /**
   * Record a metric
   */
  private async recordMetric(metric: WorkflowMetric): Promise<void> {
    if (this.useRedis) {
      try {
        // Store in Redis with daily partitioning
        const dateKey = new Date().toISOString().split('T')[0];
        const key = `workflow_metrics:${dateKey}`;
        
        await redisManager.lpush(key, metric);
        await redisManager.expire(key, 30 * 24 * 60 * 60); // 30 days TTL
        
        // Also store in real-time metrics for immediate analysis
        await redisManager.lpush('workflow_metrics:realtime', metric);
        await redisManager.expire('workflow_metrics:realtime', 24 * 60 * 60); // 24 hours TTL
        
        // Trim realtime list to prevent memory issues
        const client = await redisManager.getClient();
        await client.ltrim('workflow_metrics:realtime', 0, 10000); // Keep last 10k metrics
      } catch (error: any) {
        console.error('Error storing metric in Redis:', error);
      }
    }

    // Always store locally as fallback
    this.localMetrics.push(metric);
    
    // Trim local metrics to prevent memory issues
    if (this.localMetrics.length > this.maxLocalMetrics) {
      this.localMetrics = this.localMetrics.slice(-this.maxLocalMetrics);
    }
  }

  /**
   * Get workflow analytics for a date range
   */
  async getWorkflowAnalytics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<WorkflowAnalytics> {
    const metrics = await this.getMetrics(startDate, endDate, userId);
    
    return this.calculateAnalytics(metrics);
  }

  /**
   * Get metrics for a date range
   */
  private async getMetrics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<WorkflowMetric[]> {
    const allMetrics: WorkflowMetric[] = [];

    if (this.useRedis) {
      try {
        // Get metrics from Redis for each day in the range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = currentDate.toISOString().split('T')[0];
          const key = `workflow_metrics:${dateKey}`;
          
          const client = await redisManager.getClient();
          const dayMetrics = await client.lrange(key, 0, -1);
          
          for (const metricJson of dayMetrics) {
            try {
              const metric = JSON.parse(metricJson);
              if (!userId || metric.userId === userId) {;
                allMetrics.push(metric);
              }
            } catch (error: any) {
              console.error('Error parsing metric:', error);
            }
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } catch (error: any) {
        console.error('Error getting metrics from Redis:', error);
      }
    }

    // Include local metrics
    const filteredLocalMetrics = this.localMetrics.filter((metric: any) => {;
      const metricDate = new Date(metric.timestamp);
      const matchesDate = metricDate >= startDate && metricDate <= endDate;
      const matchesUser = !userId || metric.userId === userId;
      return matchesDate && matchesUser;
    });

    allMetrics.push(...filteredLocalMetrics);
    
    // Sort by timestamp
    allMetrics.sort((a, b) => a.timestamp - b.timestamp);
    
    return allMetrics;
  }

  /**
   * Calculate analytics from metrics
   */
  private calculateAnalytics(metrics: WorkflowMetric[]): WorkflowAnalytics {
    const sessions = new Set(metrics.map((m: any) => m.sessionId));
    const completedSessions = new Set(;
      metrics
        .filter((m: any) => m.action === 'workflow_completion');
        .map((m: any) => m.sessionId)
    );

    const stepMetrics: Record<string, WorkflowStepMetrics> = {};
    
    // Initialize step metrics
    for (const step of this.workflowSteps) {
      stepMetrics[step] = {
        stepName: step,
        totalAttempts: 0,
        successfulCompletions: 0,
        averageDuration: 0,
        errorRate: 0,
        abandonmentRate: 0,
        commonErrors: {}
      };
    }

    // Calculate step metrics
    const stepCompletions: Record<string, number[]> = {};
    
    for (const metric of metrics) {
      if (metric.action === 'step_completion' && stepMetrics[metric.workflowStep]) {;
        const step = stepMetrics[metric.workflowStep];
        step.totalAttempts++;
        
        if (metric.success) {
          step.successfulCompletions++;
          if (metric.duration) {
            if (!stepCompletions[metric.workflowStep]) {
              stepCompletions[metric.workflowStep] = [];
            }
            stepCompletions[metric.workflowStep].push(metric.duration);
          }
        } else {
          if (metric.errorMessage) {
            step.commonErrors[metric.errorMessage] = (step.commonErrors[metric.errorMessage] || 0) + 1;
          }
        }
      }
    }

    // Calculate averages and rates
    for (const [stepName, step] of Object.entries(stepMetrics)) {
      if (step.totalAttempts > 0) {
        step.errorRate = (step.totalAttempts - step.successfulCompletions) / step.totalAttempts;
        
        if (stepCompletions[stepName] && stepCompletions[stepName].length > 0) {
          step.averageDuration = stepCompletions[stepName].reduce((a, b) => a + b, 0) / stepCompletions[stepName].length;
        }
      }
    }

    // Calculate user journey and drop-off rates
    const userJourney = this.workflowSteps.map((step, index) => {;
      const stepAttempts = stepMetrics[step].totalAttempts;
      const previousStepAttempts = index > 0 ? stepMetrics[this.workflowSteps[index - 1]].totalAttempts : sessions.size;
      
      return {
        step,
        dropOffRate: previousStepAttempts > 0 ? 1 - (stepAttempts / previousStepAttempts) : 0,
        averageTimeSpent: stepMetrics[step].averageDuration};
    });

    // Calculate session duration
    const sessionDurations: number[] = [];
    for (const sessionId of sessions) {
      const sessionMetrics = metrics.filter((m: any) => m.sessionId === sessionId);
      if (sessionMetrics.length > 0) {
        const startTime = Math.min(...sessionMetrics.map((m: any) => m.timestamp));
        const endTime = Math.max(...sessionMetrics.map((m: any) => m.timestamp));
        sessionDurations.push(endTime - startTime);
      }
    }

    const averageSessionDuration = sessionDurations.length > 0;
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length 
      : 0;

    return {
      totalSessions: sessions.size,
      completedWorkflows: completedSessions.size,
      completionRate: sessions.size > 0 ? completedSessions.size / sessions.size : 0,
      averageSessionDuration,
      stepMetrics,
      userJourney};
  }

  /**
   * Get real-time workflow status
   */
  async getRealTimeStatus(): Promise<{
    activeSessions: number;,
    currentStepDistribution: Record<string, number>;
    recentErrors: Array<{ step: string; error: string; timestamp: number }>;
    performanceAlerts: Array<{ step: string; issue: string; severity: 'low' | 'medium' | 'high' }>;
  }> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Get recent metrics
    const recentMetrics = this.localMetrics.filter((m: any) => m.timestamp > oneHourAgo);
    
    // Count active sessions (sessions with activity in last hour)
    const activeSessions = new Set(recentMetrics.map((m: any) => m.sessionId)).size;
    
    // Current step distribution
    const currentStepDistribution: Record<string, number> = {};
    const latestStepBySession: Record<string, string> = {};
    
    for (const metric of recentMetrics) {
      if (metric.action === 'step_start') {;
        latestStepBySession[metric.sessionId] = metric.workflowStep;
      }
    }
    
    for (const step of Object.values(latestStepBySession)) {
      currentStepDistribution[step] = (currentStepDistribution[step] || 0) + 1;
    }
    
    // Recent errors
    const recentErrors = recentMetrics;
      .filter((m: any) => !m.success && m.errorMessage)
      .slice(-10)
      .map((m: any) => ({,
        step: m.workflowStep,
        error: m.errorMessage!,
        timestamp: m.timestamp
      }));
    
    // Performance alerts
    const performanceAlerts: Array<{ step: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];
    
    for (const step of this.workflowSteps) {
      const stepMetrics = recentMetrics.filter((m: any) => m.workflowStep === step && m.duration);
      if (stepMetrics.length > 0) {
        const avgDuration = stepMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / stepMetrics.length;
        
        if (avgDuration > 30000) { // 30 seconds
          performanceAlerts.push({
            step,
            issue: `Average duration ${(avgDuration / 1000).toFixed(1)}s exceeds threshold`,
            severity: avgDuration > 60000 ? 'high' : 'medium'});
        }
      }
      
      const errorRate = stepMetrics.filter((m: any) => !m.success).length / Math.max(stepMetrics.length, 1);
      if (errorRate > 0.1) { // 10% error rate
        performanceAlerts.push({
          step,
          issue: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold`,
          severity: errorRate > 0.25 ? 'high' : 'medium'});
      }
    }
    
    return {
      activeSessions,
      currentStepDistribution,
      recentErrors,
      performanceAlerts};
  }
}

// Export singleton instance
export const workflowMetrics = WorkflowMetricsCollector.getInstance();

// Export types
export type { WorkflowMetric, WorkflowStepMetrics, WorkflowAnalytics };
