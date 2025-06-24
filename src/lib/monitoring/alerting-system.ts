/**
 * Comprehensive Alerting System for AIRWAVE
 * Handles alert rules, notifications, and escalation procedures
 * Supports multiple notification channels and smart alerting logic
 */

import { metrics } from './metrics-collector';

// Alert severity levels
export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'}

// Alert states
export enum AlertState {
  FIRING = 'firing',
  RESOLVED = 'resolved',
  ACKNOWLEDGED = 'acknowledged',
  SILENCED = 'silenced'}

// Alert rule configuration
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  evaluation: {},
  intervalSeconds: number;
    forDuration: number; // How long condition must be true
  };
  notifications: NotificationConfig[];
  runbook?: string;
  tags?: Record<string, string>;
  enabled: boolean;
}

// Alert condition types
export interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'absence' | 'change';
  metric: string;
  operator: '>' | '<' | '=' | '!=' | '>=' | '<=';
  value: number;
  timeWindow: number; // seconds
  aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'count';
}

// Notification configuration
export interface NotificationConfig {
  channel: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms';
  target: string;
  template?: string;
  conditions?: {
    severity?: AlertSeverity[];
    tags?: Record<string, string>;
    timeRange?: { start: string; end: string }; // Quiet hours
  };
}

// Active alert
export interface Alert {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  state: AlertState;
  value: number;
  threshold: number;
  firstSeen: Date;
  lastSeen: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// Notification channels
export abstract class NotificationChannel {
  abstract name: string;
  abstract send(alert: Alert, config: NotificationConfig): Promise<boolean>;
  abstract healthCheck(): Promise<boolean>;
}

// Email notification channel
class EmailNotificationChannel extends NotificationChannel {
  name = 'email';

  async send(alert: Alert, config: NotificationConfig): Promise<boolean> {
    try {
      // Implementation would integrate with your email service
      const emailContent = this.formatEmailContent(alert);
      
      // Mock implementation - replace with actual email service
      console.log(`[EMAIL] Sending alert to ${config.target}:`, emailContent);
      
      return true;
    } catch (error) {
      console.error('Failed to send email alert:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check email service health
    return true;
  }

  private formatEmailContent(alert: Alert): string {
    return `
      Subject: [AIRWAVE ${alert.severity.toUpperCase()}] ${alert.name}
      ,
  Alert: ${alert.name},
  Severity: ${alert.severity},
  Description: ${alert.description}
      Current Value: ${alert.value},
  Threshold: ${alert.threshold}
      ,
  Time: ${alert.lastSeen.toISOString()}
      
      ${alert.annotations.runbook ? `Runbook: ${alert.annotations.runbook}` : ''}
    `;
  }
}

// Slack notification channel
class SlackNotificationChannel extends NotificationChannel {
  name = 'slack';

  async send(alert: Alert, config: NotificationConfig): Promise<boolean> {
    try {
      const slackPayload = this.formatSlackPayload(alert);
      
      const response = await fetch(config.target, {
        method: 'POST',
        headers: {},
        'Content-Type': 'application/json' 
      },
        body: JSON.stringify(slackPayload)});

      return response.ok;
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private formatSlackPayload(alert: Alert) {
    const color = this.getSeverityColor(alert.severity);
    
    return {
      attachments: [
        {
          color,
          title: `${alert.severity.toUpperCase()}: ${alert.name}`,
          text: alert.description,
          fields: [
            {
              title: 'Current Value',
              value: alert.value.toString(),
              short: true }
            {
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true }
            {
              title: 'Time',
              value: alert.lastSeen.toISOString(),
              short: false }
          ],
          footer: 'AIRWAVE Monitoring',
          ts: Math.floor(alert.lastSeen.getTime() / 1000) }
      ]};
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'danger';
      case AlertSeverity.HIGH:
        return 'warning';
      case AlertSeverity.MEDIUM:
        return '#ffeb3b';
      case AlertSeverity.LOW:
        return 'good';
      case AlertSeverity.INFO:
        return '#2196f3';
      default:
        return 'good';
    }
  }
}

// Webhook notification channel
class WebhookNotificationChannel extends NotificationChannel {
  name = 'webhook';

  async send(alert: Alert, config: NotificationConfig): Promise<boolean> {
    try {
      const payload = {
        alert,
        timestamp: new Date().toISOString(),
        service: 'airwave-web'};

      const response = await fetch(config.target, {
        method: 'POST',
        headers: {},
        'Content-Type': 'application/json' 
      },
        body: JSON.stringify(payload)});

      return response.ok;
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// Main alerting system class
export class AlertingSystem {
  private static instance: AlertingSystem;
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private channels: Map<string, NotificationChannel> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private metricHistory: Map<string, Array<{ value: number; timestamp: number }>> = new Map();

  private constructor() {
    this.initializeChannels();
    this.loadDefaultRules();
    this.startEvaluation();
  }

  static getInstance(): AlertingSystem {
    if (!AlertingSystem.instance) {
      AlertingSystem.instance = new AlertingSystem();
    }
    return AlertingSystem.instance;
  }

  private initializeChannels(): void {
    this.channels.set('email', new EmailNotificationChannel());
    this.channels.set('slack', new SlackNotificationChannel());
    this.channels.set('webhook', new WebhookNotificationChannel());
  }

  private loadDefaultRules(): void {
    // Critical system health alerts
    this.addRule({
      id: 'high-error-rate',
      name: 'High API Error Rate',
      description: 'API error rate exceeds 5% over 5 minutes',
      severity: AlertSeverity.HIGH,
      condition: {},
  type: 'threshold',
        metric: 'api.requests.error_rate',
        operator: '>',
        value: 0.05,
        timeWindow: 300,
        aggregation: 'avg' },
  evaluation: {},
  intervalSeconds: 60,
        forDuration: 300 },
  notifications: [
        {
          channel: 'email',
          target: process.env.ALERT_EMAIL || 'admin@airwave.com' }
        {
          channel: 'slack',
          target: process.env.SLACK_WEBHOOK_URL || '',
          conditions: { severity: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] }},
      ],
      runbook: 'https://docs.airwave.com/runbooks/high-error-rate',
      enabled: true});

    this.addRule({
      id: 'database-connection-failure',
      name: 'Database Connection Failure',
      description: 'Database connection health check failing',
      severity: AlertSeverity.CRITICAL,
      condition: {},
  type: 'threshold',
        metric: 'system.health.database',
        operator: '<',
        value: 1,
        timeWindow: 60,
        aggregation: 'avg' },
  evaluation: {},
  intervalSeconds: 30,
        forDuration: 60 },
  notifications: [
        {
          channel: 'email',
          target: process.env.ALERT_EMAIL || 'admin@airwave.com' }
        {
          channel: 'slack',
          target: process.env.SLACK_WEBHOOK_URL || '' }
      ],
      runbook: 'https://docs.airwave.com/runbooks/database-failure',
      enabled: true});

    this.addRule({
      id: 'ai-budget-threshold',
      name: 'AI Budget Threshold Exceeded',
      description: 'Monthly AI budget usage exceeds 80%',
      severity: AlertSeverity.MEDIUM,
      condition: {},
  type: 'threshold',
        metric: 'ai.budget.usage_percent',
        operator: '>',
        value: 0.8,
        timeWindow: 3600,
        aggregation: 'max' },
  evaluation: {},
  intervalSeconds: 300,
        forDuration: 0 },
  notifications: [
        {
          channel: 'email',
          target: process.env.ALERT_EMAIL || 'admin@airwave.com' }
      ],
      runbook: 'https://docs.airwave.com/runbooks/ai-budget',
      enabled: true});

    this.addRule({
      id: 'slow-api-response',
      name: 'Slow API Response Time',
      description: 'API response time exceeds 2 seconds',
      severity: AlertSeverity.MEDIUM,
      condition: {},
  type: 'threshold',
        metric: 'api.requests.duration',
        operator: '>',
        value: 2000,
        timeWindow: 600,
        aggregation: 'avg' },
  evaluation: {},
  intervalSeconds: 120,
        forDuration: 600 },
  notifications: [
        {
          channel: 'email',
          target: process.env.ALERT_EMAIL || 'admin@airwave.com' }
      ],
      runbook: 'https://docs.airwave.com/runbooks/slow-response',
      enabled: true});

    this.addRule({
      id: 'video-generation-failure',
      name: 'Video Generation Failure Rate High',
      description: 'Video generation failure rate exceeds 10%',
      severity: AlertSeverity.HIGH,
      condition: {},
  type: 'threshold',
        metric: 'video.generation.failure_rate',
        operator: '>',
        value: 0.1,
        timeWindow: 900,
        aggregation: 'avg' },
  evaluation: {},
  intervalSeconds: 180,
        forDuration: 300 },
  notifications: [
        {
          channel: 'email',
          target: process.env.ALERT_EMAIL || 'admin@airwave.com' }
        {
          channel: 'slack',
          target: process.env.SLACK_WEBHOOK_URL || '' }
      ],
      runbook: 'https://docs.airwave.com/runbooks/video-generation',
      enabled: true});
  }

  private startEvaluation(): void {
    this.evaluationInterval = setInterval(() => {
      this.evaluateRules();
    }, 30000); // Evaluate every 30 seconds
  }

  private async evaluateRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        console.error(`Failed to evaluate rule ${rule.id}:`, error);
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<void> {
    const currentValue = await this.getMetricValue(rule.condition);
    
    if (currentValue === null) return;

    const isConditionMet = this.evaluateCondition(rule.condition, currentValue);
    const alertId = `${rule.id}-${Date.now()}`;
    const existingAlert = this.getActiveAlertForRule(rule.id);

    if (isConditionMet && !existingAlert) {
      // New alert
      const alert: Alert = {
        id: alertId,
        ruleId: rule.id,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        state: AlertState.FIRING,
        value: currentValue,
        threshold: rule.condition.value,
        firstSeen: new Date(),
        lastSeen: new Date(),
        labels: rule.tags || { },
  annotations: {},
  runbook: rule.runbook || ''}};

      this.activeAlerts.set(alertId, alert);
      await this.sendNotifications(alert, rule);
      
      // Track alert metrics
      metrics.counter('alerts.fired', 1, {
        rule_id: rule.id,
        severity: rule.severity});

    } else if (isConditionMet && existingAlert) {
      // Update existing alert
      existingAlert.lastSeen = new Date();
      existingAlert.value = currentValue;

    } else if (!isConditionMet && existingAlert) {
      // Resolve alert
      existingAlert.state = AlertState.RESOLVED;
      existingAlert.resolvedAt = new Date();
      
      await this.sendResolutionNotifications(existingAlert, rule);
      this.activeAlerts.delete(existingAlert.id);

      // Track resolution metrics
      metrics.counter('alerts.resolved', 1, {
        rule_id: rule.id,
        severity: rule.severity});
    }
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.value;
      case '<':
        return value < condition.value;
      case '>=':
        return value >= condition.value;
      case '<=':
        return value <= condition.value;
      case '=':
        return value === condition.value;
      case '!=':
        return value !== condition.value;
      default:
        return false;
    }
  }

  private async getMetricValue(condition: AlertCondition): Promise<number | null> {
    // In a real implementation, this would query your metrics backend
    // For now, we'll use a mock implementation
    
    const history = this.metricHistory.get(condition.metric) || [];
    const now = Date.now();
    const windowStart = now - (condition.timeWindow * 1000);
    
    const relevantMetrics = history.filter(m => m.timestamp >= windowStart);
    
    if (relevantMetrics.length === 0) return null;

    switch (condition.aggregation) {
      case 'avg':
        return relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length;
      case 'sum':
        return relevantMetrics.reduce((sum, m) => sum + m.value, 0);
      case 'max':
        return Math.max(...relevantMetrics.map(m => m.value));
      case 'min':
        return Math.min(...relevantMetrics.map(m => m.value));
      case 'count':
        return relevantMetrics.length;
      default:
        return relevantMetrics[relevantMetrics.length - 1]?.value || null;
    }
  }

  private getActiveAlertForRule(ruleId: string): Alert | undefined {
    return Array.from(this.activeAlerts.values()).find(
      alert => alert.ruleId === ruleId && alert.state === AlertState.FIRING
    );
  }

  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    for (const notification of rule.notifications) {
      if (!this.shouldSendNotification(alert, notification)) continue;

      const channel = this.channels.get(notification.channel);
      if (!channel) {
        console.warn(`Unknown notification channel: ${notification.channel}`);
        continue;
      }

      try {
        const success = await channel.send(alert, notification);
        if (success) {
          metrics.counter('alerts.notifications.sent', 1, {
            channel: notification.channel,
            severity: alert.severity});
        } else {
          metrics.counter('alerts.notifications.failed', 1, {
            channel: notification.channel,
            severity: alert.severity});
        }
      } catch (error) {
        console.error(`Failed to send notification via ${notification.channel}:`, error);
        metrics.counter('alerts.notifications.failed', 1, {
          channel: notification.channel,
          severity: alert.severity});
      }
    }
  }

  private async sendResolutionNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    // Create resolution notification
    const resolutionAlert = {
      ...alert,
      description: `RESOLVED: ${alert.description}`,
      state: AlertState.RESOLVED};

    await this.sendNotifications(resolutionAlert, rule);
  }

  private shouldSendNotification(alert: Alert, notification: NotificationConfig): boolean {
    // Check severity conditions
    if (notification.conditions?.severity && 
        !notification.conditions.severity.includes(alert.severity)) {
      return false;
    }

    // Check quiet hours
    if (notification.conditions?.timeRange) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const { start, end } = notification.conditions.timeRange;
      
      if (currentTime >= start && currentTime <= end) {
        return false;
      }
    }

    return true;
  }

  // Public API methods
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  public updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.set(ruleId, { ...rule, ...updates });
    }
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  public getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  public getAllRules(): AlertRule[] {
    return [...this.rules.values()];
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.state = AlertState.ACKNOWLEDGED;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;
    }
  }

  public silenceAlert(alertId: string, duration: number): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.state = AlertState.SILENCED;
      
      // Auto-unsilence after duration
      setTimeout(() => {
        if (alert.state === AlertState.SILENCED) {
          alert.state = AlertState.FIRING;
        }
      }, duration * 1000);
    }
  }

  // Mock method to simulate metric updates
  public updateMetric(metricName: string, value: number): void {
    const history = this.metricHistory.get(metricName) || [];
    history.push({ value, timestamp: Date.now() });
    
    // Keep only last 1000 data points
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.metricHistory.set(metricName, history);
  }

  public async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [name, channel] of [...this.channels.entries()]) {
      health[`channel_${name}`] = await channel.healthCheck();
    }
    
    health.rules_loaded = this.rules.size > 0;
    health.evaluation_running = this.evaluationInterval !== null;
    
    return health;
  }

  public destroy(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
  }
}

// Global alerting instance
export const alerting = AlertingSystem.getInstance();

export default AlertingSystem;