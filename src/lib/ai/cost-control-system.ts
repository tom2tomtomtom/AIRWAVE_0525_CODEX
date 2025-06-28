export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  fallbackModel?: string;
  budgetRemaining?: number;
  usageStats?: {
    percentOfBudget: number;
  };
}

export interface UsageTrackingResult {
  success: boolean;
  totalCost?: number;
  remainingBudget?: number;
  error?: string;
}

export interface ServiceUsageStats {
  used: number;
  budget: number;
  percentUsed: number;
  remainingBudget: number;
}

export interface UsageStats {
  openai: ServiceUsageStats;
  anthropic: ServiceUsageStats;
  elevenlabs: ServiceUsageStats;
}

export interface EmergencyShutdownResult {
  success: boolean;
  shutdownTriggered: boolean;
  reason?: string;
}

export class AICostController {
  private static instance: AICostController;

  private constructor() {}

  static getInstance(): AICostController {
    if (!AICostController.instance) {
      AICostController.instance = new AICostController();
    }
    return AICostController.instance;
  }

  async checkBudget(
    service: string,
    model: string,
    estimatedTokens: number,
    userId: string
  ): Promise<BudgetCheckResult> {
    try {
      const response = await fetch('/api/ai/cost-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service,
          model,
          estimatedTokens,
          userId,
        }),
      });

      if (!response.ok) {
        return {
          allowed: false,
          reason: `Cost check failed: HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      return {
        allowed: false,
        reason: `Cost check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async trackUsage(
    service: string,
    model: string,
    tokens: number,
    cost: number,
    userId: string
  ): Promise<UsageTrackingResult> {
    try {
      const response = await fetch('/api/ai/track-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service,
          model,
          tokens,
          cost,
          userId,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Usage tracking failed: HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: `Usage tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getUsageStats(userId: string): Promise<UsageStats> {
    try {
      const response = await fetch(`/api/ai/usage-stats?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const stats = await response.json();
      return stats;
    } catch (error: any) {
      throw new Error(
        `Failed to get usage stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async emergencyShutdown(userId: string, reason: string): Promise<EmergencyShutdownResult> {
    try {
      const response = await fetch('/api/ai/emergency-shutdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reason,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          shutdownTriggered: false,
          reason: `Emergency shutdown failed: HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      return {
        success: false,
        shutdownTriggered: false,
        reason: `Emergency shutdown failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Pre-flight check with automatic fallback
  async performPreflightCheck(
    service: string,
    model: string,
    estimatedTokens: number,
    userId: string,
    operation: string
  ): Promise<{ proceed: boolean; model: string; reason?: string }> {
    const budgetCheck = await this.checkBudget(service, model, estimatedTokens, userId);

    if (!budgetCheck.allowed) {
      console.warn(`[AICostController] ${operation} blocked:`, budgetCheck.reason);
      return {
        proceed: false,
        model,
        ...(budgetCheck.reason && { reason: budgetCheck.reason }),
      };
    }

    // Use fallback model if suggested
    const finalModel = budgetCheck.fallbackModel || model;

    if (budgetCheck.fallbackModel) {
      console.info(`[AICostController] Using fallback model ${finalModel} for ${operation}`);
    }

    return {
      proceed: true,
      model: finalModel,
    };
  }

  // Post-operation tracking
  async trackOperationUsage(
    service: string,
    model: string,
    actualTokens: number,
    cost: number,
    userId: string,
    operation: string
  ): Promise<void> {
    const trackingResult = await this.trackUsage(service, model, actualTokens, cost, userId);

    if (!trackingResult.success) {
      console.error(
        `[AICostController] Failed to track usage for ${operation}:`,
        trackingResult.error
      );
    } else {
      console.info(
        `[AICostController] Tracked ${operation}: ${actualTokens} tokens, $${cost.toFixed(4)}`
      );
    }
  }

  // Budget monitoring with alerts
  async checkBudgetHealth(userId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    alerts: string[];
    recommendations: string[];
  }> {
    try {
      const stats = await this.getUsageStats(userId);
      const alerts: string[] = [];
      const recommendations: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Check each service
      Object.entries(stats).forEach(([service, serviceStats]) => {
        if (serviceStats.percentUsed >= 90) {
          status = 'critical';
          alerts.push(
            `${service} budget at ${serviceStats.percentUsed.toFixed(1)}% - immediate action required`
          );
          recommendations.push(`Consider upgrading ${service} budget or reducing usage`);
        } else if (serviceStats.percentUsed >= 75) {
          if (status !== 'critical') status = 'warning';
          alerts.push(
            `${service} budget at ${serviceStats.percentUsed.toFixed(1)}% - monitor closely`
          );
          recommendations.push(`Review ${service} usage patterns and optimize if possible`);
        }
      });

      return { status, alerts, recommendations };
    } catch (error: any) {
      return {
        status: 'critical',
        alerts: ['Unable to check budget health'],
        recommendations: ['Check system connectivity and try again'],
      };
    }
  }
}
