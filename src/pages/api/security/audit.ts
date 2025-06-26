import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withRoles } from '@/middleware/withAuth';
import { UserRole } from '@/types/auth';
import { securityLogger, SecurityEventType, SecuritySeverity } from '@/lib/security/security-logger';
import { loggers } from '@/lib/logger';

/**
 * @swagger
 * /api/security/audit:
 *   get:
 *     summary: Get security audit logs
 *     description: Retrieve security events and audit logs (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter events by user ID
 *       - in: query
 *         name: ip
 *         schema:
 *           type: string
 *         description: Filter events by IP address
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [AUTHENTICATION_FAILURE, AUTHENTICATION_SUCCESS, AUTHORIZATION_FAILURE, SESSION_HIJACK_ATTEMPT, XSS_ATTEMPT, SQL_INJECTION_ATTEMPT]
 *         description: Filter events by type
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         description: Filter events by severity
 *       - in: query
 *         name: minutes
 *         schema:
 *           type: integer
 *           default: 60
 *         description: Time range in minutes
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *         description: Maximum number of events to return
 *     responses:
 *       200:
 *         description: Security audit data
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
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     metrics:
 *                       type: object
 *       403:
 *         description: Insufficient permissions
 *       401:
 *         description: Authentication required
 */

interface AuditQueryParams {
  userId?: string;
  ip?: string;
  type?: SecurityEventType;
  severity?: SecuritySeverity;
  minutes?: string;
  limit?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const user = (req as any).user;
  
  try {
    // Log the audit access
    securityLogger.logEvent('API_USAGE', req, {
      action: 'security_audit_access',
      endpoint: '/api/security/audit'
    }, user.id);

    const {
      userId,
      ip,
      type,
      severity,
      minutes = '60',
      limit = '100'
    } = req.query as AuditQueryParams;

    // Parse and validate query parameters
    const minutesNum = Math.min(parseInt(minutes) || 60, 10080); // Max 7 days
    const limitNum = Math.min(parseInt(limit) || 100, 1000); // Max 1000 events

    // Get security events based on filters
    const events = securityLogger.getEvents({
      userId,
      ip,
      type,
      severity,
      minutes: minutesNum,
      limit: limitNum
    });

    // Get active security alerts
    const alerts = securityLogger.getAlerts('OPEN');

    // Get security metrics
    const metrics = securityLogger.getMetrics(Math.min(minutesNum / 60, 168)); // Convert to hours, max 7 days

    // Sanitize sensitive information from events before sending
    const sanitizedEvents = events.map(event => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      timestamp: event.timestamp,
      ip: maskIP(event.ip),
      userAgent: event.userAgent ? maskUserAgent(event.userAgent) : 'Unknown',
      endpoint: event.endpoint,
      method: event.method,
      userId: event.userId,
      threat: event.threat,
      details: sanitizeEventDetails(event.details),
      geolocation: event.geolocation
    }));

    // Sanitize alerts
    const sanitizedAlerts = alerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      timestamp: alert.timestamp,
      title: alert.title,
      description: alert.description,
      metrics: alert.metrics,
      status: alert.status
    }));

    loggers.general.info('Security audit data accessed', {
      userId: user.id,
      eventsReturned: sanitizedEvents.length,
      alertsReturned: sanitizedAlerts.length,
      filters: { userId, ip: ip ? maskIP(ip) : undefined, type, severity, minutes: minutesNum, limit: limitNum }
    });

    return res.status(200).json({
      success: true,
      data: {
        events: sanitizedEvents,
        alerts: sanitizedAlerts,
        metrics: {
          ...metrics,
          timeRange: `${minutesNum} minutes`,
          totalEventsReturned: sanitizedEvents.length
        },
        filters: {
          userId,
          ip: ip ? maskIP(ip) : undefined,
          type,
          severity,
          timeRange: minutesNum,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    loggers.general.error('Error retrieving security audit data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id
    });

    // Log security event for audit access failure
    securityLogger.logEvent('API_ERROR', req, {
      action: 'security_audit_access_failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, user.id);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve security audit data'
    });
  }
}

/**
 * Mask IP address for privacy (keep first 3 octets, mask last)
 */
function maskIP(ip: string): string {
  if (ip.includes(':')) {
    // IPv6 - keep first 4 groups, mask the rest
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + ':****';
  } else {
    // IPv4 - keep first 3 octets, mask last
    const parts = ip.split('.');
    if (parts.length === 4) {
      return parts.slice(0, 3).join('.') + '.***';
    }
  }
  return '***.***.***';
}

/**
 * Mask user agent to remove potentially sensitive information
 */
function maskUserAgent(userAgent: string): string {
  // Remove potential tracking parameters and keep only browser/OS info
  return userAgent
    .replace(/\([^)]*\)/g, '(...)')
    .slice(0, 100);
}

/**
 * Sanitize event details to remove sensitive information
 */
function sanitizeEventDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...details };
  
  // Remove or mask sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'cookie'];
  
  for (const [key, value] of Object.entries(sanitized)) {
    const keyLower = key.toLowerCase();
    
    if (sensitiveFields.some(field => keyLower.includes(field))) {
      if (typeof value === 'string' && value.length > 8) {
        sanitized[key] = value.slice(0, 4) + '****' + value.slice(-4);
      } else {
        sanitized[key] = '****';
      }
    }
    
    // Limit payload sizes to prevent large response
    if (key === 'payload' && typeof value === 'string' && value.length > 500) {
      sanitized[key] = value.slice(0, 500) + '... (truncated)';
    }
  }
  
  return sanitized;
}

// Only allow admin users to access audit logs
export default withRoles([UserRole.ADMIN])(handler);