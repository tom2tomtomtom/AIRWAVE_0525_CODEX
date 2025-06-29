/**
 * Client-side session management with enhanced security
 * Addresses CRITICAL security vulnerabilities in client-side data handling
 */

import { encryptData, decryptData } from '@/utils/encryption';

interface SecureSessionData {
  userId: string;
  email: string;
  role: string;
  preferences: Record<string, unknown>;
  lastActivity: number;
  deviceId: string;
}

interface EncryptedStorageItem {
  data: string;
  timestamp: number;
  checksum: string;
}

class ClientSessionManager {
  private readonly STORAGE_KEY = 'airwave_session';
  private readonly PREFS_KEY = 'airwave_preferences';
  private readonly MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Store session data securely in localStorage with encryption
   */
  setSecureSessionData(sessionData: SecureSessionData): void {
    try {
      if (typeof window === 'undefined') return;

      const timestamp = Date.now();
      const payload = JSON.stringify({
        ...sessionData,
        timestamp,
      });

      // Encrypt the session data
      const encryptedData = encryptData(payload);

      // Create checksum for integrity verification
      const checksum = this.generateChecksum(encryptedData);

      const storageItem: EncryptedStorageItem = {
        data: encryptedData,
        timestamp,
        checksum,
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageItem));

      // Log session storage (without sensitive data)
      console.debug('Secure session data stored', {
        userId: sessionData.userId.substring(0, 8) + '...',
        timestamp,
      });
    } catch (error) {
      console.error('Failed to store secure session data:', error);
      this.clearSessionData(); // Clear on error for security
    }
  }

  /**
   * Retrieve and decrypt session data from localStorage
   */
  getSecureSessionData(): SecureSessionData | null {
    try {
      if (typeof window === 'undefined') return null;

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const storageItem: EncryptedStorageItem = JSON.parse(stored);

      // Verify integrity
      if (!this.verifyChecksum(storageItem.data, storageItem.checksum)) {
        console.warn('Session data integrity check failed');
        this.clearSessionData();
        return null;
      }

      // Check expiration
      if (Date.now() - storageItem.timestamp > this.MAX_AGE) {
        console.debug('Session data expired');
        this.clearSessionData();
        return null;
      }

      // Decrypt and parse data
      const decryptedPayload = decryptData(storageItem.data);
      const sessionData = JSON.parse(decryptedPayload) as SecureSessionData;

      // Additional validation
      if (!this.validateSessionData(sessionData)) {
        console.warn('Session data validation failed');
        this.clearSessionData();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Failed to retrieve secure session data:', error);
      this.clearSessionData();
      return null;
    }
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(): void {
    const sessionData = this.getSecureSessionData();
    if (sessionData) {
      sessionData.lastActivity = Date.now();
      this.setSecureSessionData(sessionData);
    }
  }

  /**
   * Securely store user preferences (non-sensitive data)
   */
  setUserPreferences(preferences: Record<string, unknown>): void {
    try {
      if (typeof window === 'undefined') return;

      // Sanitize preferences to ensure no sensitive data
      const sanitized = this.sanitizePreferences(preferences);

      const timestamp = Date.now();
      const payload = JSON.stringify({
        preferences: sanitized,
        timestamp,
      });

      // Light encryption for preferences (less sensitive)
      const encryptedPrefs = encryptData(payload);
      localStorage.setItem(this.PREFS_KEY, encryptedPrefs);
    } catch (error) {
      console.error('Failed to store user preferences:', error);
    }
  }

  /**
   * Retrieve user preferences
   */
  getUserPreferences(): Record<string, unknown> {
    try {
      if (typeof window === 'undefined') return {};

      const stored = localStorage.getItem(this.PREFS_KEY);
      if (!stored) return {};

      const decryptedPayload = decryptData(stored);
      const data = JSON.parse(decryptedPayload);

      // Check if preferences are stale (7 days)
      if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this.PREFS_KEY);
        return {};
      }

      return data.preferences || {};
    } catch (error) {
      console.error('Failed to retrieve user preferences:', error);
      localStorage.removeItem(this.PREFS_KEY);
      return {};
    }
  }

  /**
   * Clear all session data
   */
  clearSessionData(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.PREFS_KEY);

    // Clear any other potential session storage
    sessionStorage.clear();

    console.debug('Session data cleared');
  }

  /**
   * Check if user has an active session
   */
  hasActiveSession(): boolean {
    return this.getSecureSessionData() !== null;
  }

  /**
   * Get current user ID safely
   */
  getCurrentUserId(): string | null {
    const sessionData = this.getSecureSessionData();
    return sessionData?.userId || null;
  }

  /**
   * Get current user role safely
   */
  getCurrentUserRole(): string | null {
    const sessionData = this.getSecureSessionData();
    return sessionData?.role || null;
  }

  /**
   * CSRF token management
   */
  generateCSRFToken(): string {
    const token = this.generateSecureToken();
    sessionStorage.setItem('csrf_token', token);
    return token;
  }

  getCSRFToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('csrf_token');
  }

  validateCSRFToken(token: string): boolean {
    const stored = this.getCSRFToken();
    return stored !== null && stored === token;
  }

  /**
   * Private helper methods
   */
  private generateChecksum(data: string): string {
    // Simple checksum for integrity verification
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private verifyChecksum(data: string, checksum: string): boolean {
    return this.generateChecksum(data) === checksum;
  }

  private validateSessionData(data: any): boolean {
    return (
      data &&
      typeof data.userId === 'string' &&
      typeof data.email === 'string' &&
      typeof data.role === 'string' &&
      typeof data.lastActivity === 'number' &&
      data.userId.length > 0 &&
      data.email.includes('@')
    );
  }

  private sanitizePreferences(prefs: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const allowedKeys = [
      'theme',
      'language',
      'timezone',
      'notifications',
      'dashboard_layout',
      'sidebar_collapsed',
      'grid_view',
      'items_per_page',
    ];

    for (const [key, value] of Object.entries(prefs)) {
      if (allowedKeys.includes(key) && this.isSafeValue(value)) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSafeValue(value: unknown): boolean {
    // Only allow primitive values, no objects/functions
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    );
  }

  private generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Security utilities
   */
  detectSuspiciousActivity(): boolean {
    const sessionData = this.getSecureSessionData();
    if (!sessionData) return false;

    // Check for suspicious patterns
    const timeSinceLastActivity = Date.now() - sessionData.lastActivity;
    const maxInactivity = 60 * 60 * 1000; // 1 hour

    if (timeSinceLastActivity > maxInactivity) {
      console.warn('Suspicious activity: Extended inactivity detected');
      return true;
    }

    // Additional checks could include:
    // - Device fingerprint changes
    // - Unusual access patterns
    // - Geographic location changes

    return false;
  }

  /**
   * Emergency cleanup for security incidents
   */
  emergencyCleanup(): void {
    if (typeof window === 'undefined') return;

    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear any potential IndexedDB data
    if ('indexedDB' in window) {
      indexedDB.databases?.().then(databases => {
        databases.forEach(db => {
          if (db.name?.includes('airwave')) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }

    console.warn('Emergency cleanup completed');
  }
}

// Singleton instance
let clientSessionInstance: ClientSessionManager | null = null;

export const getClientSessionManager = (): ClientSessionManager => {
  if (!clientSessionInstance) {
    clientSessionInstance = new ClientSessionManager();
  }
  return clientSessionInstance;
};

// Activity tracking
if (typeof window !== 'undefined') {
  const sessionManager = getClientSessionManager();

  // Update activity on user interactions
  const updateActivity = () => sessionManager.updateActivity();

  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, updateActivity, { passive: true });
  });

  // Periodic security checks
  setInterval(
    () => {
      if (sessionManager.detectSuspiciousActivity()) {
        // Could trigger additional security measures
        console.warn('Suspicious activity detected in session');
      }
    },
    5 * 60 * 1000
  ); // Check every 5 minutes
}

export default getClientSessionManager;
