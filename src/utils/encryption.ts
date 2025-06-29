import crypto from 'crypto';

// AES-256-CBC + HMAC encryption for MFA secrets - PRODUCTION SECURE
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment - PRODUCTION READY
function getEncryptionKey(): Buffer {
  const keyFromEnv = process.env.MFA_ENCRYPTION_KEY;

  if (keyFromEnv) {
    return Buffer.from(keyFromEnv, 'base64');
  }

  if (process.env.NODE_ENV === 'development') {
    // Secure development key derivation with proper salt
    const devSeed = process.env.DEV_ENCRYPTION_SEED;
    if (!devSeed) {
      throw new Error('DEV_ENCRYPTION_SEED environment variable is required for development');
    }
    const salt = crypto.createHash('sha256').update('airwave-dev-salt-2025').digest().slice(0, 16);
    return crypto.scryptSync(devSeed, salt, KEY_LENGTH);
  }

  throw new Error('MFA_ENCRYPTION_KEY environment variable is required for production');
}

// Encrypt data using AES-256-CBC with HMAC - SECURE IMPLEMENTATION
export function encryptData(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // Generate random IV for each encryption
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Create HMAC for integrity verification
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(iv.toString('hex') + encrypted);
    const authTag = hmac.digest('hex');

    // Return format: iv:authTag:encryptedData
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  } catch (error: unknown) {
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt data using AES-256-CBC with HMAC - SECURE IMPLEMENTATION
export function decryptData(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Parse the encrypted data format: iv:authTag:encryptedData
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0]!, 'hex');
    const expectedAuthTag = parts[1]!;
    const encrypted = parts[2]!;

    // Verify HMAC for integrity
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(iv.toString('hex') + encrypted);
    const computedAuthTag = hmac.digest('hex');

    // Timing-safe comparison to prevent timing attacks
    if (
      !crypto.timingSafeEqual(
        Buffer.from(expectedAuthTag, 'hex'),
        Buffer.from(computedAuthTag, 'hex')
      )
    ) {
      throw new Error('Data integrity compromised - authentication failed');
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: unknown) {
    throw new Error('Failed to decrypt data or data integrity compromised');
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
