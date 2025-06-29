/**
 * API endpoint for Performance Dashboard
 * Provides real-time dashboard data and metrics
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { performanceDashboard } from '@/lib/monitoring/performance-dashboard';
import { alerting } from '@/lib/monitoring/alerting-system';
import { withAuth } from '@/middleware/withAuth';
import { withRateLimit } from '@/middleware/withRateLimit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGetDashboard(req, res);
      case 'POST':
        return await handleUpdateMetric(req, res);
      default:
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
        });
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}

async function handleGetDashboard(req: NextApiRequest, res: NextApiResponse) {
  const { section, timeWindow: _timeWindow } = req.query;

  try {
    if (section === 'alerts') {
      // Return alert-specific data
      const activeAlerts = alerting.getActiveAlerts();
      const alertStats = {
        total: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length,
        low: activeAlerts.filter(a => a.severity === 'low').length,
        alerts: activeAlerts.map(alert => ({
          id: alert.id,
          name: alert.name,
          severity: alert.severity,
          state: alert.state,
          firstSeen: alert.firstSeen,
          lastSeen: alert.lastSeen,
          value: alert.value,
          threshold: alert.threshold,
        })),
      };

      return res.status(200).json({
        success: true,
        data: alertStats,
        meta: { timestamp: new Date().toISOString() },
      });
    }

    if (section === 'health') {
      // Return system health check
      const alertingHealth = await alerting.healthCheck();
      const systemHealth = {
        overall: 'healthy',
        components: {
          alerting: alertingHealth,
          dashboard: true,
          api: true,
        },
      };

      return res.status(200).json({
        success: true,
        data: systemHealth,
        meta: { timestamp: new Date().toISOString() },
      });
    }

    if (section && typeof section === 'string') {
      // Return specific section data
      const dashboard = performanceDashboard.generateDashboard();
      const sectionData = dashboard.sections.find(s => s.id === section);

      if (!sectionData) {
        return res.status(404).json({
          success: false,
          error: { code: 'SECTION_NOT_FOUND', message: 'Dashboard section not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: sectionData,
        meta: { timestamp: new Date().toISOString() },
      });
    }

    // Return full dashboard
    const dashboard = performanceDashboard.generateDashboard();

    return res.status(200).json({
      success: true,
      data: dashboard,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to generate dashboard:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'DASHBOARD_ERROR', message: 'Failed to generate dashboard' },
    });
  }
}

async function handleUpdateMetric(req: NextApiRequest, res: NextApiResponse) {
  const { metric, value, timestamp: _timestamp } = req.body;

  if (!metric || typeof value !== 'number') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Metric name and numeric value required' },
    });
  }

  try {
    // Update the metric in the dashboard
    performanceDashboard.updateMetric(metric, value);

    // Also update in alerting system for rule evaluation
    alerting.updateMetric(metric, value);

    return res.status(200).json({
      success: true,
      data: { metric, value, updated: true },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to update metric:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update metric' },
    });
  }
}

// Apply middleware pipeline
export default withAuth(withRateLimit('api')(handler));
