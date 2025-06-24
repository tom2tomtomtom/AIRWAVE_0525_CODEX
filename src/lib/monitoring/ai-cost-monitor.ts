/**
 * Real-time AI Cost Monitoring and Alerting
 * Tracks AI usage costs and provides real-time alerts
 */

import { redisManager } from '@/lib/redis/redis-config';
import { ProductionAICostController } from '@/lib/ai/production-cost-controller';

interface CostAlert {
  id: string;
  userId: string;
  service: string;
  alertType: 'threshold' | 'emergency' | 'daily_limit' | 'monthly_limit';
  message: string;
  currentUsage: number;
  budgetLimit: number;
  percentUsed: number;
  timestamp: number;
  acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface CostMetrics {
  service: string;
  currentUsage: number;
  budgetLimit: number;
  percentUsed: number;
  remainingBudget: number;
  projectedMonthlyUsage: number;
  averageDailyCost: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  lastUpdated: number;
}

interface AlertThresholds {
  warning: number; // 80%
  critical: number; // 90%
  emergency: number; // 95%
}

export class AICostMonitor {
  private static instance: AICostMonitor;
  private costController: ProductionAICostController;
  private useRedis = false;
  private localAlerts: CostAlert[] = [];

  // Alert thresholds (percentages)
  private alertThresholds: AlertThresholds = {
    warning: 0.8, // 80%
    critical: 0.9, // 90%
    emergency: 0.95, // 95%
  };

  // Service budget limits (monthly)
  private budgetLimits = {
    openai: 1000,
    anthropic: 500,
    elevenlabs: 300 };

  static getInstance(): AICostMonitor {
    if (!AICostMonitor.instance) {
      AICostMonitor.instance = new AICostMonitor();
    }
    return AICostMonitor.instance;
  }

  constructor() {
    this.costController = ProductionAICostController.getInstance();
    this.initializeRedis();
    this.startMonitoring();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.useRedis = await redisManager.isAvailable();
      if (this.useRedis) {
        console.log('✅ AI Cost Monitor using Redis for persistence');
      } else {
        console.log('⚠️ AI Cost Monitor using local storage (Redis unavailable)');
      }
    } catch (error: any) {
      console.warn('AI Cost Monitor Redis initialization failed:', error);
      this.useRedis = false;
    }
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    // Check costs every 5 minutes
    setInterval(
      async () => {
        await this.checkAllUserCosts();
      },
      5 * 60 * 1000
    );

    // Daily summary at midnight
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        await this.generateDailySummary();
      }
    }, 60 * 1000); // Check every minute for midnight
  }

  /**
   * Track AI operation cost in real-time
   */
  async trackOperation(
    userId: string,
    service: string,
    model: string,
    operation: string,
    tokensUsed: number,
    cost: number
  ): Promise<void> {
    // Record the usage
    await this.costController.trackUsage(service, model, operation, tokensUsed, cost, userId);

    // Check if this triggers any alerts
    await this.checkUserCosts(userId, service);

    // Update real-time metrics
    await this.updateRealTimeMetrics(userId, service, cost);

    console.log(`💰 Tracked AI cost: ${service}/${model} - $${cost.toFixed(4)} for user ${userId}`);
  }

  /**
   * Check costs for a specific user and service
   */
  async checkUserCosts(userId: string, service: string): Promise<void> {
    try {
      const usage = await this.costController.getMonthlyUsage(service, userId);
      const budget = this.budgetLimits[service as keyof typeof this.budgetLimits] || 1000;
      const percentUsed = (usage.totalCost / budget) * 100;

      // Check alert thresholds
      if (percentUsed >= this.alertThresholds.emergency * 100) {
        await this.createAlert(userId, service, 'emergency', usage.totalCost, budget, percentUsed);
      } else if (percentUsed >= this.alertThresholds.critical * 100) {
        await this.createAlert(
          userId,
          service,
          'monthly_limit',
          usage.totalCost,
          budget,
          percentUsed
        );
      } else if (percentUsed >= this.alertThresholds.warning * 100) {
        await this.createAlert(userId, service, 'threshold', usage.totalCost, budget, percentUsed);
      }
    } catch (error: any) {
      console.error('Error checking user costs:', error);
    }
  }

  /**
   * Check costs for all users
   */
  async checkAllUserCosts(): Promise<void> {
    try {
      // This would typically query all active users from the database
      // For now, we'll check users who have recent activity
      const activeUsers = await this.getActiveUsers();

      for (const userId of activeUsers) {
        for (const service of Object.keys(this.budgetLimits)) {
          await this.checkUserCosts(userId, service);
        }
      }
    } catch (error: any) {
      console.error('Error checking all user costs:', error);
    }
  }

  /**
   * Create a cost alert
   */
  private async createAlert(
    userId: string,
    service: string,
    alertType: CostAlert['alertType'],
    currentUsage: number,
    budgetLimit: number,
    percentUsed: number
  ): Promise<void> {
    // Check if we already have a recent unacknowledged alert
    const recentAlert = await this.getRecentAlert(userId, service, alertType);
    if (recentAlert) {
      return; // Don't spam alerts
    }

    const severity = this.determineSeverity(percentUsed);
    const message = this.generateAlertMessage(
      service,
      alertType,
      percentUsed,
      currentUsage,
      budgetLimit
    );

    const alert: CostAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      service,
      alertType,
      message,
      currentUsage,
      budgetLimit,
      percentUsed,
      timestamp: Date.now(),
      acknowledged: false,
      severity};

    await this.storeAlert(alert);
    await this.sendAlert(alert);

    console.warn(`🚨 Cost alert created: ${alert.message}`);
  }

  /**
   * Determine alert severity based on percentage used
   */
  private determineSeverity(percentUsed: number): CostAlert['severity'] {
    if (percentUsed >= 95) return 'critical';
    if (percentUsed >= 90) return 'high';
    if (percentUsed >= 80) return 'medium';
    return 'low';
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    service: string,
    alertType: CostAlert['alertType'],
    percentUsed: number,
    currentUsage: number,
    budgetLimit: number
  ): string {
    const remaining = budgetLimit - currentUsage;

    switch (alertType) {
      case 'emergency':
        return `🚨 EMERGENCY: ${service.toUpperCase()} usage at ${percentUsed.toFixed(1)}% of monthly budget! Only $${remaining.toFixed(2)} remaining.`;
      case 'monthly_limit':
        return `⚠️ CRITICAL: ${service.toUpperCase()} usage at ${percentUsed.toFixed(1)}% of monthly budget ($${currentUsage.toFixed(2)}/$${budgetLimit}).`;
      case 'threshold':
        return `📊 WARNING: ${service.toUpperCase()} usage at ${percentUsed.toFixed(1)}% of monthly budget. $${remaining.toFixed(2)} remaining.`;
      case 'daily_limit':
        return `📅 Daily usage limit reached for ${service.toUpperCase()}. Consider optimizing usage.`;
      default:
        return `Cost alert for ${service}: ${percentUsed.toFixed(1)}% of budget used.`;
    }
  }

  /**
   * Store alert
   */
  private async storeAlert(alert: CostAlert): Promise<void> {
    if (this.useRedis) {
      try {
        await redisManager.lpush('ai_cost_alerts', alert);
        await redisManager.expire('ai_cost_alerts', 30 * 24 * 60 * 60); // 30 days TTL

        // Also store by user for quick lookup
        await redisManager.lpush(`ai_cost_alerts:${alert.userId}`, alert);
        await redisManager.expire(`ai_cost_alerts:${alert.userId}`, 30 * 24 * 60 * 60);
      } catch (error: any) {
        console.error('Error storing alert in Redis:', error);
      }
    }

    // Always store locally as fallback
    this.localAlerts.push(alert);

    // Trim local alerts to prevent memory issues
    if (this.localAlerts.length > 1000) {
      this.localAlerts = this.localAlerts.slice(-1000);
    }
  }

  /**
   * Send alert (integrate with notification system)
   */
  private async sendAlert(alert: CostAlert): Promise<void> {
    // TODO: Integrate with actual notification system (email, Slack, etc.)
    console.log(`📧 Alert sent: ${alert.message}`);

    // For now, just log to console
    if (alert.severity === 'critical') {
      console.error(`CRITICAL ALERT: ${alert.message}`);
    } else if (alert.severity === 'high') {
      console.warn(`HIGH ALERT: ${alert.message}`);
    }
  }

  /**
   * Get recent alert for user/service/type
   */
  private async getRecentAlert(
    userId: string,
    service: string,
    alertType: CostAlert['alertType']
  ): Promise<CostAlert | null> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    if (this.useRedis) {
      try {
        const client = await redisManager.getClient();
        const alerts = await client.lrange(`ai_cost_alerts:${userId}`, 0, 50);

        for (const alertJson of alerts) {
          try {
            const alert = JSON.parse(alertJson);
            if (
              alert.service === service &&
              alert.alertType === alertType &&
              alert.timestamp > oneHourAgo &&
              !alert.acknowledged
            ) {
              return alert;
            }
          } catch (error: any) {
            console.error('Error parsing alert:', error);
          }
        }
      } catch (error: any) {
        console.error('Error getting recent alerts from Redis:', error);
      }
    }

    // Check local alerts
    return (
      this.localAlerts.find(
        (alert: any) =>
          alert.userId === userId &&
          alert.service === service &&
          alert.alertType === alertType &&
          alert.timestamp > oneHourAgo &&
          !alert.acknowledged
      ) || null
    );
  }

  /**
   * Get active users (users with recent AI activity)
   */
  private async getActiveUsers(): Promise<string[]> {
    // This would typically query the database for users with recent activity
    // For now, return a placeholder
    return ['anonymous']; // TODO: Implement actual user query
  }

  /**
   * Update real-time metrics
   */
  private async updateRealTimeMetrics(
    userId: string,
    service: string,
    cost: number
  ): Promise<void> {
    if (this.useRedis) {
      try {
        const key = `ai_cost_realtime:${userId}:${service}`;
        await redisManager.incrby(key, Math.round(cost * 10000)); // Store as cents * 100 for precision
        await redisManager.expire(key, 24 * 60 * 60); // 24 hours TTL
      } catch (error: any) {
        console.error('Error updating real-time metrics:', error);
      }
    }
  }

  /**
   * Get cost metrics for a user and service
   */
  async getCostMetrics(userId: string, service: string): Promise<CostMetrics> {
    const usage = await this.costController.getMonthlyUsage(service, userId);
    const budget = this.budgetLimits[service as keyof typeof this.budgetLimits] || 1000;
    const percentUsed = (usage.totalCost / budget) * 100;
    const remainingBudget = budget - usage.totalCost;

    // Calculate daily average and projection
    const now = new Date();
    const dayOfMonth = now.getDate();
    const averageDailyCost = dayOfMonth > 0 ? usage.totalCost / dayOfMonth : 0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthlyUsage = averageDailyCost * daysInMonth;

    // Determine trend (simplified)
    const trend: CostMetrics['trend'] = projectedMonthlyUsage > budget ? 'increasing' : 'stable';

    return {
      service,
      currentUsage: usage.totalCost,
      budgetLimit: budget,
      percentUsed,
      remainingBudget,
      projectedMonthlyUsage,
      averageDailyCost,
      trend,
      lastUpdated: Date.now() };
  }

  /**
   * Get all alerts for a user
   */
  async getUserAlerts(userId: string, limit: number = 50): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];

    if (this.useRedis) {
      try {
        const client = await redisManager.getClient();
        const alertsJson = await client.lrange(`ai_cost_alerts:${userId}`, 0, limit - 1);

        for (const alertJson of alertsJson) {
          try {
            alerts.push(JSON.parse(alertJson));
          } catch (error: any) {
            console.error('Error parsing alert:', error);
          }
        }
      } catch (error: any) {
        console.error('Error getting user alerts from Redis:', error);
      }
    }

    // Include local alerts
    const localUserAlerts = this.localAlerts
      .filter((alert: any) => alert.userId === userId)
      .slice(-limit);

    alerts.push(...localUserAlerts);

    // Sort by timestamp (newest first) and deduplicate
    const uniqueAlerts = alerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

    return uniqueAlerts;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    // Update in Redis if available
    if (this.useRedis) {
      try {
        // This would require a more complex Redis structure to update specific alerts
        // For now, we'll just mark it in local storage
      } catch (error: any) {
        console.error('Error acknowledging alert in Redis:', error);
      }
    }

    // Update local alerts
    const alert = this.localAlerts.find((a: any) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ Alert acknowledged: ${alertId}`);
      return true;
    }

    return false;
  }

  /**
   * Generate daily summary
   */
  private async generateDailySummary(): Promise<void> {
    console.log('📊 Generating daily AI cost summary...');

    // This would generate and send daily cost summaries
    // TODO: Implement actual daily summary generation
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(userId: string): Promise<{
    metrics: Record<string, CostMetrics>;
    recentAlerts: CostAlert[];
    totalSpent: number;
    totalBudget: number;
    overallPercentUsed: number;
  }> {
    const metrics: Record<string, CostMetrics> = {};
    let totalSpent = 0;
    let totalBudget = 0;

    // Get metrics for each service
    for (const service of Object.keys(this.budgetLimits)) {
      const serviceMetrics = await this.getCostMetrics(userId, service);
      metrics[service] = serviceMetrics;
      totalSpent += serviceMetrics.currentUsage;
      totalBudget += serviceMetrics.budgetLimit;
    }

    const recentAlerts = await this.getUserAlerts(userId, 10);
    const overallPercentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      metrics,
      recentAlerts,
      totalSpent,
      totalBudget,
      overallPercentUsed};
  }
}

// Export singleton instance
export const aiCostMonitor = AICostMonitor.getInstance();

// Export types
export type { CostAlert, CostMetrics, AlertThresholds };
