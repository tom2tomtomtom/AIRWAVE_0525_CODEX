import { NextApiRequest, NextApiResponse } from 'next';
import { withRoles } from '@/middleware/withAuth';
import { UserRole } from '@/types/auth';
import { securityLogger } from '@/lib/security/security-logger';
import { loggers } from '@/lib/logger';

/**
 * @swagger
 * /api/security/metrics:
 *   get:
 *     summary: Get security metrics
 *     description: Retrieve real-time security metrics and statistics (Admin/Manager only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: integer
 *           default: 24
 *           maximum: 168
 *         description: Time range in hours (max 7 days)
 *     responses:
 *       200:
 *         description: Security metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                     trends:
 *                       type: object
 *                     alerts:
 *                       type: object
 *                     recommendations:
 *                       type: array
 *       403:
 *         description: Insufficient permissions
 *       401:
 *         description: Authentication required
 */

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const user = (req as any).user;

  try {
    const timeRange = Math.min(parseInt(req.query.timeRange as string) || 24, 168); // Max 7 days

    // Log metrics access
    securityLogger.logEvent('API_USAGE', req, {
      action: 'security_metrics_access',
      timeRange
    }, user.id);

    // Get current metrics
    const metrics = securityLogger.getMetrics(timeRange);
    
    // Get recent alerts
    const recentAlerts = securityLogger.getAlerts('OPEN');
    const resolvedAlerts = securityLogger.getAlerts().filter(alert => 
      alert.status === 'RESOLVED' && 
      alert.timestamp.getTime() > Date.now() - (timeRange * 60 * 60 * 1000)
    );

    // Calculate security score (0-100)
    const securityScore = calculateSecurityScore(metrics, recentAlerts);

    // Generate trends (compare with previous period)
    const previousMetrics = securityLogger.getMetrics(timeRange * 2);
    const trends = calculateTrends(metrics, previousMetrics, timeRange);

    // Generate security recommendations
    const recommendations = generateRecommendations(metrics, recentAlerts);

    // Create summary statistics
    const summary = {
      securityScore,
      totalEvents: metrics.totalEvents,
      criticalEvents: metrics.eventsBySeverity.CRITICAL || 0,
      highSeverityEvents: metrics.eventsBySeverity.HIGH || 0,
      activeAlerts: metrics.activeAlerts,
      resolvedAlertsToday: resolvedAlerts.length,
      timeRange: `${timeRange} hours`,
      lastUpdated: new Date().toISOString()
    };

    // Alert statistics
    const alertStats = {
      total: recentAlerts.length,
      bySeverity: recentAlerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: recentAlerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgResolutionTime: calculateAverageResolutionTime(resolvedAlerts)
    };

    // Top security concerns
    const topConcerns = identifyTopConcerns(metrics);

    loggers.general.info('Security metrics accessed', {
      userId: user.id,
      timeRange,
      securityScore,
      eventsAnalyzed: metrics.totalEvents
    });

    return res.status(200).json({
      success: true,
      data: {
        summary,
        trends,
        alerts: alertStats,
        topEvents: Object.entries(metrics.eventsByType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([type, count]) => ({ type, count })),
        topIPs: metrics.topIPs.slice(0, 10),
        topConcerns,
        recommendations,
        timeRange: {
          hours: timeRange,
          start: new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    loggers.general.error('Error retrieving security metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id
    });

    securityLogger.logEvent('API_ERROR', req, {
      action: 'security_metrics_access_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, user.id);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve security metrics'
    });
  }
}

/**
 * Calculate overall security score based on recent activity
 */
function calculateSecurityScore(
  metrics: any,
  alerts: any[]
): number {
  let score = 100;

  // Deduct points for security events
  const criticalEvents = metrics.eventsBySeverity.CRITICAL || 0;
  const highEvents = metrics.eventsBySeverity.HIGH || 0;
  const mediumEvents = metrics.eventsBySeverity.MEDIUM || 0;

  score -= criticalEvents * 10; // -10 per critical event
  score -= highEvents * 5;      // -5 per high event
  score -= mediumEvents * 1;    // -1 per medium event

  // Deduct points for active alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
  const highAlerts = alerts.filter(a => a.severity === 'HIGH').length;

  score -= criticalAlerts * 15; // -15 per critical alert
  score -= highAlerts * 8;      // -8 per high alert

  // Ensure score doesn't go below 0
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate trends by comparing current and previous periods
 */
function calculateTrends(
  current: any,
  previous: any,
  _timeRange: number
): Record<string, { current: number; previous: number; change: number; trend: 'up' | 'down' | 'stable' }> {
  const currentPeriodEvents = current.totalEvents;
  const previousPeriodEvents = previous.totalEvents - current.totalEvents;

  const calculateChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const getTrend = (change: number) => {
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'up' : 'down';
  };

  const totalEventsChange = calculateChange(currentPeriodEvents, previousPeriodEvents);
  
  return {
    totalEvents: {
      current: currentPeriodEvents,
      previous: previousPeriodEvents,
      change: Math.round(totalEventsChange),
      trend: getTrend(totalEventsChange)
    },
    criticalEvents: {
      current: current.eventsBySeverity.CRITICAL || 0,
      previous: (previous.eventsBySeverity.CRITICAL || 0) - (current.eventsBySeverity.CRITICAL || 0),
      change: Math.round(calculateChange(
        current.eventsBySeverity.CRITICAL || 0,
        (previous.eventsBySeverity.CRITICAL || 0) - (current.eventsBySeverity.CRITICAL || 0)
      )),
      trend: getTrend(calculateChange(
        current.eventsBySeverity.CRITICAL || 0,
        (previous.eventsBySeverity.CRITICAL || 0) - (current.eventsBySeverity.CRITICAL || 0)
      ))
    },
    activeAlerts: {
      current: current.activeAlerts,
      previous: 0, // Can't easily calculate previous active alerts
      change: 0,
      trend: 'stable'
    }
  };
}

/**
 * Generate security recommendations based on current state
 */
function generateRecommendations(
  metrics: any,
  alerts: any[]
): Array<{ priority: 'high' | 'medium' | 'low'; title: string; description: string; action: string }> {
  const recommendations = [];

  // Check for high critical event volume
  const criticalEvents = metrics.eventsBySeverity.CRITICAL || 0;
  if (criticalEvents > 5) {
    recommendations.push({
      priority: 'high' as const,
      title: 'High Critical Event Volume',
      description: `${criticalEvents} critical security events detected in the last period.`,
      action: 'Review and investigate all critical events immediately'
    });
  }

  // Check for unresolved alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
  if (criticalAlerts > 0) {
    recommendations.push({
      priority: 'high' as const,
      title: 'Unresolved Critical Alerts',
      description: `${criticalAlerts} critical security alerts require immediate attention.`,
      action: 'Investigate and resolve critical alerts'
    });
  }

  // Check for high authentication failure rate
  const authFailures = metrics.eventsByType.AUTHENTICATION_FAILURE || 0;
  if (authFailures > 50) {
    recommendations.push({
      priority: 'medium' as const,
      title: 'High Authentication Failure Rate',
      description: `${authFailures} authentication failures detected.`,
      action: 'Review authentication logs and consider implementing additional protection'
    });
  }

  // Check for scanning activity
  const scanEvents = metrics.eventsByType.SECURITY_SCAN_DETECTED || 0;
  if (scanEvents > 20) {
    recommendations.push({
      priority: 'medium' as const,
      title: 'Security Scanning Detected',
      description: `${scanEvents} security scan attempts detected.`,
      action: 'Monitor for potential follow-up attacks and review firewall rules'
    });
  }

  // Check for injection attempts
  const injectionEvents = (metrics.eventsByType.SQL_INJECTION_ATTEMPT || 0) + 
                         (metrics.eventsByType.XSS_ATTEMPT || 0) + 
                         (metrics.eventsByType.COMMAND_INJECTION_ATTEMPT || 0);
  if (injectionEvents > 10) {
    recommendations.push({
      priority: 'high' as const,
      title: 'Injection Attack Attempts',
      description: `${injectionEvents} injection attack attempts detected.`,
      action: 'Review input validation and sanitization mechanisms'
    });
  }

  // General recommendations if no specific issues
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low' as const,
      title: 'Security Posture Good',
      description: 'No immediate security concerns detected.',
      action: 'Continue monitoring and maintain current security practices'
    });
  }

  return recommendations.slice(0, 5); // Limit to top 5 recommendations
}

/**
 * Calculate average resolution time for resolved alerts
 */
function calculateAverageResolutionTime(resolvedAlerts: any[]): string {
  if (resolvedAlerts.length === 0) return 'N/A';

  const totalResolutionTime = resolvedAlerts.reduce((total, alert) => {
    if (alert.resolution?.timestamp) {
      return total + (alert.resolution.timestamp.getTime() - alert.timestamp.getTime());
    }
    return total;
  }, 0);

  const averageMs = totalResolutionTime / resolvedAlerts.length;
  const hours = Math.floor(averageMs / (1000 * 60 * 60));
  const minutes = Math.floor((averageMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Identify top security concerns based on event patterns
 */
function identifyTopConcerns(metrics: any): Array<{ concern: string; severity: string; count: number; description: string }> {
  const concerns = [];

  // Authentication-related concerns
  const authFailures = metrics.eventsByType.AUTHENTICATION_FAILURE || 0;
  const bruteForce = metrics.eventsByType.BRUTE_FORCE_ATTACK || 0;
  if (authFailures > 20 || bruteForce > 0) {
    concerns.push({
      concern: 'Authentication Attacks',
      severity: bruteForce > 0 ? 'HIGH' : 'MEDIUM',
      count: authFailures + bruteForce,
      description: 'High volume of authentication failures or brute force attempts'
    });
  }

  // Injection attacks
  const sqlInjection = metrics.eventsByType.SQL_INJECTION_ATTEMPT || 0;
  const xss = metrics.eventsByType.XSS_ATTEMPT || 0;
  const commandInjection = metrics.eventsByType.COMMAND_INJECTION_ATTEMPT || 0;
  const totalInjection = sqlInjection + xss + commandInjection;
  if (totalInjection > 0) {
    concerns.push({
      concern: 'Injection Attacks',
      severity: totalInjection > 10 ? 'HIGH' : 'MEDIUM',
      count: totalInjection,
      description: 'SQL injection, XSS, or command injection attempts detected'
    });
  }

  // Rate limiting
  const rateLimitExceeded = metrics.eventsByType.RATE_LIMIT_EXCEEDED || 0;
  if (rateLimitExceeded > 50) {
    concerns.push({
      concern: 'Rate Limit Violations',
      severity: 'MEDIUM',
      count: rateLimitExceeded,
      description: 'High volume of rate limit violations detected'
    });
  }

  return concerns.slice(0, 5);
}

// Allow admin and manager users to access security metrics
export default withRoles([UserRole.ADMIN, UserRole.MANAGER])(handler);