/**
 * Security Event Logging System for AIRWAVE
 * Comprehensive security monitoring and threat detection
 * Logs security events, detects patterns, and provides alerting
 */

import { getClientIp } from '@/lib/utils/ip';
import { NextApiRequest } from 'next';
import { loggers } from '@/lib/logger';


export type SecurityEventType =
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHENTICATION_SUCCESS'
  | 'AUTHORIZATION_FAILURE'
  | 'SESSION_HIJACK_ATTEMPT'
  | 'SESSION_CREATED'
  | 'SESSION_DESTROYED'
  | 'CSRF_VIOLATION'
  | 'XSS_ATTEMPT'
  | 'SQL_INJECTION_ATTEMPT'
  | 'PATH_TRAVERSAL_ATTEMPT'
  | 'COMMAND_INJECTION_ATTEMPT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_FILE_UPLOAD'
  | 'ACCOUNT_LOCKOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PROFILE_MODIFICATION'
  | 'PRIVILEGE_ESCALATION_ATTEMPT'
  | 'API_ABUSE'
  | 'UNUSUAL_ACTIVITY'
  | 'SECURITY_SCAN_DETECTED'
  | 'BRUTE_FORCE_ATTACK'
  | 'API_USAGE'
  | 'API_ERROR'
  | 'MALICIOUS_INPUT_DETECTED'
  | 'MALICIOUS_QUERY_DETECTED'
  | 'INVALID_API_REQUEST';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  details: Record<string, unknown>;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  threat: {
    score: number; // 0-100
    category: string;
    indicators: string[];
  };
  resolution?: {
    action: string;
    timestamp: Date;
    resolvedBy?: string;
    notes?: string;
  };
}

export interface SecurityAlert {
  id: string;
  type: 'THREAT_DETECTED' | 'PATTERN_ANOMALY' | 'THRESHOLD_EXCEEDED';
  severity: SecuritySeverity;
  timestamp: Date;
  title: string;
  description: string;
  events: string[]; // Event IDs related to this alert
  metrics: {
    eventCount: number;
    timeWindow: string;
    affectedUsers: number;
    affectedIPs: number;
  };
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  assignee?: string;
  notes?: string[];
}

export interface ThreatPattern {
  name: string;
  events: SecurityEventType[];
  timeWindow: number; // milliseconds
  threshold: number;
  severity: SecuritySeverity;
  description: string;
}

/**
 * Security Event Store (use database in production)
 */
class SecurityEventStore {
  private events = new Map<string, SecurityEvent>();
  private alerts = new Map<string, SecurityAlert>();
  private eventsByUser = new Map<string, string[]>();
  private eventsByIP = new Map<string, string[]>();
  private eventsByType = new Map<SecurityEventType, string[]>();

  addEvent(event: SecurityEvent): void {
    this.events.set(event.id, event);

    // Index by user
    if (event.userId) {
      if (!this.eventsByUser.has(event.userId)) {
        this.eventsByUser.set(event.userId, []);
      }
      this.eventsByUser.get(event.userId)!.push(event.id);
    }

    // Index by IP
    if (!this.eventsByIP.has(event.ip)) {
      this.eventsByIP.set(event.ip, []);
    }
    this.eventsByIP.get(event.ip)!.push(event.id);

    // Index by type
    if (!this.eventsByType.has(event.type)) {
      this.eventsByType.set(event.type, []);
    }
    this.eventsByType.get(event.type)!.push(event.id);

    // Cleanup old indexes periodically
    this.cleanupIndexes();
  }

  getEvent(eventId: string): SecurityEvent | undefined {
    return this.events.get(eventId);
  }

  getEventsByUser(userId: string, limit: number = 100): SecurityEvent[] {
    const eventIds = this.eventsByUser.get(userId) || [];
    return eventIds
      .slice(-limit)
      .map(id => this.events.get(id))
      .filter((event): event is SecurityEvent => event !== undefined);
  }

  getEventsByIP(ip: string, limit: number = 100): SecurityEvent[] {
    const eventIds = this.eventsByIP.get(ip) || [];
    return eventIds
      .slice(-limit)
      .map(id => this.events.get(id))
      .filter((event): event is SecurityEvent => event !== undefined);
  }

  getEventsByType(type: SecurityEventType, limit: number = 100): SecurityEvent[] {
    const eventIds = this.eventsByType.get(type) || [];
    return eventIds
      .slice(-limit)
      .map(id => this.events.get(id))
      .filter((event): event is SecurityEvent => event !== undefined);
  }

  getRecentEvents(minutes: number = 60, limit: number = 1000): SecurityEvent[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return Array.from(this.events.values())
      .filter(event => event.timestamp.getTime() > cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  addAlert(alert: SecurityAlert): void {
    this.alerts.set(alert.id, alert);
  }

  getAlert(alertId: string): SecurityAlert | undefined {
    return this.alerts.get(alertId);
  }

  getOpenAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.status === 'OPEN')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private cleanupIndexes(): void {
    // Keep only last 10000 events per index to prevent memory leaks
    const maxEventsPerIndex = 10000;

    for (const [userId, eventIds] of this.eventsByUser.entries()) {
      if (eventIds.length > maxEventsPerIndex) {
        this.eventsByUser.set(userId, eventIds.slice(-maxEventsPerIndex));
      }
    }

    for (const [ip, eventIds] of this.eventsByIP.entries()) {
      if (eventIds.length > maxEventsPerIndex) {
        this.eventsByIP.set(ip, eventIds.slice(-maxEventsPerIndex));
      }
    }

    for (const [type, eventIds] of this.eventsByType.entries()) {
      if (eventIds.length > maxEventsPerIndex) {
        this.eventsByType.set(type, eventIds.slice(-maxEventsPerIndex));
      }
    }
  }
}

/**
 * Threat Detection Engine
 */
class ThreatDetectionEngine {
  private patterns: ThreatPattern[] = [
    {
      name: 'Brute Force Attack',
      events: ['AUTHENTICATION_FAILURE'],
      timeWindow: 5 * 60 * 1000, // 5 minutes
      threshold: 10,
      severity: 'HIGH',
      description: 'Multiple failed authentication attempts from same IP'
    },
    {
      name: 'Account Enumeration',
      events: ['AUTHENTICATION_FAILURE'],
      timeWindow: 10 * 60 * 1000, // 10 minutes
      threshold: 50,
      severity: 'MEDIUM',
      description: 'High volume of failed logins across different accounts'
    },
    {
      name: 'Session Hijacking Pattern',
      events: ['SESSION_HIJACK_ATTEMPT'],
      timeWindow: 1 * 60 * 1000, // 1 minute
      threshold: 3,
      severity: 'CRITICAL',
      description: 'Multiple session hijacking attempts detected'
    },
    {
      name: 'Injection Attack Pattern',
      events: ['XSS_ATTEMPT', 'SQL_INJECTION_ATTEMPT', 'COMMAND_INJECTION_ATTEMPT'],
      timeWindow: 15 * 60 * 1000, // 15 minutes
      threshold: 5,
      severity: 'HIGH',
      description: 'Multiple injection attack attempts detected'
    },
    {
      name: 'Security Scanner',
      events: ['SECURITY_SCAN_DETECTED', 'PATH_TRAVERSAL_ATTEMPT'],
      timeWindow: 5 * 60 * 1000, // 5 minutes
      threshold: 20,
      severity: 'MEDIUM',
      description: 'Automated security scanning detected'
    },
    {
      name: 'Privilege Escalation',
      events: ['PRIVILEGE_ESCALATION_ATTEMPT', 'AUTHORIZATION_FAILURE'],
      timeWindow: 10 * 60 * 1000, // 10 minutes
      threshold: 10,
      severity: 'HIGH',
      description: 'Multiple unauthorized access attempts to privileged resources' }
  ];

  detectThreats(events: SecurityEvent[]): SecurityAlert[] {
    const alerts: SecurityAlert[] = [];

    for (const pattern of this.patterns) {
      const patternAlerts = this.detectPattern(pattern, events);
      alerts.push(...patternAlerts);
    }

    return alerts;
  }

  private detectPattern(pattern: ThreatPattern, events: SecurityEvent[]): SecurityAlert[] {
    const alerts: SecurityAlert[] = [];
    const now = Date.now();
    const cutoff = now - pattern.timeWindow;

    // Filter events by pattern criteria
    const relevantEvents = events.filter(event => 
      pattern.events.includes(event.type) &&
      event.timestamp.getTime() > cutoff
    );

    // Group by IP address
    const eventsByIP = new Map<string, SecurityEvent[]>();
    for (const event of relevantEvents) {
      if (!eventsByIP.has(event.ip)) {
        eventsByIP.set(event.ip, []);
      }
      eventsByIP.get(event.ip)!.push(event);
    }

    // Check each IP for threshold violation
    for (const [ip, ipEvents] of eventsByIP.entries()) {
      if (ipEvents.length >= pattern.threshold) {
        const alert: SecurityAlert = {
          id: this.generateAlertId(),
          type: 'PATTERN_ANOMALY',
          severity: pattern.severity,
          timestamp: new Date(),
          title: `${pattern.name} detected from ${ip}`,
          description: `${pattern.description}. ${ipEvents.length} events in ${pattern.timeWindow / 60000} minutes.`,
          events: ipEvents.map(e => e.id),
          metrics: {
            eventCount: ipEvents.length,
            timeWindow: `${pattern.timeWindow / 60000} minutes`,
            affectedUsers: new Set(ipEvents.map(e => e.userId).filter(Boolean)).size,
            affectedIPs: 1
          },
          status: 'OPEN'
        };

        alerts.push(alert);
      }
    }

    return alerts;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global instances
const eventStore = new SecurityEventStore();
const threatEngine = new ThreatDetectionEngine();

/**
 * Security Logger Class
 */
export class SecurityLogger {
  private static instance: SecurityLogger;

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  /**
   * Log a security event
   */
  logEvent(
    type: SecurityEventType,
    req: NextApiRequest,
    details: Record<string, unknown> = {},
    userId?: string,
    sessionId?: string
  ): SecurityEvent {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type,
      severity: this.getSeverityForEventType(type),
      timestamp: new Date(),
      ...(userId && { userId }),
      ...(sessionId && { sessionId }),
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || 'Unknown',
      endpoint: req.url || 'Unknown',
      method: req.method || 'Unknown',
      details,
      threat: this.calculateThreatScore(type, details)};

    // Store the event
    eventStore.addEvent(event);

    // Check for threat patterns
    this.checkForThreats();

    // Log to console with appropriate level
    this.logToConsole(event);

    // In production, also log to external security system
    if (process.env.NODE_ENV === 'production') {
      this.logToExternalSystem(event);
    }

    return event;
  }

  /**
   * Get security events with filtering
   */
  getEvents(filters: {
    userId?: string;
    ip?: string;
    type?: SecurityEventType;
    severity?: SecuritySeverity;
    minutes?: number;
    limit?: number;
  } = {}): SecurityEvent[] {
    let events: SecurityEvent[];

    if (filters.userId) {
      events = eventStore.getEventsByUser(filters.userId, filters.limit);
    } else if (filters.ip) {
      events = eventStore.getEventsByIP(filters.ip, filters.limit);
    } else if (filters.type) {
      events = eventStore.getEventsByType(filters.type, filters.limit);
    } else {
      events = eventStore.getRecentEvents(filters.minutes, filters.limit);
    }

    // Apply additional filters
    if (filters.severity) {
      events = events.filter(event => event.severity === filters.severity);
    }

    return events;
  }

  /**
   * Get security alerts
   */
  getAlerts(status?: SecurityAlert['status']): SecurityAlert[] {
    if (status) {
      return Array.from(eventStore.getOpenAlerts())
        .filter(alert => alert.status === status);
    }
    return eventStore.getOpenAlerts();
  }

  /**
   * Get security metrics
   */
  getMetrics(timeRange: number = 24): {
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecuritySeverity, number>;
    topIPs: Array<{ ip: string; count: number }>;
    activeAlerts: number;
  } {
    const events = eventStore.getRecentEvents(timeRange * 60);
    
    const eventsByType = {} as Record<string, unknown> & Record<SecurityEventType, number>;
    const eventsBySeverity = {} as Record<string, unknown> & Record<SecuritySeverity, number>;
    const ipCounts = new Map<string, number>();

    for (const event of events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Count by IP
      ipCounts.set(event.ip, (ipCounts.get(event.ip) || 0) + 1);
    }

    // Get top IPs
    const topIPs = Array.from(ipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      topIPs,
      activeAlerts: eventStore.getOpenAlerts().length};
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityForEventType(type: SecurityEventType): SecuritySeverity {
    const severityMap: Record<SecurityEventType, SecuritySeverity> = {
      'SESSION_HIJACK_ATTEMPT': 'CRITICAL',
      'PRIVILEGE_ESCALATION_ATTEMPT': 'CRITICAL',
      'SQL_INJECTION_ATTEMPT': 'HIGH',
      'COMMAND_INJECTION_ATTEMPT': 'HIGH',
      'XSS_ATTEMPT': 'HIGH',
      'BRUTE_FORCE_ATTACK': 'HIGH',
      'ACCOUNT_LOCKOUT': 'MEDIUM',
      'AUTHENTICATION_FAILURE': 'MEDIUM',
      'AUTHORIZATION_FAILURE': 'MEDIUM',
      'CSRF_VIOLATION': 'MEDIUM',
      'PATH_TRAVERSAL_ATTEMPT': 'MEDIUM',
      'RATE_LIMIT_EXCEEDED': 'MEDIUM',
      'SUSPICIOUS_FILE_UPLOAD': 'MEDIUM',
      'API_ABUSE': 'MEDIUM',
      'MALICIOUS_INPUT_DETECTED': 'HIGH',
      'MALICIOUS_QUERY_DETECTED': 'MEDIUM',
      'INVALID_API_REQUEST': 'MEDIUM',
      'API_ERROR': 'MEDIUM',
      'API_USAGE': 'LOW',
      'SECURITY_SCAN_DETECTED': 'LOW',
      'AUTHENTICATION_SUCCESS': 'LOW',
      'SESSION_CREATED': 'LOW',
      'SESSION_DESTROYED': 'LOW',
      'PASSWORD_RESET_REQUEST': 'LOW',
      'PROFILE_MODIFICATION': 'LOW',
      'UNUSUAL_ACTIVITY': 'LOW'};

    return severityMap[type] || 'MEDIUM';
  }

  private calculateThreatScore(
    type: SecurityEventType,
    details: Record<string, unknown>
  ): { score: number; category: string; indicators: string[] } {
    let score = 0;
    const indicators: string[] = [];
    let category = 'Unknown';

    // Base score by event type
    const baseScores: Record<SecurityEventType, number> = {
      'SESSION_HIJACK_ATTEMPT': 90,
      'PRIVILEGE_ESCALATION_ATTEMPT': 85,
      'SQL_INJECTION_ATTEMPT': 80,
      'COMMAND_INJECTION_ATTEMPT': 80,
      'XSS_ATTEMPT': 75,
      'BRUTE_FORCE_ATTACK': 70,
      'CSRF_VIOLATION': 60,
      'PATH_TRAVERSAL_ATTEMPT': 65,
      'AUTHENTICATION_FAILURE': 30,
      'AUTHORIZATION_FAILURE': 40,
      'RATE_LIMIT_EXCEEDED': 35,
      'SUSPICIOUS_FILE_UPLOAD': 50,
      'API_ABUSE': 45,
      'ACCOUNT_LOCKOUT': 40,
      'SECURITY_SCAN_DETECTED': 25,
      'AUTHENTICATION_SUCCESS': 5,
      'SESSION_CREATED': 5,
      'SESSION_DESTROYED': 5,
      'PASSWORD_RESET_REQUEST': 15,
      'PROFILE_MODIFICATION': 20,
      'UNUSUAL_ACTIVITY': 30,
      'MALICIOUS_INPUT_DETECTED': 75,
      'MALICIOUS_QUERY_DETECTED': 40,
      'INVALID_API_REQUEST': 25,
      'API_ERROR': 20,
      'API_USAGE': 5};

    score = baseScores[type] || 50;

    // Categorize threats
    if (['SESSION_HIJACK_ATTEMPT', 'PRIVILEGE_ESCALATION_ATTEMPT'].includes(type)) {
      category = 'Account Takeover';
      indicators.push('account_compromise');
    } else if (['SQL_INJECTION_ATTEMPT', 'XSS_ATTEMPT', 'COMMAND_INJECTION_ATTEMPT'].includes(type)) {
      category = 'Injection Attack';
      indicators.push('code_injection');
    } else if (['BRUTE_FORCE_ATTACK', 'AUTHENTICATION_FAILURE'].includes(type)) {
      category = 'Authentication Attack';
      indicators.push('credential_attack');
    } else if (['SECURITY_SCAN_DETECTED', 'PATH_TRAVERSAL_ATTEMPT'].includes(type)) {
      category = 'Reconnaissance';
      indicators.push('scanning');
    }

    // Adjust score based on details
    if (details.automated === true) {
      score += 15;
      indicators.push('automated_attack');
    }

    if (details.repeated === true) {
      score += 10;
      indicators.push('repeated_attempts');
    }

    if (details.payload_size && typeof details.payload_size === 'number' && details.payload_size > 1000) {
      score += 5;
      indicators.push('large_payload');
    }

    return { score: Math.min(100, score), category, indicators };
  }

  private checkForThreats(): void {
    const recentEvents = eventStore.getRecentEvents(60); // Last hour
    const alerts = threatEngine.detectThreats(recentEvents);

    for (const alert of alerts) {
      eventStore.addAlert(alert);
      
      // Log high-severity alerts immediately
      if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
        console.error(`[Security Alert] ${alert.title}:`, {
          id: alert.id,
          severity: alert.severity,
          description: alert.description,
          metrics: alert.metrics});
      }
    }
  }

  private logToConsole(event: SecurityEvent): void {
    const logData = {
      id: event.id,
      type: event.type,
      severity: event.severity,
      ip: event.ip.replace(/\d+$/, '***'), // Mask last IP octet
      endpoint: event.endpoint,
      method: event.method,
      userId: event.userId || 'anonymous',
      threat: event.threat,
      timestamp: event.timestamp.toISOString()};

    switch (event.severity) {
      case 'CRITICAL':
        console.error('[Security Critical]', logData);
        break;
      case 'HIGH':
        console.error('[Security High]', logData);
        break;
      case 'MEDIUM':
        console.warn('[Security Medium]', logData);
        break;
      case 'LOW':
        loggers.general.error('[Security Low]', logData);
        break;
    }
  }

  private logToExternalSystem(event: SecurityEvent): void {
    // In production, send to external SIEM/logging system
    // This could be Splunk, ELK Stack, Azure Sentinel, etc.
    try {
      // Example: Send to webhook endpoint
      if (process.env.SECURITY_WEBHOOK_URL) {
        fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: {
        'Content-Type': 'application/json' 
      },
          body: JSON.stringify(event)}).catch(error => {
          console.error('Failed to send security event to external system:', error);
        });
      }
    } catch (error) {
      console.error('Error logging to external system:', error);
    }
  }
}

// Export singleton instance
export const securityLogger = SecurityLogger.getInstance();

// Helper functions for common security events
export const SecurityEvents = {
  authFailure: (req: NextApiRequest, email: string, reason: string) =>
    securityLogger.logEvent('AUTHENTICATION_FAILURE', req, { email, reason }),

  authSuccess: (req: NextApiRequest, userId: string) =>
    securityLogger.logEvent('AUTHENTICATION_SUCCESS', req, {}, userId),

  sessionHijack: (req: NextApiRequest, userId: string, sessionId: string, details: Record<string, unknown>) =>
    securityLogger.logEvent('SESSION_HIJACK_ATTEMPT', req, details, userId, sessionId),

  xssAttempt: (req: NextApiRequest, payload: string, field: string) =>
    securityLogger.logEvent('XSS_ATTEMPT', req, { payload: payload.slice(0, 200), field }),

  sqlInjection: (req: NextApiRequest, payload: string, field: string) =>
    securityLogger.logEvent('SQL_INJECTION_ATTEMPT', req, { payload: payload.slice(0, 200), field }),

  rateLimitExceeded: (req: NextApiRequest, limit: number, attempts: number) =>
    securityLogger.logEvent('RATE_LIMIT_EXCEEDED', req, { limit, attempts }),

  csrfViolation: (req: NextApiRequest, expectedToken: string, receivedToken: string) =>
    securityLogger.logEvent('CSRF_VIOLATION', req, { 
      expectedToken: expectedToken.slice(0, 8), 
      receivedToken: receivedToken.slice(0, 8) 
    })};

export default securityLogger;