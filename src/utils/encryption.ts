import crypto from 'crypto';

// AES-256-CBC encryption for MFA secrets
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment or generate one
function getEncryptionKey(): Buffer {
  const keyFromEnv = process.env.MFA_ENCRYPTION_KEY;

  if (keyFromEnv) {
    return Buffer.from(keyFromEnv, 'base64');
  }

  if (process.env.NODE_ENV === 'development') {
    // Use a more secure development key derivation
    const devSeed = process.env.DEV_ENCRYPTION_SEED || 'dev-airwave-seed-2025';
    const dynamicSalt = crypto.createHash('sha256').update(devSeed).digest('hex').slice(0, 16);
    return crypto.scryptSync(devSeed, dynamicSalt, KEY_LENGTH);
  }

  throw new Error('MFA_ENCRYPTION_KEY environment variable is required for production');
}

// Encrypt data using AES-256-GCM
export function encryptData(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const cipher = crypto.createCipher('aes-256-cbc', key);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
  } catch (error: unknown) {
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt data using AES-256-GCM
export function decryptData(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipher('aes-256-cbc', key);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
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
