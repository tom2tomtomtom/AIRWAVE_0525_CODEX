/**
 * API endpoint for Alert Management
 * Manage alert rules, acknowledge alerts, and configure notifications
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { alerting, AlertRule } from '@/lib/monitoring/alerting-system';
import { withAuth } from '@/middleware/withAuth';
import { withRateLimit } from '@/middleware/withRateLimit';

// Validation schemas
const CreateAlertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  condition: z.object({
    type: z.enum(['threshold', 'anomaly', 'absence', 'change']),
    metric: z.string(),
    operator: z.enum(['>', '<', '=', '!=', '>=', '<=']),
    value: z.number(),
    timeWindow: z.number().min(60).max(86400), // 1 minute to 24 hours
    aggregation: z.enum(['avg', 'sum', 'max', 'min', 'count']).optional(),
  }),
  evaluation: z.object({
    intervalSeconds: z.number().min(30).max(3600),
    forDuration: z.number().min(0).max(3600) }),
  notifications: z.array(
    z.object({
      channel: z.enum(['email', 'slack', 'pagerduty', 'webhook', 'sms']),
      target: z.string(),
      template: z.string().optional(),
      conditions: z
        .object({
          severity: z.array(z.enum(['critical', 'high', 'medium', 'low', 'info'])).optional(),
          tags: z.record(z.string()).optional(),
          timeRange: z
            .object({
              start: z.string(),
              end: z.string() })
            .optional(),
        })
        .optional(),
    })
  ),
  runbook: z.string().url().optional(),
  tags: z.record(z.string()).optional(),
  enabled: z.boolean().default(true) });

const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial();

const AcknowledgeAlertSchema = z.object({
  alertId: z.string(),
  acknowledgedBy: z.string(),
  comment: z.string().optional() });

const SilenceAlertSchema = z.object({
  alertId: z.string(),
  duration: z.number().min(300).max(86400), // 5 minutes to 24 hours
  reason: z.string().optional() });

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGetAlerts(req, res);
      case 'POST':
        return await handleCreateRule(req, res);
      case 'PUT':
        return await handleUpdateRule(req, res);
      case 'DELETE':
        return await handleDeleteRule(req, res);
      case 'PATCH':
        return await handleAlertAction(req, res);
      default:
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed'  }
        });
    }
  } catch (error) {
    console.error('Alerts API error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error'  }
    });
  }
}

async function handleGetAlerts(req: NextApiRequest, res: NextApiResponse) {
  const { type, ruleId, state, severity } = req.query;

  try {
    if (type === 'rules') {
      // Return alert rules
      let rules = alerting.getAllRules();

      if (ruleId && typeof ruleId === 'string') {
        const rule = alerting.getRule(ruleId);
        if (!rule) {
          return res.status(404).json({
            success: false,
            error: { code: 'RULE_NOT_FOUND', message: 'Alert rule not found'  }
          });
        }
        rules = [rule];
      }

      return res.status(200).json({
        success: true,
        data: { rules  },
  meta: {
          count: rules.length,
          timestamp: new Date().toISOString() },
      });
    }

    // Return active alerts
    let alerts = alerting.getActiveAlerts();

    // Apply filters
    if (state && typeof state === 'string') {
      alerts = alerts.filter(alert => alert.state === state);
    }

    if (severity && typeof severity === 'string') {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    // Calculate alert statistics
    const stats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
      info: alerts.filter(a => a.severity === 'info').length,
      firing: alerts.filter(a => a.state === 'firing').length,
      acknowledged: alerts.filter(a => a.state === 'acknowledged').length,
      silenced: alerts.filter(a => a.state === 'silenced').length };

    return res.status(200).json({
      success: true,
      data: {
        alerts: alerts.map(alert => ({
          ...alert,
          duration: alert.lastSeen.getTime() - alert.firstSeen.getTime() })),
        stats,
      },
      meta: { timestamp: new Date().toISOString()  }
    });
  } catch (error) {
    console.error('Failed to get alerts:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch alerts'  }
    });
  }
}

async function handleCreateRule(req: NextApiRequest, res: NextApiResponse) {
  try {
    const validatedData = CreateAlertRuleSchema.parse(req.body);

    const rule: AlertRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...validatedData,
      ...(validatedData.runbook ? { runbook: validatedData.runbook } : {}),
      ...(validatedData.tags ? { tags: validatedData.tags } : {}),
    } as AlertRule;

    alerting.addRule(rule);

    return res.status(201).json({
      success: true,
      data: { rule  },
  meta: { timestamp: new Date().toISOString()  }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rule data',
          details: error.errors },
      });
    }

    console.error('Failed to create alert rule:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create alert rule'  }
    });
  }
}

async function handleUpdateRule(req: NextApiRequest, res: NextApiResponse) {
  const { ruleId } = req.query;

  if (!ruleId || typeof ruleId !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_RULE_ID', message: 'Rule ID is required'  }
    });
  }

  try {
    const validatedData = UpdateAlertRuleSchema.parse(req.body);
    const existingRule = alerting.getRule(ruleId);

    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Alert rule not found'  }
      });
    }

    alerting.updateRule(ruleId, validatedData as Partial<AlertRule>);
    const updatedRule = alerting.getRule(ruleId);

    return res.status(200).json({
      success: true,
      data: { rule: updatedRule! },
  meta: { timestamp: new Date().toISOString()  }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rule data',
          details: error.errors },
      });
    }

    console.error('Failed to update alert rule:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update alert rule'  }
    });
  }
}

async function handleDeleteRule(req: NextApiRequest, res: NextApiResponse) {
  const { ruleId } = req.query;

  if (!ruleId || typeof ruleId !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_RULE_ID', message: 'Rule ID is required'  }
    });
  }

  try {
    const existingRule = alerting.getRule(ruleId);

    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: { code: 'RULE_NOT_FOUND', message: 'Alert rule not found'  }
      });
    }

    alerting.removeRule(ruleId);

    return res.status(200).json({
      success: true,
      data: { deleted: true, ruleId },
      meta: { timestamp: new Date().toISOString()  }
    });
  } catch (error) {
    console.error('Failed to delete alert rule:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete alert rule'  }
    });
  }
}

async function handleAlertAction(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;

  try {
    switch (action) {
      case 'acknowledge':
        return await handleAcknowledgeAlert(req, res);
      case 'silence':
        return await handleSilenceAlert(req, res);
      case 'resolve':
        return await handleResolveAlert(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Invalid alert action'  }
        });
    }
  } catch (error) {
    console.error('Failed to perform alert action:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ACTION_ERROR', message: 'Failed to perform alert action'  }
    });
  }
}

async function handleAcknowledgeAlert(req: NextApiRequest, res: NextApiResponse) {
  try {
    const validatedData = AcknowledgeAlertSchema.parse(req.body);
    const { alertId, acknowledgedBy, comment } = validatedData;

    const alerts = alerting.getActiveAlerts();
    const alert = alerts.find(a => a.id === alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: { code: 'ALERT_NOT_FOUND', message: 'Alert not found'  }
      });
    }

    alerting.acknowledgeAlert(alertId, acknowledgedBy);

    return res.status(200).json({
      success: true,
      data: {
        acknowledged: true,
        alertId,
        acknowledgedBy,
        comment,
      },
      meta: { timestamp: new Date().toISOString()  }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid acknowledgment data',
          details: error.errors },
      });
    }
    throw error;
  }
}

async function handleSilenceAlert(req: NextApiRequest, res: NextApiResponse) {
  try {
    const validatedData = SilenceAlertSchema.parse(req.body);
    const { alertId, duration, reason } = validatedData;

    const alerts = alerting.getActiveAlerts();
    const alert = alerts.find(a => a.id === alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: { code: 'ALERT_NOT_FOUND', message: 'Alert not found'  }
      });
    }

    alerting.silenceAlert(alertId, duration);

    return res.status(200).json({
      success: true,
      data: {
        silenced: true,
        alertId,
        duration,
        reason,
        until: new Date(Date.now() + duration * 1000).toISOString() },
      meta: { timestamp: new Date().toISOString()  }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid silence data',
          details: error.errors },
      });
    }
    throw error;
  }
}

async function handleResolveAlert(req: NextApiRequest, res: NextApiResponse) {
  const { alertId } = req.body;

  if (!alertId || typeof alertId !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ALERT_ID', message: 'Alert ID is required'  }
    });
  }

  const alerts = alerting.getActiveAlerts();
  const alert = alerts.find(a => a.id === alertId);

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: { code: 'ALERT_NOT_FOUND', message: 'Alert not found'  }
    });
  }

  // Manual resolution (would update alert state)
  (alert as any).state = 'resolved';
  (alert as any).resolvedAt = new Date();

  return res.status(200).json({
    success: true,
    data: {
      resolved: true,
      alertId,
      resolvedAt: (alert as any).resolvedAt.toISOString() },
    meta: { timestamp: new Date().toISOString()  }
  });
}

// Apply middleware pipeline
export default withAuth(withRateLimit('api')(handler));
