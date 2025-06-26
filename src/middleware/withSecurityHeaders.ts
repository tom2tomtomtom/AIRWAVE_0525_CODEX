/**
 * Comprehensive Security Headers Middleware for AIRWAVE
 * Implements multiple layers of security protection including CSP, HSTS, and privacy headers
 * Provides defense against XSS, clickjacking, MIME sniffing, and other common attacks
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { loggers } from '@/lib/logger';


export interface SecurityHeadersOptions {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enablePermissionsPolicy?: boolean;
  additionalCSPSources?: {
    scriptSrc?: string[];
    styleSrc?: string[];
    imgSrc?: string[];
    connectSrc?: string[];
    fontSrc?: string[];
  };
  customHeaders?: Record<string, string>;
  cspReportUri?: string;
  hstsMaxAge?: number;
  hstsIncludeSubDomains?: boolean;
  hstsPreload?: boolean;
}

const DEFAULT_OPTIONS: SecurityHeadersOptions = {
  enableCSP: true,
  enableHSTS: true,
  enablePermissionsPolicy: true,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: true,
};

/**
 * Build Content Security Policy based on environment and configuration
 */
function buildCSP(options: SecurityHeadersOptions): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const creatomateUrl = 'https://api.creatomate.com';
  const openaiUrl = 'https://api.openai.com';
  const elevenlabsUrl = 'https://api.elevenlabs.io';

  // Base CSP directives
  const cspDirectives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for Next.js hydration in development
      "'unsafe-eval'", // Required for development mode
      ...(options.additionalCSPSources?.scriptSrc || []),
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for styled-components and Material-UI
      'https://fonts.googleapis.com',
      ...(options.additionalCSPSources?.styleSrc || []),
    ],
    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:', // Required for video thumbnails
      ...(options.additionalCSPSources?.imgSrc || []),
    ],
    'font-src': [
      "'self'",
      'data:',
      'https://fonts.gstatic.com',
      ...(options.additionalCSPSources?.fontSrc || []),
    ],
    'connect-src': [
      "'self'",
      supabaseUrl,
      creatomateUrl,
      openaiUrl,
      elevenlabsUrl,
      'wss:', // WebSocket connections
      ...(options.additionalCSPSources?.connectSrc || []),
    ].filter(Boolean),
    'media-src': ["'self'", 'data:', 'blob:', 'https:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  };

  // Add CSP report URI if specified
  if (options.cspReportUri) {
    cspDirectives['report-uri'] = [options.cspReportUri];
  }

  // In production, remove unsafe-inline and unsafe-eval where possible
  if (process.env.NODE_ENV === 'production') {
    // Remove unsafe-eval from script-src in production
    cspDirectives['script-src'] = cspDirectives['script-src'].filter(
      src => src !== "'unsafe-eval'"
    );

    // Consider removing unsafe-inline in production with nonce-based CSP
    // This would require implementing nonce generation for inline scripts
  }

  // Convert to CSP string format
  return Object.entries(cspDirectives)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

/**
 * Build Permissions Policy for enhanced privacy and security
 */
function buildPermissionsPolicy(): string {
  const policies = {
    // Disable potentially dangerous features
    camera: '()',
    microphone: '()',
    geolocation: '()',
    payment: '()',
    usb: '()',
    magnetometer: '()',
    gyroscope: '()',
    accelerometer: '()',
    'ambient-light-sensor': '()',
    autoplay: '()',
    'encrypted-media': '()',
    fullscreen: '(self)',
    midi: '()',
    'picture-in-picture': '()',
    'speaker-selection': '()',
    'sync-xhr': '()',
    'wake-lock': '()',
    'screen-wake-lock': '()',
    'web-share': '()',
    'xr-spatial-tracking': '()',
  };

  return Object.entries(policies)
    .map(([feature, allowlist]) => `${feature}=${allowlist}`)
    .join(', ');
}

/**
 * Build HSTS header based on configuration
 */
function buildHSTS(options: SecurityHeadersOptions): string {
  const parts = [`max-age=${options.hstsMaxAge || 31536000}`];

  if (options.hstsIncludeSubDomains) {
    parts.push('includeSubDomains');
  }

  if (options.hstsPreload) {
    parts.push('preload');
  }

  return parts.join('; ');
}

/**
 * Comprehensive security headers middleware
 */
export function withSecurityHeaders(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: SecurityHeadersOptions = {}
) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Core security headers (always applied)
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      res.setHeader('X-DNS-Prefetch-Control', 'off');
      res.setHeader('X-Download-Options', 'noopen');

      // Cross-Origin headers for enhanced isolation
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      // Server information disclosure prevention
      res.setHeader('Server', 'AIRWAVE');
      res.setHeader('X-Powered-By', 'AIRWAVE');

      // Content Security Policy
      if (config.enableCSP) {
        const csp = buildCSP(config);
        res.setHeader('Content-Security-Policy', csp);

        // Also set CSP as report-only in development for testing
        if (process.env.NODE_ENV === 'development' && config.cspReportUri) {
          res.setHeader('Content-Security-Policy-Report-Only', csp);
        }
      }

      // HTTP Strict Transport Security (HTTPS only)
      if (
        config.enableHSTS &&
        (process.env.NODE_ENV === 'production' || req.headers?.['x-forwarded-proto'] === 'https')
      ) {
        const hsts = buildHSTS(config);
        res.setHeader('Strict-Transport-Security', hsts);
      }

      // Permissions Policy
      if (config.enablePermissionsPolicy) {
        const permissionsPolicy = buildPermissionsPolicy();
        res.setHeader('Permissions-Policy', permissionsPolicy);
      }

      // Custom headers
      if (config.customHeaders) {
        Object.entries(config.customHeaders).forEach(([name, value]) => {
          res.setHeader(name, value);
        });
      }

      // Security-related response headers for API responses
      if (req.url?.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      // Log security header application in development
      if (process.env.NODE_ENV === 'development') {
        loggers.general.error(`[Security] Applied security headers to ${req.method} ${req.url}`);
      }
    } catch (error) {
      console.error('Error applying security headers:', error);
      // Continue with request even if security headers fail
    }

    // Execute the original handler
    return handler(req, res);
  };
}

/**
 * Predefined security configurations for different environments
 */
export const SecurityConfigs = {
  development: {
    enableCSP: true,
    enableHSTS: false, // Disable HSTS in development
    enablePermissionsPolicy: true,
    cspReportUri: '/api/security/csp-report',
  },
  production: {
    enableCSP: true,
    enableHSTS: true,
    enablePermissionsPolicy: true,
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: true,
    cspReportUri: '/api/security/csp-report',
  },
  strict: {
    enableCSP: true,
    enableHSTS: true,
    enablePermissionsPolicy: true,
    hstsMaxAge: 63072000, // 2 years
    hstsIncludeSubDomains: true,
    hstsPreload: true,
    customHeaders: {
      'Expect-CT': 'max-age=86400, enforce',
      'Feature-Policy': "camera 'none'; microphone 'none'; geolocation 'none'",
    },
  },
};

/**
 * Utility function to get environment-specific security configuration
 */
export function getSecurityConfig(): SecurityHeadersOptions {
  const env = process.env.NODE_ENV || 'development';
  const securityLevel = process.env.SECURITY_LEVEL || 'default';

  if (securityLevel === 'strict') {
    return SecurityConfigs.strict;
  }

  return SecurityConfigs[env as keyof typeof SecurityConfigs] || SecurityConfigs.development;
}

export default withSecurityHeaders;
