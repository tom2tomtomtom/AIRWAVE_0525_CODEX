/**
 * Production AI Cost Controller
 * Real implementation with database persistence and budget enforcement
 */

import { supabase } from '@/lib/supabase';
import { estimateCost } from '@/utils/ai-cost-estimation';
import { loggers } from '@/lib/logger';


interface BudgetConfig {
  openai: number;
  anthropic: number;
  elevenlabs: number;
}

interface UsageRecord {
  id: string;
  user_id: string;
  service: 'openai' | 'anthropic' | 'elevenlabs';
  model: string;
  operation: string;
  tokens_used: number;
  cost: number;
  created_at: string;
  metadata?: Record<string, any>;
}

interface MonthlyUsage {
  totalCost: number;
  totalTokens: number;
  callCount: number;
}

export class ProductionAICostController {
  private static instance: ProductionAICostController;
  private budgetConfig: BudgetConfig = {
    openai: 1000, // $1000/month
    anthropic: 500, // $500/month
    elevenlabs: 300, // $300/month
  };

  static getInstance(): ProductionAICostController {
    if (!ProductionAICostController.instance) {
      ProductionAICostController.instance = new ProductionAICostController();
    }
    return ProductionAICostController.instance;
  }

  /**
   * Check if user can proceed with AI operation within budget
   */
  async checkBudget(
    service: string,
    model: string,
    tokens: number,
    userId: string
  ): Promise<{
    allowed: boolean;
    budgetRemaining: number;
    currentUsage: number;
    reason?: string;
    fallbackModel?: string;
  }> {
    try {
      // Get current month's usage
      const monthlyUsage = await this.getMonthlyUsage(service, userId);
      const budget = this.budgetConfig[service as keyof BudgetConfig] || 1000;
      const estimatedCost = estimateCost(service as any, model, tokens);

      const budgetRemaining = budget - monthlyUsage.totalCost;
      const wouldExceedBudget = estimatedCost > budgetRemaining;

      // Check for emergency shutdown conditions
      const percentUsed = (monthlyUsage.totalCost / budget) * 100;
      if (percentUsed >= 95) {
        return {
          allowed: false,
          budgetRemaining,
          currentUsage: monthlyUsage.totalCost,
          reason: 'Monthly budget 95% exhausted - emergency shutdown activated',
        };
      }

      // If would exceed budget, try to suggest fallback model
      if (wouldExceedBudget) {
        const fallbackModel = this.getFallbackModel(service, model);
        if (fallbackModel) {
          const fallbackCost = estimateCost(service as any, fallbackModel, tokens);
          if (fallbackCost <= budgetRemaining) {
            return {
              allowed: true,
              budgetRemaining,
              currentUsage: monthlyUsage.totalCost,
              reason: 'Using fallback model to stay within budget',
              fallbackModel,
            };
          }
        }

        return {
          allowed: false,
          budgetRemaining,
          currentUsage: monthlyUsage.totalCost,
          reason: `Operation would exceed monthly budget. Estimated cost: $${estimatedCost.toFixed(2)}, Remaining: $${budgetRemaining.toFixed(2)}`,
        };
      }

      // Budget check passed
      return {
        allowed: true,
        budgetRemaining,
        currentUsage: monthlyUsage.totalCost,
        reason: 'Budget check passed',
      };
    } catch (error: any) {
      console.error('Budget check failed:', error);
      return {
        allowed: false,
        budgetRemaining: 0,
        currentUsage: 0,
        reason: 'Budget check service unavailable',
      };
    }
  }

  /**
   * Get monthly usage for a service and user
   */
  async getMonthlyUsage(service: string, userId: string): Promise<MonthlyUsage> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('ai_usage_tracking')
        .select('tokens_used, cost')
        .eq('user_id', userId)
        .eq('service', service)
        .gte('created_at', startOfMonth.toISOString());

      if (error) {
        console.error('Failed to get monthly usage:', error);
        return { totalCost: 0, totalTokens: 0, callCount: 0 };
      }

      const totalCost = data?.reduce((sum, record) => sum + (record.cost || 0), 0) || 0;
      const totalTokens = data?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0;
      const callCount = data?.length || 0;

      return { totalCost, totalTokens, callCount };
    } catch (error: any) {
      console.error('Error getting monthly usage:', error);
      return { totalCost: 0, totalTokens: 0, callCount: 0 };
    }
  }

  /**
   * Track actual usage after AI operation completes
   */
  async trackUsage(
    service: string,
    model: string,
    operation: string,
    tokens: number,
    cost: number,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('ai_usage_tracking').insert({
        user_id: userId,
        service,
        model,
        operation,
        tokens_used: tokens,
        cost,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Failed to track usage:', error);
        return false;
      }

      console.log(
        `✅ Tracked AI usage: ${service}/${model} - ${tokens} tokens, $${cost.toFixed(4)}`
      );
      return true;
    } catch (error: any) {
      console.error('Error tracking usage:', error);
      return false;
    }
  }

  /**
   * Get full budget report for user
   */
  async getFullReport(userId: string): Promise<void> {
    const services = ['openai', 'anthropic', 'elevenlabs'] as const;
    const report: any = { services: {} };

    for (const service of services) {
      const usage = await this.getMonthlyUsage(service, userId);
      const budget = this.budgetConfig[service];

      report.services[service] = {
        budget,
        used: usage.totalCost,
        remaining: budget - usage.totalCost,
        percentUsed: (usage.totalCost / budget) * 100,
        callCount: usage.callCount,
        totalTokens: usage.totalTokens,
      };
    }

    return report;
  }

  /**
   * Get fallback model for budget constraints
   */
  private getFallbackModel(service: string, model: string): string | undefined {
    const fallbacks: Record<string, Record<string, string>> = {
      openai: {
        'gpt-4': 'gpt-4o-mini',
        'gpt-4o': 'gpt-4o-mini',
        'gpt-4-turbo': 'gpt-4o-mini',
      },
      anthropic: {
        'claude-3-opus': 'claude-3-sonnet',
        'claude-3-sonnet': 'claude-3-haiku',
      },
    };

    return fallbacks[service]?.[model];
  }

  /**
   * Emergency budget shutdown check
   */
  async checkEmergencyShutdown(userId: string): Promise<boolean> {
    const report = await this.getFullReport(userId);

    // Check if any service has exceeded 95% of budget
    for (const [service, stats] of Object.entries(report.services)) {
      if ((stats as any).percentUsed >= 95) {
        console.warn(
          `🚨 Emergency shutdown triggered for ${service}: ${(stats as any).percentUsed.toFixed(1)}% budget used`
        );
        return true;
      }
    }

    return false;
  }
}
