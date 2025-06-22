import { getLogger } from '@/lib/logger';
import { captureError } from '@/lib/monitoring/apm';

const logger = getLogger('error-classifier');

export interface ErrorContext {
  userId?: string;
  clientId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  route?: string;
  method?: string;
  payload?: any;
  timestamp: number;
  environment: string;
  version: string;
}

export interface ClassifiedError {
  id: string;
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  userVisible: boolean;
  originalError: Error;
  context: ErrorContext;
  fingerprint: string;
  aggregationKey: string;
  metadata: Record<string, any>;
  recoveryActions: RecoveryAction[];
}

export enum ErrorType {
  NETWORK = 'network',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorCategory {
  CLIENT = 'client',
  SERVER = 'server',
  INTEGRATION = 'integration',
  INFRASTRUCTURE = 'infrastructure'
}

export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'circuit_breaker' | 'cache' | 'manual';
  description: string;
  automatic: boolean;
  maxAttempts?: number;
  delay?: number;
  backoffMultiplier?: number;
  condition?: (error: ClassifiedError) => boolean;
}

export class ErrorClassifier {
  private classificationRules: ClassificationRule[] = [];
  
  constructor() {
    this.initializeRules();
  }
  
  classifyError(error: Error, context: Partial<ErrorContext> = {}): ClassifiedError {
    const fullContext: ErrorContext = {
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      ...context
    };
    
    // Generate unique error ID
    const id = this.generateErrorId();
    
    // Apply classification rules
    const classification = this.applyClassificationRules(error, fullContext);
    
    // Generate fingerprint for grouping similar errors
    const fingerprint = this.generateFingerprint(error, classification);
    
    // Generate aggregation key for metrics
    const aggregationKey = this.generateAggregationKey(classification, fullContext);
    
    // Determine recovery actions
    const recoveryActions = this.determineRecoveryActions(classification, error);
    
    const classifiedError: ClassifiedError = {
      id,
      type: classification.type,
      category: classification.category,
      severity: classification.severity,
      retryable: classification.retryable,
      userVisible: classification.userVisible,
      originalError: error,
      context: fullContext,
      fingerprint,
      aggregationKey,
      metadata: this.extractMetadata(error),
      recoveryActions
    };
    
    // Log classified error
    this.logClassifiedError(classifiedError);
    
    // Send to APM if severity is high enough
    if (classification.severity === ErrorSeverity.CRITICAL || classification.severity === ErrorSeverity.HIGH) {
      this.sendToAPM(classifiedError);
    }
    
    return classifiedError;
  }
  
  private initializeRules(): void {
    this.classificationRules = [
      // Network errors
      {
        condition: (error) => this.isNetworkError(error),
        classification: {
          type: ErrorType.NETWORK,
          category: ErrorCategory.INFRASTRUCTURE,
          severity: ErrorSeverity.MEDIUM,
          retryable: true,
          userVisible: true
        }
      },
      
      // Database errors
      {
        condition: (error) => this.isDatabaseError(error),
        classification: {
          type: ErrorType.DATABASE,
          category: ErrorCategory.INFRASTRUCTURE,
          severity: ErrorSeverity.HIGH,
          retryable: true,
          userVisible: false
        }
      },
      
      // Authentication errors
      {
        condition: (error) => this.isAuthenticationError(error),
        classification: {
          type: ErrorType.AUTHENTICATION,
          category: ErrorCategory.CLIENT,
          severity: ErrorSeverity.MEDIUM,
          retryable: false,
          userVisible: true
        }
      },
      
      // Authorization errors
      {
        condition: (error) => this.isAuthorizationError(error),
        classification: {
          type: ErrorType.AUTHORIZATION,
          category: ErrorCategory.CLIENT,
          severity: ErrorSeverity.MEDIUM,
          retryable: false,
          userVisible: true
        }
      },
      
      // Validation errors
      {
        condition: (error) => this.isValidationError(error),
        classification: {
          type: ErrorType.VALIDATION,
          category: ErrorCategory.CLIENT,
          severity: ErrorSeverity.LOW,
          retryable: false,
          userVisible: true
        }
      },
      
      // Rate limit errors
      {
        condition: (error) => this.isRateLimitError(error),
        classification: {
          type: ErrorType.RATE_LIMIT,
          category: ErrorCategory.CLIENT,
          severity: ErrorSeverity.MEDIUM,
          retryable: true,
          userVisible: true
        }
      },
      
      // Timeout errors
      {
        condition: (error) => this.isTimeoutError(error),
        classification: {
          type: ErrorType.TIMEOUT,
          category: ErrorCategory.INFRASTRUCTURE,
          severity: ErrorSeverity.MEDIUM,
          retryable: true,
          userVisible: true
        }
      },
      
      // External service errors
      {
        condition: (error) => this.isExternalServiceError(error),
        classification: {
          type: ErrorType.EXTERNAL_SERVICE,
          category: ErrorCategory.INTEGRATION,
          severity: ErrorSeverity.MEDIUM,
          retryable: true,
          userVisible: false
        }
      },
      
      // Configuration errors
      {
        condition: (error) => this.isConfigurationError(error),
        classification: {
          type: ErrorType.CONFIGURATION,
          category: ErrorCategory.SERVER,
          severity: ErrorSeverity.CRITICAL,
          retryable: false,
          userVisible: false
        }
      },
      
      // System errors (fallback)
      {
        condition: () => true,
        classification: {
          type: ErrorType.UNKNOWN,
          category: ErrorCategory.SERVER,
          severity: ErrorSeverity.MEDIUM,
          retryable: false,
          userVisible: false
        }
      }
    ];
  }
  
  private applyClassificationRules(error: Error, context: ErrorContext): ErrorClassification {
    for (const rule of this.classificationRules) {
      if (rule.condition(error, context)) {
        return rule.classification;
      }
    }
    
    // Fallback (should never reach here due to catch-all rule)
    return {
      type: ErrorType.UNKNOWN,
      category: ErrorCategory.SERVER,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      userVisible: false
    };
  }
  
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  private generateFingerprint(error: Error, classification: ErrorClassification): string {
    const components = [
      classification.type,
      classification.category,
      error.name,
      this.normalizeMessage(error.message),
      this.getStackTraceSignature(error.stack)
    ];
    
    const fingerprint = components.join(':');
    return this.hashString(fingerprint);
  }
  
  private generateAggregationKey(classification: ErrorClassification, context: ErrorContext): string {
    const components = [
      classification.type,
      classification.category,
      context.route || 'unknown',
      context.method || 'unknown'
    ];
    
    return components.join(':');
  }
  
  private determineRecoveryActions(classification: ErrorClassification, error: Error): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    
    switch (classification.type) {
      case ErrorType.NETWORK:
        actions.push({
          type: 'retry',
          description: 'Retry with exponential backoff',
          automatic: true,
          maxAttempts: 3,
          delay: 1000,
          backoffMultiplier: 2
        });
        break;
        
      case ErrorType.DATABASE:
        actions.push({
          type: 'retry',
          description: 'Retry database operation',
          automatic: true,
          maxAttempts: 2,
          delay: 500,
          backoffMultiplier: 1.5
        });
        actions.push({
          type: 'cache',
          description: 'Serve from cache if available',
          automatic: true
        });
        break;
        
      case ErrorType.EXTERNAL_SERVICE:
        actions.push({
          type: 'circuit_breaker',
          description: 'Open circuit breaker for service',
          automatic: true
        });
        actions.push({
          type: 'fallback',
          description: 'Use fallback service or cached data',
          automatic: true
        });
        break;
        
      case ErrorType.RATE_LIMIT:
        actions.push({
          type: 'retry',
          description: 'Retry after rate limit reset',
          automatic: true,
          maxAttempts: 1,
          delay: 60000 // 1 minute
        });
        break;
        
      case ErrorType.TIMEOUT:
        actions.push({
          type: 'retry',
          description: 'Retry with longer timeout',
          automatic: true,
          maxAttempts: 2,
          delay: 2000
        });
        break;
        
      case ErrorType.CONFIGURATION:
        actions.push({
          type: 'manual',
          description: 'Manual intervention required - check configuration',
          automatic: false
        });
        break;
    }
    
    return actions;
  }
  
  private extractMetadata(error: Error): Record<string, any> {
    const metadata: Record<string, any> = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
    
    // Extract additional metadata from known error types
    if (error instanceof TypeError) {
      metadata.errorType = 'TypeError';
    } else if (error instanceof ReferenceError) {
      metadata.errorType = 'ReferenceError';
    } else if (error instanceof SyntaxError) {
      metadata.errorType = 'SyntaxError';
    }
    
    // Extract HTTP status if available
    if ('status' in error) {
      metadata.httpStatus = (error as any).status;
    }
    
    // Extract additional properties
    Object.keys(error).forEach(key => {
      if (!metadata[key] && typeof (error as any)[key] !== 'function') {
        metadata[key] = (error as any)[key];
      }
    });
    
    return metadata;
  }
  
  private logClassifiedError(error: ClassifiedError): void {
    const logLevel = this.getSeverityLogLevel(error.severity);
    const message = `Classified error: ${error.type} - ${error.originalError.message}`;
    
    logger[logLevel](message, {
      errorId: error.id,
      type: error.type,
      category: error.category,
      severity: error.severity,
      retryable: error.retryable,
      fingerprint: error.fingerprint,
      context: error.context
    });
  }
  
  private sendToAPM(error: ClassifiedError): void {
    captureError(error.originalError, {
      tags: {
        errorType: error.type,
        errorCategory: error.category,
        errorSeverity: error.severity,
        errorId: error.id,
        fingerprint: error.fingerprint
      },
      extra: {
        classification: {
          type: error.type,
          category: error.category,
          severity: error.severity,
          retryable: error.retryable
        },
        context: error.context,
        metadata: error.metadata,
        recoveryActions: error.recoveryActions
      },
      user: error.context.userId ? {
        id: error.context.userId,
        clientId: error.context.clientId
      } : undefined
    });
  }
  
  // Error detection methods
  private isNetworkError(error: Error): boolean {
    const networkKeywords = ['network', 'connection', 'timeout', 'dns', 'socket', 'fetch'];
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return networkKeywords.some(keyword => 
      message.includes(keyword) || name.includes(keyword)
    ) || error.name === 'NetworkError';
  }
  
  private isDatabaseError(error: Error): boolean {
    const dbKeywords = ['database', 'sql', 'query', 'connection pool', 'deadlock', 'constraint'];
    const message = error.message.toLowerCase();
    
    return dbKeywords.some(keyword => message.includes(keyword)) ||
           error.name.includes('Database') ||
           error.name.includes('SQL') ||
           'code' in error && ['ECONNREFUSED', 'ETIMEDOUT'].includes((error as any).code);
  }
  
  private isAuthenticationError(error: Error): boolean {
    const authKeywords = ['unauthorized', 'authentication', 'login', 'token', 'credential'];
    const message = error.message.toLowerCase();
    
    return authKeywords.some(keyword => message.includes(keyword)) ||
           error.name === 'AuthenticationError' ||
           ('status' in error && (error as any).status === 401);
  }
  
  private isAuthorizationError(error: Error): boolean {
    const authzKeywords = ['forbidden', 'permission', 'access denied', 'authorization'];
    const message = error.message.toLowerCase();
    
    return authzKeywords.some(keyword => message.includes(keyword)) ||
           error.name === 'AuthorizationError' ||
           ('status' in error && (error as any).status === 403);
  }
  
  private isValidationError(error: Error): boolean {
    const validationKeywords = ['validation', 'invalid', 'required', 'format', 'schema'];
    const message = error.message.toLowerCase();
    
    return validationKeywords.some(keyword => message.includes(keyword)) ||
           error.name.includes('Validation') ||
           ('status' in error && (error as any).status === 400);
  }
  
  private isRateLimitError(error: Error): boolean {
    const rateLimitKeywords = ['rate limit', 'too many requests', 'quota exceeded'];
    const message = error.message.toLowerCase();
    
    return rateLimitKeywords.some(keyword => message.includes(keyword)) ||
           error.name === 'RateLimitError' ||
           ('status' in error && (error as any).status === 429);
  }
  
  private isTimeoutError(error: Error): boolean {
    const timeoutKeywords = ['timeout', 'timed out', 'deadline exceeded'];
    const message = error.message.toLowerCase();
    
    return timeoutKeywords.some(keyword => message.includes(keyword)) ||
           error.name.includes('Timeout') ||
           ('code' in error && (error as any).code === 'ETIMEDOUT');
  }
  
  private isExternalServiceError(error: Error): boolean {
    const serviceKeywords = ['api', 'service', 'external', 'third party', 'upstream'];
    const message = error.message.toLowerCase();
    
    return serviceKeywords.some(keyword => message.includes(keyword)) ||
           ('status' in error && [(error as any).status >= 500, (error as any).status === 502, (error as any).status === 503, (error as any).status === 504].some(Boolean));
  }
  
  private isConfigurationError(error: Error): boolean {
    const configKeywords = ['configuration', 'config', 'environment', 'missing', 'undefined'];
    const message = error.message.toLowerCase();
    
    return configKeywords.some(keyword => message.includes(keyword)) ||
           error.name.includes('Configuration') ||
           error.name === 'ReferenceError';
  }
  
  // Utility methods
  private normalizeMessage(message: string): string {
    // Remove dynamic parts like IDs, timestamps, etc.
    return message
      .replace(/\b\d+\b/g, '<NUMBER>')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '<UUID>')
      .replace(/\b\w+@\w+\.\w+\b/g, '<EMAIL>')
      .toLowerCase()
      .trim();
  }
  
  private getStackTraceSignature(stack?: string): string {
    if (!stack) return 'no-stack';
    
    // Get first few lines of stack trace and normalize
    const lines = stack.split('\n').slice(0, 3);
    const signature = lines
      .map(line => line.replace(/:\d+:\d+/g, ':LINE:COL'))
      .join('|');
    
    return this.hashString(signature).substring(0, 8);
  }
  
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  private getSeverityLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.INFO:
        return 'debug';
      default:
        return 'error';
    }
  }
}

interface ClassificationRule {
  condition: (error: Error, context?: ErrorContext) => boolean;
  classification: ErrorClassification;
}

interface ErrorClassification {
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  userVisible: boolean;
}

// Singleton instance
let classifierInstance: ErrorClassifier | null = null;

export const getErrorClassifier = (): ErrorClassifier => {
  if (!classifierInstance) {
    classifierInstance = new ErrorClassifier();
  }
  return classifierInstance;
};

// Convenience function
export const classifyError = (error: Error, context?: Partial<ErrorContext>): ClassifiedError => {
  return getErrorClassifier().classifyError(error, context);
};