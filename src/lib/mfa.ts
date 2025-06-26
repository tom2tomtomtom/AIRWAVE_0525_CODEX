import { getErrorMessage } from '@/utils/errorUtils';
/**
 * Multi-Factor Authentication (MFA) Implementation
 *
 * This module provides TOTP (Time-based One-Time Password) support
 * for enhanced security in AIrFLOW platform.
 */

import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { supabase } from './supabase';

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAValidationResult {
  success: boolean;
  error?: string;
}

/**
 * Generate TOTP secret for new MFA setup
 */
export function generateMFASecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate backup codes for MFA recovery
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Generate QR code URL for TOTP setup
 */
export async function generateQRCode(
  secret: string,
  userEmail: string,
  issuer: string = 'AIrFLOW'
): Promise<string> {
  const otpAuthUrl = authenticator.keyuri(userEmail, issuer, secret);
  return await QRCode.toDataURL(otpAuthUrl);
}

/**
 * Complete MFA setup for a user
 */
export async function setupMFA(userId: string, userEmail: string): Promise<MFASetupResult> {
  const secret = generateMFASecret();
  const backupCodes = generateBackupCodes();
  const qrCodeUrl = await generateQRCode(secret, userEmail);

  // Store MFA configuration in database
  const { error } = await supabase.from('user_mfa').upsert({
    user_id: userId,
    secret_encrypted: await encryptSecret(secret),
    backup_codes_encrypted: await encryptBackupCodes(backupCodes),
    is_enabled: false, // User needs to verify first
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to setup MFA: ${error.message}`);
  }

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify TOTP token and enable MFA
 */
export async function verifyAndEnableMFA(
  userId: string,
  token: string
): Promise<MFAValidationResult> {
  try {
    // Get user's MFA configuration
    const { data: mfaConfig, error } = await supabase
      .from('user_mfa')
      .select('secret_encrypted, is_enabled')
      .eq('user_id', userId)
      .single();

    if (error || !mfaConfig) {
      return { success: false, error: 'MFA not configured for this user' };
    }

    if (mfaConfig.is_enabled) {
      return { success: false, error: 'MFA already enabled' };
    }

    // Decrypt secret and verify token
    const secret = await decryptSecret(mfaConfig.secret_encrypted);
    const isValid = authenticator.check(token, secret);

    if (!isValid) {
      return { success: false, error: 'Invalid verification code' };
    }

    // Enable MFA
    const { error: updateError } = await supabase
      .from('user_mfa')
      .update({
        is_enabled: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      return { success: false, error: 'Failed to enable MFA' };
    }

    return { success: true };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('MFA verification error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Validate TOTP token for login
 */
export async function validateMFAToken(
  userId: string,
  token: string,
  isBackupCode: boolean = false
): Promise<MFAValidationResult> {
  try {
    // Get user's MFA configuration
    const { data: mfaConfig, error } = await supabase
      .from('user_mfa')
      .select('secret_encrypted, backup_codes_encrypted, is_enabled, used_backup_codes')
      .eq('user_id', userId)
      .single();

    if (error || !mfaConfig || !mfaConfig.is_enabled) {
      return { success: false, error: 'MFA not enabled for this user' };
    }

    if (isBackupCode) {
      // Validate backup code
      const backupCodes = await decryptBackupCodes(mfaConfig.backup_codes_encrypted);
      const usedCodes = mfaConfig.used_backup_codes || [];

      if (!backupCodes.includes(token) || usedCodes.includes(token)) {
        return { success: false, error: 'Invalid or already used backup code' };
      }

      // Mark backup code as used
      const updatedUsedCodes = [...usedCodes, token];
      const { error: updateError } = await supabase
        .from('user_mfa')
        .update({
          used_backup_codes: updatedUsedCodes,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update backup code usage:', updateError);
      }

      return { success: true };
    } else {
      // Validate TOTP token
      const secret = await decryptSecret(mfaConfig.secret_encrypted);
      const isValid = authenticator.check(token, secret);

      if (!isValid) {
        return { success: false, error: 'Invalid verification code' };
      }

      // Update last used timestamp
      const { error: updateError } = await supabase
        .from('user_mfa')
        .update({
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update MFA usage:', updateError);
      }

      return { success: true };
    }
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('MFA validation error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Check if user has MFA enabled
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_mfa')
      .select('is_enabled')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.is_enabled || false;
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Error checking MFA status:', error);
    return false;
  }
}

/**
 * Disable MFA for a user (with proper verification)
 */
export async function disableMFA(
  userId: string,
  verificationToken: string
): Promise<MFAValidationResult> {
  try {
    // First verify the token
    const validation = await validateMFAToken(userId, verificationToken);
    if (!validation.success) {
      return validation;
    }

    // Disable MFA
    const { error } = await supabase
      .from('user_mfa')
      .update({
        is_enabled: false,
        disabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: 'Failed to disable MFA' };
    }

    return { success: true };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('MFA disable error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Generate new backup codes (invalidates old ones)
 */
export async function regenerateBackupCodes(
  userId: string,
  verificationToken: string
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  try {
    // First verify the token
    const validation = await validateMFAToken(userId, verificationToken);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    // Generate new backup codes
    const newBackupCodes = generateBackupCodes();

    const { error } = await supabase
      .from('user_mfa')
      .update({
        backup_codes_encrypted: await encryptBackupCodes(newBackupCodes),
        used_backup_codes: [], // Reset used codes
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: 'Failed to regenerate backup codes' };
    }

    return { success: true, backupCodes: newBackupCodes };
  } catch (error: any) {
    const message = getErrorMessage(error);
    console.error('Backup code regeneration error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

// Encryption utilities using proper AES-256-GCM encryption
async function encryptSecret(secret: string): Promise<string> {
  const { encryptData } = await import('@/utils/encryption');
  return encryptData(secret);
}

async function decryptSecret(encryptedSecret: string): Promise<string> {
  const { decryptData } = await import('@/utils/encryption');
  return decryptData(encryptedSecret);
}

async function encryptBackupCodes(codes: string[]): Promise<string> {
  const { encryptData } = await import('@/utils/encryption');
  return encryptData(JSON.stringify(codes));
}

async function decryptBackupCodes(encryptedCodes: string): Promise<string[]> {
  const { decryptData } = await import('@/utils/encryption');
  return JSON.parse(decryptData(encryptedCodes));
}
