/**
 * Session Security Hardening Middleware for AIRWAVE
 * Implements secure session management, token rotation, and session monitoring
 * Protects against session hijacking, fixation, and unauthorized access
 */

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getClientIp } from '@/lib/utils/ip';

export interface SessionSecurityOptions {
  enableSessionRotation?: boolean;
  enableFingerprintValidation?: boolean;
  enableLocationTracking?: boolean;
  sessionTimeout?: number;
  maxConcurrentSessions?: number;
  rotationInterval?: number;
  strictFingerprinting?: boolean;
  logSecurityEvents?: boolean;
  allowDeviceRemembering?: boolean;
  deviceRememberDays?: number;
}

interface SessionFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  ip: string;
  subnet: string;
}

interface SessionInfo {
  id: string;
  userId: string;
  fingerprint: SessionFingerprint;
  createdAt: Date;
  lastActiveAt: Date;
  rotatedAt: Date;
  issuedTokens: string[];
  deviceId?: string;
  trusted: boolean;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

interface SecurityEvent {
  type:
    | 'SESSION_CREATED'
    | 'SESSION_HIJACK_ATTEMPT'
    | 'SESSION_EXPIRED'
    | 'SUSPICIOUS_ACTIVITY'
    | 'TOKEN_ROTATION'
    | 'CONCURRENT_SESSION_LIMIT';
  sessionId: string;
  userId: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, unknown>;
}

const DEFAULT_OPTIONS: Required<SessionSecurityOptions> = {
  enableSessionRotation: true,
  enableFingerprintValidation: true,
  enableLocationTracking: false,
  sessionTimeout: 86400, // 24 hours
  maxConcurrentSessions: 5,
  rotationInterval: 3600, // 1 hour
  strictFingerprinting: false,
  logSecurityEvents: true,
  allowDeviceRemembering: true,
  deviceRememberDays: 30,
};

/**
 * In-memory session store (use Redis in production)
 */
class SessionStore {
  private sessions = new Map<string, SessionInfo>();
  private userSessions = new Map<string, Set<string>>();
  private securityEvents: SecurityEvent[] = [];

  addSession(sessionInfo: SessionInfo): void {
    this.sessions.set(sessionInfo.id, sessionInfo);

    if (!this.userSessions.has(sessionInfo.userId)) {
      this.userSessions.set(sessionInfo.userId, new Set());
    }

    this.userSessions.get(sessionInfo.userId)!.add(sessionInfo.id);
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<SessionInfo>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.sessions.set(sessionId, session);
    }
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }
    }
  }

  getUserSessions(userId: string): SessionInfo[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((session): session is SessionInfo => session !== undefined);
  }

  logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    console.warn(`[Security] ${event.type}:`, {
      sessionId: event.sessionId,
      userId: event.userId,
      ip: event.ip.replace(/\d+$/, '***'), // Mask last IP octet
      timestamp: event.timestamp.toISOString(),
      details: event.details,
    });
  }

  getSecurityEvents(userId?: string): SecurityEvent[] {
    if (userId) {
      return this.securityEvents.filter(event => event.userId === userId);
    }
    return this.securityEvents;
  }

  cleanup(): void {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastActiveAt.getTime();
      const sessionTimeout = DEFAULT_OPTIONS.sessionTimeout * 1000;

      if (sessionAge > sessionTimeout) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      this.removeSession(sessionId);
    }
  }
}

// Global session store
const sessionStore = new SessionStore();

// Cleanup expired sessions every 5 minutes
setInterval(() => sessionStore.cleanup(), 5 * 60 * 1000);

/**
 * Generate session fingerprint from request headers
 */
function generateFingerprint(req: NextApiRequest): SessionFingerprint {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = Array.isArray(req.headers['accept-encoding']) 
    ? req.headers['accept-encoding'].join(', ') 
    : req.headers['accept-encoding'] || '';
  const ip = getClientIp(req);

  // Generate subnet (first 3 octets for IPv4)
  const subnet = ip.split('.').slice(0, 3).join('.');

  return {
    userAgent,
    acceptLanguage,
    acceptEncoding,
    ip,
    subnet,
  };
}

/**
 * Compare session fingerprints for validation
 */
function validateFingerprint(
  current: SessionFingerprint,
  stored: SessionFingerprint,
  strict: boolean = false
): { valid: boolean; score: number; differences: string[] } {
  const differences: string[] = [];
  let score = 0;

  // IP validation (most important)
  if (current.ip === stored.ip) {
    score += 40;
  } else if (current.subnet === stored.subnet) {
    score += 20; // Same subnet, might be dynamic IP
    differences.push('ip_changed');
  } else {
    differences.push('ip_mismatch');
  }

  // User Agent validation
  if (current.userAgent === stored.userAgent) {
    score += 30;
  } else {
    // Check for minor version changes (browser updates)
    const currentUA = current.userAgent.replace(/\d+\.\d+\.\d+/g, '');
    const storedUA = stored.userAgent.replace(/\d+\.\d+\.\d+/g, '');

    if (currentUA === storedUA) {
      score += 20; // Minor version difference
      differences.push('user_agent_version');
    } else {
      differences.push('user_agent_mismatch');
    }
  }

  // Language validation
  if (current.acceptLanguage === stored.acceptLanguage) {
    score += 15;
  } else {
    differences.push('language_changed');
  }

  // Encoding validation
  if (current.acceptEncoding === stored.acceptEncoding) {
    score += 15;
  } else {
    differences.push('encoding_changed');
  }

  // Determine validity based on score and strictness
  const threshold = strict ? 85 : 60;
  const valid = score >= threshold;

  return { valid, score, differences };
}

/**
 * Generate secure session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate device ID for remembering trusted devices
 */
function generateDeviceId(fingerprint: SessionFingerprint): string {
  const data = `${fingerprint.userAgent}|${fingerprint.acceptLanguage}|${fingerprint.subnet}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Extract session ID from request
 */
function extractSessionId(req: NextApiRequest): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try session cookie
  const cookies = req.headers.cookie;
  if (cookies) {
    const sessionMatch = cookies.match(/session_id=([^;]+)/);
    if (sessionMatch && sessionMatch[1]) {
      return sessionMatch[1];
    }
  }

  return null;
}

/**
 * Set secure session cookie
 */
function setSessionCookie(res: NextApiResponse, sessionId: string, maxAge: number): void {
  const cookieOptions = [
    `session_id=${sessionId}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
}

/**
 * Session Security Middleware
 */
export function withSessionSecurity(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: SessionSecurityOptions = {}
) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const sessionId = extractSessionId(req);
      const currentFingerprint = generateFingerprint(req);
      const now = new Date();

      // Handle new session creation
      if (!sessionId) {
        return handler(req, res);
      }

      // Validate existing session
      const session = sessionStore.getSession(sessionId);

      if (!session) {
        // Session not found - possible expiration or tampering
        if (config.logSecurityEvents) {
          sessionStore.logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            sessionId: sessionId,
            userId: 'unknown',
            ip: currentFingerprint.ip,
            userAgent: currentFingerprint.userAgent,
            timestamp: now,
            details: { reason: 'session_not_found' },
          });
        }

        return res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_INVALID',
            message: 'Session not found or expired',
          },
        });
      }

      // Check session timeout
      const sessionAge = now.getTime() - session.lastActiveAt.getTime();
      if (sessionAge > config.sessionTimeout * 1000) {
        sessionStore.removeSession(sessionId);

        if (config.logSecurityEvents) {
          sessionStore.logSecurityEvent({
            type: 'SESSION_EXPIRED',
            sessionId: sessionId,
            userId: session.userId,
            ip: currentFingerprint.ip,
            userAgent: currentFingerprint.userAgent,
            timestamp: now,
            details: { age: sessionAge },
          });
        }

        return res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired',
          },
        });
      }

      // Validate fingerprint
      if (config.enableFingerprintValidation) {
        const validation = validateFingerprint(
          currentFingerprint,
          session.fingerprint,
          config.strictFingerprinting
        );

        if (!validation.valid) {
          // Potential session hijacking
          if (config.logSecurityEvents) {
            sessionStore.logSecurityEvent({
              type: 'SESSION_HIJACK_ATTEMPT',
              sessionId: sessionId,
              userId: session.userId,
              ip: currentFingerprint.ip,
              userAgent: currentFingerprint.userAgent,
              timestamp: now,
              details: {
                score: validation.score,
                differences: validation.differences,
                original_ip: session.fingerprint.ip,
                current_ip: currentFingerprint.ip,
              },
            });
          }

          sessionStore.removeSession(sessionId);

          return res.status(401).json({
            success: false,
            error: {
              code: 'SESSION_SECURITY_VIOLATION',
              message: 'Session security validation failed',
            },
          });
        }
      }

      // Check concurrent session limit
      if (config.maxConcurrentSessions > 0) {
        const userSessions = sessionStore.getUserSessions(session.userId);
        if (userSessions.length > config.maxConcurrentSessions) {
          // Remove oldest sessions
          const sortedSessions = userSessions.sort(
            (a, b) => a.lastActiveAt.getTime() - b.lastActiveAt.getTime()
          );

          const sessionsToRemove = sortedSessions.slice(0, -config.maxConcurrentSessions);
          for (const oldSession of sessionsToRemove) {
            sessionStore.removeSession(oldSession.id);
          }

          if (config.logSecurityEvents) {
            sessionStore.logSecurityEvent({
              type: 'CONCURRENT_SESSION_LIMIT',
              sessionId: sessionId,
              userId: session.userId,
              ip: currentFingerprint.ip,
              userAgent: currentFingerprint.userAgent,
              timestamp: now,
              details: { removed_sessions: sessionsToRemove.length },
            });
          }
        }
      }

      // Check if session rotation is needed
      if (config.enableSessionRotation) {
        const rotationAge = now.getTime() - session.rotatedAt.getTime();
        if (rotationAge > config.rotationInterval * 1000) {
          // Rotate session ID
          const newSessionId = generateSessionId();

          // Create new session with same data but new ID
          const rotatedSession: SessionInfo = {
            ...session,
            id: newSessionId,
            rotatedAt: now,
            issuedTokens: [], // Clear old tokens
          };

          // Remove old session and add new one
          sessionStore.removeSession(sessionId);
          sessionStore.addSession(rotatedSession);

          // Set new session cookie
          setSessionCookie(res, newSessionId, config.sessionTimeout);

          if (config.logSecurityEvents) {
            sessionStore.logSecurityEvent({
              type: 'TOKEN_ROTATION',
              sessionId: newSessionId,
              userId: session.userId,
              ip: currentFingerprint.ip,
              userAgent: currentFingerprint.userAgent,
              timestamp: now,
              details: { old_session_id: sessionId },
            });
          }

          // Update session reference for handler
          (req as any).sessionId = newSessionId;
          (req as any).session = rotatedSession;
        } else {
          (req as any).sessionId = sessionId;
          (req as any).session = session;
        }
      } else {
        (req as any).sessionId = sessionId;
        (req as any).session = session;
      }

      // Update session activity
      sessionStore.updateSession(sessionId, {
        lastActiveAt: now,
        fingerprint: currentFingerprint, // Update with current fingerprint
      });

      // Add security headers
      res.setHeader('X-Session-Security', 'enabled');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    } catch (error) {
      console.error('Session security middleware error:', error);

      return res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_SECURITY_ERROR',
          message: 'Session security validation failed',
        },
      });
    }

    // Execute the original handler
    return handler(req, res);
  };
}

/**
 * Create new secure session
 */
export function createSecureSession(
  userId: string,
  req: NextApiRequest,
  options: SessionSecurityOptions = {}
): SessionInfo {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const sessionId = generateSessionId();
  const fingerprint = generateFingerprint(req);
  const now = new Date();

  const deviceId = config.allowDeviceRemembering ? generateDeviceId(fingerprint) : undefined;

  const session: SessionInfo = {
    id: sessionId,
    userId,
    fingerprint,
    createdAt: now,
    lastActiveAt: now,
    rotatedAt: now,
    issuedTokens: [],
    ...(deviceId && { deviceId }),
    trusted: false, // Will be set to true after device verification
  };

  sessionStore.addSession(session);

  if (config.logSecurityEvents) {
    sessionStore.logSecurityEvent({
      type: 'SESSION_CREATED',
      sessionId: sessionId,
      userId: userId,
      ip: fingerprint.ip,
      userAgent: fingerprint.userAgent,
      timestamp: now,
      details: { device_id: deviceId },
    });
  }

  return session;
}

/**
 * Destroy session securely
 */
export function destroySession(sessionId: string): boolean {
  const session = sessionStore.getSession(sessionId);
  if (session) {
    sessionStore.removeSession(sessionId);
    return true;
  }
  return false;
}

/**
 * Get session security events for monitoring
 */
export function getSessionSecurityEvents(userId?: string): SecurityEvent[] {
  return sessionStore.getSecurityEvents(userId);
}

/**
 * Utility function to validate session manually
 */
export function validateSession(sessionId: string): SessionInfo | null {
  const session = sessionStore.getSession(sessionId);
  if (!session) {
    return null;
  }

  const now = Date.now();
  const sessionAge = now - session.lastActiveAt.getTime();

  if (sessionAge > DEFAULT_OPTIONS.sessionTimeout * 1000) {
    sessionStore.removeSession(sessionId);
    return null;
  }

  return session;
}

export default withSessionSecurity;
