import crypto from 'crypto';

// AES-256-GCM encryption for MFA secrets
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

// Get encryption key from environment or generate one
function getEncryptionKey(): Buffer {
  const keyFromEnv = process.env.MFA_ENCRYPTION_KEY;

  if (keyFromEnv) {
    return Buffer.from(keyFromEnv, 'base64');
  }

  if (process.env.NODE_ENV === 'development') {
    return crypto.scryptSync('dev-mfa-key-airwave', 'salt', KEY_LENGTH);
  }

  throw new Error('MFA_ENCRYPTION_KEY environment variable is required for production');
}

// Encrypt data using AES-256-GCM
export function encryptData(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipherGCM(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from('mfa-secret'));

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    const result = iv.toString('hex') + tag.toString('hex') + encrypted;
    return result;
  } catch (error: unknown) {
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt data using AES-256-GCM
export function decryptData(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
    const tag = Buffer.from(
      encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2),
      'hex'
    );
    const encrypted = encryptedData.slice((IV_LENGTH + TAG_LENGTH) * 2);

    const decipher = crypto.createDecipherGCM(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from('mfa-secret'));
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: unknown) {
    throw new Error('Failed to decrypt data');
  }
}

// MFA-specific functions
export async function encryptMFASecret(secret: string): Promise<string> {
  return encryptData(secret);
}

export async function decryptMFASecret(encryptedSecret: string): Promise<string> {
  return decryptData(encryptedSecret);
}

export async function encryptBackupCodes(codes: string[]): Promise<string> {
  return encryptData(JSON.stringify(codes));
}

export async function decryptBackupCodes(encryptedCodes: string): Promise<string[]> {
  const decrypted = decryptData(encryptedCodes);
  return JSON.parse(decrypted);
}
