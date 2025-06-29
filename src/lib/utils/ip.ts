/**
 * IP Address Utilities for AIRWAVE
 * Handles client IP detection with proxy and CDN support
 */

import { NextApiRequest } from 'next';

/**
 * Extract client IP address from request
 * Handles various proxy and CDN scenarios
 */
export function getClientIp(req: NextApiRequest): string {
  // Check various headers that might contain the real client IP
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare
  const trueClientIp = req.headers['true-client-ip']; // Akamai
  const xClientIp = req.headers['x-client-ip'];

  // X-Forwarded-For can contain multiple IPs, take the first one
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const firstIp = ips?.split(',')[0]?.trim();
    if (firstIp && isValidIp(firstIp)) {
      return firstIp;
    }
  }

  // Check other headers in order of reliability
  if (realIp && isValidIp(realIp as string)) {
    return realIp as string;
  }

  if (cfConnectingIp && isValidIp(cfConnectingIp as string)) {
    return cfConnectingIp as string;
  }

  if (trueClientIp && isValidIp(trueClientIp as string)) {
    return trueClientIp as string;
  }

  if (xClientIp && isValidIp(xClientIp as string)) {
    return xClientIp as string;
  }

  // Fallback to connection remote address
  const connectionRemoteAddress = req.socket?.remoteAddress;
  if (connectionRemoteAddress && isValidIp(connectionRemoteAddress)) {
    return connectionRemoteAddress;
  }

  // Final fallback - this should not happen in production
  return '127.0.0.1';
}

/**
 * Basic IP address validation
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') {
    return false;
  }

  // IPv4 regex
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Check if IP is from a private network
 */
export function isPrivateIp(ip: string): boolean {
  if (!isValidIp(ip)) {
    return false;
  }

  // Private IP ranges
  const privateRanges = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^127\./, // 127.0.0.0/8 (localhost)
    /^169\.254\./, // 169.254.0.0/16 (link-local)
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Get geographical region from IP (basic implementation)
 * In production, you might want to use a service like MaxMind GeoIP
 */
export function getRegionFromIp(ip: string): string {
  if (!isValidIp(ip) || isPrivateIp(ip)) {
    return 'unknown';
  }

  // This is a very basic implementation
  // In production, integrate with a proper GeoIP service
  const firstOctet = parseInt(ip?.split('.')[0] || '0');

  if (firstOctet >= 1 && firstOctet <= 126) {
    return 'region-a'; // North America/Europe
  } else if (firstOctet >= 128 && firstOctet <= 191) {
    return 'region-b'; // Asia/Pacific
  } else {
    return 'region-c'; // Other
  }
}

/**
 * Hash IP for privacy-preserving analytics
 */
export function hashIp(ip: string): string {
  if (!isValidIp(ip)) {
    return 'invalid';
  }

  // Simple hash for IP - in production use crypto.createHash
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Check if request is from a trusted proxy
 */
export function isTrustedProxy(ip: string): boolean {
  // Define trusted proxy IP ranges
  const trustedProxies = [
    '127.0.0.1',
    '::1',
    // Add your CDN/proxy IPs here
    // Cloudflare IPs would go here in production
    // Vercel IPs would go here in production
  ];

  return trustedProxies.includes(ip) || isPrivateIp(ip);
}

const ipUtils = {
  getClientIp,
  isValidIp,
  isPrivateIp,
  getRegionFromIp,
  hashIp,
  isTrustedProxy,
};

export default ipUtils;
