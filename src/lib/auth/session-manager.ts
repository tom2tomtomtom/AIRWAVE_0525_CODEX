import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getSecurityConfig } from '@/lib/config';
import { loggers } from '@/lib/logger';
import crypto from 'crypto';

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface RefreshTokenData {
  userId: string;
  sessionId: string;
  tokenFamily: string;
  issuedAt: number;
  expiresAt: number;
}

// In-memory session store (use Redis in production)
const activeSessions = new Map<string, SessionData>();
const refreshTokens = new Map<string, RefreshTokenData>();

export class SessionManager {
  private jwtSecret: Uint8Array;
  private config: ReturnType<typeof getSecurityConfig>;
  
  constructor() {
    this.config = getSecurityConfig();
    this.jwtSecret = new TextEncoder().encode(this.config.jwtSecret);
  }
  
  // Generate a secure session ID
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Generate a token family for refresh token rotation
  private generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  // Create a new session
  async createSession(
    userId: string,
    email: string,
    role: string,
    permissions: string[],
    request?: NextRequest
  ): Promise<{ accessToken: string; refreshToken: string; sessionData: SessionData }> {
    const sessionId = this.generateSessionId();
    const tokenFamily = this.generateTokenFamily();
    const now = Date.now();
    
    // Extract client information
    const ipAddress = request?.ip || 
                     request?.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request?.headers.get('x-real-ip') ||
                     'unknown';
    
    const userAgent = request?.headers.get('user-agent') || 'unknown';
    const deviceId = this.generateDeviceId(ipAddress, userAgent);
    
    const sessionData: SessionData = {
      userId,
      email,
      role,
      permissions,
      sessionId,
      issuedAt: now,
      expiresAt: now + this.parseTimeString(this.config.jwtExpiry),
      lastActivity: now,
      ipAddress,
      userAgent,
      deviceId
    };
    
    const refreshTokenData: RefreshTokenData = {
      userId,
      sessionId,
      tokenFamily,
      issuedAt: now,
      expiresAt: now + this.parseTimeString(this.config.refreshTokenExpiry)
    };
    
    // Store session data
    activeSessions.set(sessionId, sessionData);
    const refreshTokenId = `${sessionId}:${tokenFamily}`;
    refreshTokens.set(refreshTokenId, refreshTokenData);
    
    // Create JWT tokens
    const accessToken = await this.createJWT({
      sub: userId,
      email,
      role,
      permissions,
      sessionId,
      deviceId
    }, this.config.jwtExpiry);
    
    const refreshToken = await this.createJWT({
      sub: userId,
      sessionId,
      tokenFamily,
      type: 'refresh'
    }, this.config.refreshTokenExpiry);
    
    loggers.general.info('Session created', {
      userId,
      sessionId,
      ipAddress,
      deviceId: deviceId.substring(0, 8) + '...' // Log partial device ID for privacy
    });
    
    return { accessToken, refreshToken, sessionData };
  }
  
  // Verify and decode access token
  async verifyAccessToken(token: string): Promise<SessionData | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      const sessionId = payload.sessionId as string;
      
      if (!sessionId) {
        loggers.general.warn('Access token missing session ID');
        return null;
      }
      
      const session = activeSessions.get(sessionId);
      if (!session) {
        loggers.general.warn('Session not found', { sessionId });
        return null;
      }
      
      const now = Date.now();
      
      // Check if session has expired
      if (now > session.expiresAt) {
        loggers.general.info('Session expired', { sessionId, userId: session.userId });
        activeSessions.delete(sessionId);
        return null;
      }
      
      // Update last activity
      session.lastActivity = now;
      activeSessions.set(sessionId, session);
      
      return session;
    } catch (error) {
      loggers.general.warn('Access token verification failed', error);
      return null;
    }
  }
  
  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const { payload } = await jwtVerify(refreshToken, this.jwtSecret);
      
      if (payload.type !== 'refresh') {
        loggers.general.warn('Invalid token type for refresh');
        return null;
      }
      
      const sessionId = payload.sessionId as string;
      const tokenFamily = payload.tokenFamily as string;
      const refreshTokenId = `${sessionId}:${tokenFamily}`;
      
      const storedRefreshToken = refreshTokens.get(refreshTokenId);
      if (!storedRefreshToken) {
        loggers.general.warn('Refresh token not found', { sessionId, tokenFamily });
        return null;
      }
      
      const session = activeSessions.get(sessionId);
      if (!session) {
        loggers.general.warn('Session not found for refresh', { sessionId });
        refreshTokens.delete(refreshTokenId);
        return null;
      }
      
      const now = Date.now();
      
      // Check if refresh token has expired
      if (now > storedRefreshToken.expiresAt) {
        loggers.general.info('Refresh token expired', { sessionId, userId: session.userId });
        refreshTokens.delete(refreshTokenId);
        activeSessions.delete(sessionId);
        return null;
      }
      
      // Generate new token family for rotation
      const newTokenFamily = this.generateTokenFamily();
      
      // Remove old refresh token
      refreshTokens.delete(refreshTokenId);
      
      // Create new refresh token
      const newRefreshTokenData: RefreshTokenData = {
        userId: session.userId,
        sessionId,
        tokenFamily: newTokenFamily,
        issuedAt: now,
        expiresAt: now + this.parseTimeString(this.config.refreshTokenExpiry)
      };
      
      const newRefreshTokenId = `${sessionId}:${newTokenFamily}`;
      refreshTokens.set(newRefreshTokenId, newRefreshTokenData);
      
      // Update session
      session.lastActivity = now;
      session.expiresAt = now + this.parseTimeString(this.config.jwtExpiry);
      activeSessions.set(sessionId, session);
      
      // Create new tokens
      const newAccessToken = await this.createJWT({
        sub: session.userId,
        email: session.email,
        role: session.role,
        permissions: session.permissions,
        sessionId,
        deviceId: session.deviceId
      }, this.config.jwtExpiry);
      
      const newRefreshToken = await this.createJWT({
        sub: session.userId,
        sessionId,
        tokenFamily: newTokenFamily,
        type: 'refresh'
      }, this.config.refreshTokenExpiry);
      
      loggers.general.info('Tokens refreshed', {
        userId: session.userId,
        sessionId,
        oldTokenFamily: tokenFamily,
        newTokenFamily
      });
      
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
      
    } catch (error) {
      loggers.general.warn('Refresh token verification failed', error);
      return null;
    }
  }
  
  // Revoke a specific session
  async revokeSession(sessionId: string): Promise<void> {
    const session = activeSessions.get(sessionId);
    if (session) {
      activeSessions.delete(sessionId);
      
      // Remove all refresh tokens for this session
      for (const [key, refreshToken] of refreshTokens.entries()) {
        if (refreshToken.sessionId === sessionId) {
          refreshTokens.delete(key);
        }
      }
      
      loggers.general.info('Session revoked', {
        userId: session.userId,
        sessionId
      });
    }
  }
  
  // Revoke all sessions for a user
  async revokeAllUserSessions(userId: string): Promise<void> {
    let revokedCount = 0;
    
    // Remove all sessions for the user
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.userId === userId) {
        activeSessions.delete(sessionId);
        revokedCount++;
      }
    }
    
    // Remove all refresh tokens for the user
    for (const [key, refreshToken] of refreshTokens.entries()) {
      if (refreshToken.userId === userId) {
        refreshTokens.delete(key);
      }
    }
    
    loggers.general.info('All user sessions revoked', {
      userId,
      revokedCount
    });
  }
  
  // Get all active sessions for a user
  getUserSessions(userId: string): SessionData[] {
    const userSessions: SessionData[] = [];
    
    for (const session of activeSessions.values()) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }
    
    return userSessions.sort((a, b) => b.lastActivity - a.lastActivity);
  }
  
  // Clean up expired sessions
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedRefreshTokens = 0;
    
    // Clean up expired sessions
    for (const [sessionId, session] of activeSessions.entries()) {
      if (now > session.expiresAt) {
        activeSessions.delete(sessionId);
        cleanedSessions++;
      }
    }
    
    // Clean up expired refresh tokens
    for (const [key, refreshToken] of refreshTokens.entries()) {
      if (now > refreshToken.expiresAt) {
        refreshTokens.delete(key);
        cleanedRefreshTokens++;
      }
    }
    
    if (cleanedSessions > 0 || cleanedRefreshTokens > 0) {
      loggers.general.info('Cleaned up expired sessions', {
        expiredSessions: cleanedSessions,
        expiredRefreshTokens: cleanedRefreshTokens
      });
    }
  }
  
  // Helper methods
  private async createJWT(payload: Record<string, any>, expiry: string): Promise<string> {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiry)
      .sign(this.jwtSecret);
  }
  
  private parseTimeString(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1), 10);
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return parseInt(timeString, 10);
    }
  }
  
  private generateDeviceId(ipAddress: string, userAgent: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${ipAddress}:${userAgent}`);
    return hash.digest('hex');
  }
  
  // Set secure cookies
  setSecureCookies(accessToken: string, refreshToken: string): void {
    const cookieStore = cookies();
    const config = this.config;
    
    const commonOptions = {
      httpOnly: true,
      secure: config.cookieOptions.secure,
      sameSite: config.cookieOptions.sameSite as 'strict' | 'lax' | 'none',
      path: '/'
    };
    
    cookieStore.set('access_token', accessToken, {
      ...commonOptions,
      maxAge: this.parseTimeString(this.config.jwtExpiry) / 1000
    });
    
    cookieStore.set('refresh_token', refreshToken, {
      ...commonOptions,
      maxAge: this.parseTimeString(this.config.refreshTokenExpiry) / 1000
    });
  }
  
  // Clear cookies
  clearCookies(): void {
    const cookieStore = cookies();
    
    cookieStore.set('access_token', '', {
      httpOnly: true,
      secure: this.config.cookieOptions.secure,
      sameSite: this.config.cookieOptions.sameSite as 'strict' | 'lax' | 'none',
      path: '/',
      maxAge: 0
    });
    
    cookieStore.set('refresh_token', '', {
      httpOnly: true,
      secure: this.config.cookieOptions.secure,
      sameSite: this.config.cookieOptions.sameSite as 'strict' | 'lax' | 'none',
      path: '/',
      maxAge: 0
    });
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

export const getSessionManager = (): SessionManager => {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
};

// Periodic cleanup of expired sessions
setInterval(() => {
  if (sessionManagerInstance) {
    sessionManagerInstance.cleanupExpiredSessions();
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes