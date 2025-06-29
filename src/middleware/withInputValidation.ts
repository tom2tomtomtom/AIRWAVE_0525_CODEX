import { NextApiRequest, NextApiResponse } from 'next';
import { SecurityEvents } from '@/lib/security/security-logger';
import { sanitizeInput, sanitizeUserContent, sanitizeFilename, sanitizeEmail, sanitizeURL } from '@/utils/sanitization';
import { loggers } from '@/lib/logger';

/**
 * Input validation and sanitization middleware for API endpoints
 * Provides comprehensive protection against XSS, SQL injection, and other attacks
 */

export interface ValidationRule {
  field: string;
  type: 'string' | 'email' | 'url' | 'filename' | 'content' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  sanitize?: boolean;
  allowedDomains?: string[]; // For URL validation
  custom?: (value: any, req: NextApiRequest) => { valid: boolean; message?: string; sanitized?: any };
}

export interface ValidationConfig {
  body?: ValidationRule[];
  query?: ValidationRule[];
  headers?: ValidationRule[];
  skipOnMethods?: string[]; // Skip validation for specific HTTP methods
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  sanitizedData: {
    body?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, any>;
  };
}

/**
 * Middleware factory for input validation
 */
export function withInputValidation(
  config: ValidationConfig,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Skip validation for specified methods
    if (config.skipOnMethods?.includes(req.method || '')) {
      return handler(req, res);
    }

    try {
      const validationResult = await validateRequest(req, config);

      if (!validationResult.valid) {
        // Log validation failure
        SecurityEvents.authFailure(req, 'unknown', `Input validation failed: ${Object.keys(validationResult.errors).join(', ')}`);

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      // Replace request data with sanitized versions
      if (validationResult.sanitizedData.body) {
        req.body = { ...req.body, ...validationResult.sanitizedData.body };
      }
      if (validationResult.sanitizedData.query) {
        req.query = { ...req.query, ...validationResult.sanitizedData.query };
      }

      // Log successful validation for monitoring
      loggers.general.info('Request validation passed', {
        endpoint: req.url,
        method: req.method,
        fieldsValidated: [
          ...(config.body?.map(r => `body.${r.field}`) || []),
          ...(config.query?.map(r => `query.${r.field}`) || []),
          ...(config.headers?.map(r => `headers.${r.field}`) || [])
        ].join(', ')
      });

      return handler(req, res);

    } catch (error) {
      loggers.general.error('Validation middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.url,
        method: req.method
      });

      SecurityEvents.authFailure(req, 'unknown', `Validation middleware error: ${error instanceof Error ? error.message : 'Unknown'}`);

      return res.status(500).json({
        success: false,
        message: 'Internal validation error'
      });
    }
  };
}

/**
 * Validate request against configuration
 */
async function validateRequest(req: NextApiRequest, config: ValidationConfig): Promise<ValidationResult> {
  const errors: Record<string, string[]> = {};
  const sanitizedData: ValidationResult['sanitizedData'] = {};

  // Validate body
  if (config.body && req.body) {
    const { valid, fieldErrors, sanitized } = await validateFields(req.body, config.body, req, 'body');
    if (!valid) {
      Object.assign(errors, fieldErrors);
    }
    if (Object.keys(sanitized).length > 0) {
      sanitizedData.body = sanitized;
    }
  }

  // Validate query parameters
  if (config.query && req.query) {
    const { valid, fieldErrors, sanitized } = await validateFields(req.query, config.query, req, 'query');
    if (!valid) {
      Object.assign(errors, fieldErrors);
    }
    if (Object.keys(sanitized).length > 0) {
      sanitizedData.query = sanitized;
    }
  }

  // Validate headers
  if (config.headers && req.headers) {
    const { valid, fieldErrors, sanitized } = await validateFields(req.headers, config.headers, req, 'headers');
    if (!valid) {
      Object.assign(errors, fieldErrors);
    }
    if (Object.keys(sanitized).length > 0) {
      sanitizedData.headers = sanitized;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
}

/**
 * Validate individual fields
 */
async function validateFields(
  data: Record<string, any>,
  rules: ValidationRule[],
  req: NextApiRequest,
  source: string
): Promise<{ valid: boolean; fieldErrors: Record<string, string[]>; sanitized: Record<string, any> }> {
  const fieldErrors: Record<string, string[]> = {};
  const sanitized: Record<string, any> = {};

  for (const rule of rules) {
    const fieldKey = `${source}.${rule.field}`;
    const value = data[rule.field];
    const fieldErrors_local: string[] = [];

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      fieldErrors_local.push(`${rule.field} is required`);
      continue;
    }

    // Skip validation for optional empty fields
    if (!rule.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type validation and sanitization
    let sanitizedValue = value;

    try {
      switch (rule.type) {
        case 'string':
          if (typeof value !== 'string') {
            fieldErrors_local.push(`${rule.field} must be a string`);
            break;
          }
          if (rule.sanitize !== false) {
            sanitizedValue = sanitizeInput(value, req);
          }
          break;

        case 'email':
          if (typeof value !== 'string') {
            fieldErrors_local.push(`${rule.field} must be a string`);
            break;
          }
          if (!isValidEmail(value)) {
            fieldErrors_local.push(`${rule.field} must be a valid email address`);
          }
          sanitizedValue = sanitizeEmail(value);
          break;

        case 'url':
          if (typeof value !== 'string') {
            fieldErrors_local.push(`${rule.field} must be a string`);
            break;
          }
          try {
            new URL(value);
            sanitizedValue = sanitizeURL(value, req, rule.allowedDomains);
            if (!sanitizedValue) {
              fieldErrors_local.push(`${rule.field} contains blocked or invalid URL`);
            }
          } catch (error) {
            fieldErrors_local.push(`${rule.field} must be a valid URL`);
          }
          break;

        case 'filename':
          if (typeof value !== 'string') {
            fieldErrors_local.push(`${rule.field} must be a string`);
            break;
          }
          sanitizedValue = sanitizeFilename(value, req);
          if (!sanitizedValue) {
            fieldErrors_local.push(`${rule.field} contains invalid filename characters`);
          }
          break;

        case 'content':
          if (typeof value !== 'string') {
            fieldErrors_local.push(`${rule.field} must be a string`);
            break;
          }
          if (rule.sanitize !== false) {
            sanitizedValue = sanitizeUserContent(value, req);
          }
          break;

        case 'number':
          const numValue = Number(value);
          if (isNaN(numValue)) {
            fieldErrors_local.push(`${rule.field} must be a valid number`);
          } else {
            sanitizedValue = numValue;
          }
          break;

        case 'boolean':
          if (typeof value === 'string') {
            sanitizedValue = value.toLowerCase() === 'true';
          } else if (typeof value !== 'boolean') {
            fieldErrors_local.push(`${rule.field} must be a boolean`);
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            fieldErrors_local.push(`${rule.field} must be an array`);
          }
          break;

        case 'object':
          if (typeof value !== 'object' || Array.isArray(value) || value === null) {
            fieldErrors_local.push(`${rule.field} must be an object`);
          }
          break;
      }

      // Length validation (for strings and arrays)
      if ((typeof sanitizedValue === 'string' || Array.isArray(sanitizedValue)) && fieldErrors_local.length === 0) {
        if (rule.minLength !== undefined && sanitizedValue.length < rule.minLength) {
          fieldErrors_local.push(`${rule.field} must be at least ${rule.minLength} characters/items long`);
        }
        if (rule.maxLength !== undefined && sanitizedValue.length > rule.maxLength) {
          fieldErrors_local.push(`${rule.field} must be no more than ${rule.maxLength} characters/items long`);
        }
      }

      // Pattern validation (for strings)
      if (typeof sanitizedValue === 'string' && rule.pattern && fieldErrors_local.length === 0) {
        if (!rule.pattern.test(sanitizedValue)) {
          fieldErrors_local.push(`${rule.field} format is invalid`);
        }
      }

      // Allowed values validation
      if (rule.allowedValues && fieldErrors_local.length === 0) {
        if (!rule.allowedValues.includes(sanitizedValue)) {
          fieldErrors_local.push(`${rule.field} must be one of: ${rule.allowedValues.join(', ')}`);
        }
      }

      // Custom validation
      if (rule.custom && fieldErrors_local.length === 0) {
        const customResult = rule.custom(sanitizedValue, req);
        if (!customResult.valid) {
          fieldErrors_local.push(customResult.message || `${rule.field} failed custom validation`);
        } else if (customResult.sanitized !== undefined) {
          sanitizedValue = customResult.sanitized;
        }
      }

    } catch (error) {
      fieldErrors_local.push(`${rule.field} validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Collect errors
    if (fieldErrors_local.length > 0) {
      fieldErrors[fieldKey] = fieldErrors_local;
    }

    // Store sanitized value if it changed
    if (sanitizedValue !== value && fieldErrors_local.length === 0) {
      sanitized[rule.field] = sanitizedValue;
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    sanitized
  };
}

/**
 * Email validation using RFC 5322 compliant regex
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Predefined validation configurations for common use cases
 */
export const ValidationConfigs = {
  /**
   * Basic user input validation
   */
  userInput: {
    body: [
      { field: 'name', type: 'string' as const, required: true, minLength: 1, maxLength: 100, sanitize: true },
      { field: 'email', type: 'email' as const, required: true },
      { field: 'message', type: 'content' as const, maxLength: 5000, sanitize: true }
    ]
  },

  /**
   * File upload validation
   */
  fileUpload: {
    body: [
      { field: 'filename', type: 'filename' as const, required: true, maxLength: 255 },
      { field: 'contentType', type: 'string' as const, required: true, maxLength: 100 }
    ]
  },

  /**
   * API key validation
   */
  apiAccess: {
    headers: [
      { field: 'x-api-key', type: 'string' as const, required: true, minLength: 32, maxLength: 64 }
    ]
  },

  /**
   * Search/filter validation
   */
  search: {
    query: [
      { field: 'q', type: 'string' as const, maxLength: 500, sanitize: true },
      { field: 'limit', type: 'number' as const, custom: (value: number) => ({
        valid: value >= 1 && value <= 100,
        message: 'Limit must be between 1 and 100'
      })},
      { field: 'offset', type: 'number' as const, custom: (value: number) => ({
        valid: value >= 0,
        message: 'Offset must be non-negative'
      })}
    ]
  },

  /**
   * ID parameter validation
   */
  resourceId: {
    query: [
      { field: 'id', type: 'string' as const, required: true, pattern: /^[a-zA-Z0-9_-]+$/, maxLength: 50 }
    ]
  }
};

export default withInputValidation;