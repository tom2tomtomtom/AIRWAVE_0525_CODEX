import crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { loggers } from './logger';
import { env } from './env';

const execAsync = promisify(exec);
const fsUnlink = promisify(fs.unlink);

// File type configuration
const ALLOWED_FILE_TYPES = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'],
  video: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv', 'm4v'],
  audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'],
  document: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'md', 'csv']} as const;

const MIME_TYPE_MAP: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'image/bmp': ['bmp'],
  'image/tiff': ['tiff'],
  'image/x-icon': ['ico'],
  'video/mp4': ['mp4', 'm4v'],
  'video/quicktime': ['mov'],
  'video/x-msvideo': ['avi'],
  'video/x-ms-wmv': ['wmv'],
  'video/x-flv': ['flv'],
  'video/webm': ['webm'],
  'video/x-matroska': ['mkv'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/aac': ['aac'],
  'audio/ogg': ['ogg'],
  'audio/flac': ['flac'],
  'audio/mp4': ['m4a'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'text/plain': ['txt', 'md'],
  'text/rtf': ['rtf'],
  'text/csv': ['csv']};

// Malicious pattern detection
const MALICIOUS_PATTERNS = [
  /\x00/, // Null bytes
  /<script[\s\S]*?<\/script>/gi, // Script tags
  /javascript:/gi, // JavaScript protocol
  /on\w+\s*=/gi, // Event handlers
  /\beval\s*\(/gi, // eval() calls
  /\bexec\s*\(/gi, // exec() calls
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType?: keyof typeof ALLOWED_FILE_TYPES;
  mimeType?: string;
  extension?: string;
  sanitizedFileName?: string;
}

export interface VirusScanResult {
  clean: boolean;
  infected: boolean;
  error?: string;
  threats?: string[];
  scanTime: number;
}

export class FileUploadSecurity {
  private maxFileSize: number;
  private clamAvAvailable: boolean = false;

  constructor() {
    this.maxFileSize = env.MAX_FILE_SIZE || 52428800; // 50MB default
    this.checkClamAV();
  }

  private async checkClamAV(): Promise<void> {
    try {
      await execAsync('clamscan --version');
      this.clamAvAvailable = true;
      loggers.storage.info('ClamAV is available for virus scanning');
    } catch (error: any) {
      this.clamAvAvailable = false;
      loggers.storage.warn('ClamAV not available - virus scanning disabled');
    }
  }

  // Validate file before processing
  async validateFile(
    fileName: string,
    fileSize: number,
    mimeType: string,
    fileBuffer?: Buffer
  ): Promise<FileValidationResult> {
    // Check file size
    if (fileSize > this.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.maxFileSize / 1048576}MB` };
    }

    // Sanitize file name
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const extension = path.extname(sanitizedFileName).toLowerCase().slice(1);

    // Check file extension
    const fileType = this.getFileType(extension);
    if (!fileType) {
      return {
        valid: false,
        error: `File type .${extension} is not allowed` };
    }

    // Validate MIME type
    if (!this.isValidMimeType(mimeType, extension)) {
      return {
        valid: false,
        error: `MIME type ${mimeType} does not match file extension .${extension}` };
    }

    // Check for malicious patterns in file name
    if (this.containsMaliciousPatterns(fileName)) {
      return {
        valid: false,
        error: 'File name contains potentially malicious content' };
    }

    // If file buffer provided, check content
    if (fileBuffer) {
      const contentCheck = await this.checkFileContent(fileBuffer, fileType);
      if (!contentCheck.valid) {
        return contentCheck;
      }
    }

    return {
      valid: true,
      fileType,
      mimeType,
      extension,
      sanitizedFileName};
  }

  // Scan file for viruses
  async scanForViruses(filePath: string): Promise<VirusScanResult> {
    const startTime = Date.now();

    if (!this.clamAvAvailable) {
      loggers.storage.debug('Virus scanning skipped - ClamAV not available');
      return {
        clean: true,
        infected: false,
        scanTime: 0 };
    }

    try {
      // Run ClamAV scan
      const { stdout, stderr } = await execAsync(`clamscan --no-summary "${filePath}"`);
      const scanTime = Date.now() - startTime;

      // Check for infections
      const infected = stdout.includes('FOUND') || stderr.includes('FOUND');
      const threats: string[] = [];

      if (infected) {
        // Extract threat names
        const threatMatches = stdout.match(/(.+): (.+) FOUND/g);
        if (threatMatches) {
          threatMatches.forEach((match: any) => {
            const threat = match.split(': ')[1]?.replace(' FOUND', '');
            if (threat) threats.push(threat);
          });
        }

        loggers.storage.warn('Virus detected in uploaded file', {
          filePath,
          threats: threats.join(', '),
          scanTime});

        // Delete infected file
        try {
          await fsUnlink(filePath);
        } catch (error: any) {
          loggers.storage.error('Failed to delete infected file', error, { filePath });
        }

        return {
          clean: false,
          infected: true,
          threats,
          scanTime};
      }

      loggers.storage.debug('File scan completed - no threats found', {
        filePath,
        scanTime});

      return {
        clean: true,
        infected: false,
        scanTime};
    } catch (error: any) {
      loggers.storage.error('Virus scan failed', error, { filePath });

      return {
        clean: false,
        infected: false,
        error: 'Virus scan failed',
        scanTime: Date.now() - startTime };
    }
  }

  // Check file content for security issues
  private async checkFileContent(
    buffer: Buffer,
    fileType: keyof typeof ALLOWED_FILE_TYPES
  ): Promise<FileValidationResult> {
    // Check for malicious patterns in content
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 8192)); // Check first 8KB

    if (this.containsMaliciousPatterns(content)) {
      return {
        valid: false,
        error: 'File content contains potentially malicious patterns' };
    }

    // Additional checks based on file type
    switch (fileType) {
      case 'image':
        return this.validateImageContent(buffer);
      case 'document':
        return this.validateDocumentContent(buffer);
      default:
        return { valid: true };
    }
  }

  // Validate image content
  private validateImageContent(buffer: Buffer): FileValidationResult {
    // Check for common image file signatures
    const signatures = {
      jpg: [0xff, 0xd8, 0xff],
      png: [0x89, 0x50, 0x4e, 0x47],
      gif: [0x47, 0x49, 0x46],
      webp: [0x52, 0x49, 0x46, 0x46]};

    let validSignature = false;

    for (const [format, signature] of Object.entries(signatures)) {
      if (this.checkFileSignature(buffer, signature)) {
        validSignature = true;
        break;
      }
    }

    if (!validSignature && buffer.length > 100) {
      // Check for SVG
      const content = buffer.toString('utf8', 0, 1000);
      if (!content.includes('<svg') && !content.includes('<?xml')) {
        return {
          valid: false,
          error: 'Invalid image file signature' };
      }
    }

    return { valid: true };
  }

  // Validate document content
  private validateDocumentContent(buffer: Buffer): FileValidationResult {
    // Check for PDF signature
    if (buffer.length > 4) {
      const pdfSignature = buffer.toString('utf8', 0, 4);
      if (pdfSignature === '%PDF') {
        return { valid: true };
      }
    }

    // For other document types, basic validation is sufficient
    return { valid: true };
  }

  // Check file signature
  private checkFileSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) return false;

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }

    return true;
  }

  // Sanitize file name
  private sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts
    let sanitized = path.basename(fileName);

    // Replace special characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now();
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);

    return `${name}_${timestamp}${ext}`;
  }

  // Get file type from extension
  private getFileType(extension: string): keyof typeof ALLOWED_FILE_TYPES | null {
    for (const [type, extensions] of Object.entries(ALLOWED_FILE_TYPES)) {
      if ((extensions as readonly string[]).includes(extension)) {
        return type as keyof typeof ALLOWED_FILE_TYPES;
      }
    }
    return null;
  }

  // Validate MIME type matches extension
  private isValidMimeType(mimeType: string, extension: string): boolean {
    const allowedExtensions = MIME_TYPE_MAP[mimeType];
    return allowedExtensions ? allowedExtensions.includes(extension) : false;
  }

  // Check for malicious patterns
  private containsMaliciousPatterns(content: string): boolean {
    return MALICIOUS_PATTERNS.some(pattern => pattern.test(content));
  }

  // Generate secure file hash
  generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Generate secure file path
  generateSecureFilePath(fileName: string, userId: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Create path structure: /uploads/userId/year/month/day/fileName
    return path.join('uploads', userId, year.toString(), month, day, fileName);
  }
}

// Export singleton instance
export const fileUploadSecurity = new FileUploadSecurity();

export default fileUploadSecurity;
