import winston from 'winston';
import { getLoggingConfig } from '@/lib/config';

export interface LogContext {
  userId?: string;
  clientId?: string;
  sessionId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  route?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  error?: Error | string;
  metadata?: Record<string, any>;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  environment: string;
  version: string;
  context?: LogContext;
  stack?: string;
  correlationId?: string;
}

export class StructuredLogger {
  private logger: winston.Logger;
  private config = getLoggingConfig();
  private service: string;
  private version: string;
  
  constructor(service: string, version: string = '1.0.0') {
    this.service = service;
    this.version = version;
    this.logger = this.createLogger();
  }
  
  private createLogger(): winston.Logger {
    const formats = [];
    
    // Add timestamp
    formats.push(winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }));
    
    // Add error handling
    formats.push(winston.format.errors({ stack: true }));
    
    // Custom format for structured logging
    formats.push(winston.format.printf((info) => {
      const entry: StructuredLogEntry = {
        timestamp: info.timestamp,
        level: info.level.toUpperCase(),
        message: info.message,
        service: this.service,
        environment: this.config.environment,
        version: this.version,
        context: info.context,
        stack: info.stack,
        correlationId: info.correlationId
      };
      
      // Remove undefined values
      Object.keys(entry).forEach(key => {
        if (entry[key as keyof StructuredLogEntry] === undefined) {
          delete entry[key as keyof StructuredLogEntry];
        }
      });
      
      return JSON.stringify(entry);
    }));
    
    const transports: winston.transport[] = [];
    
    // Console transport
    if (this.config.console.enabled) {
      transports.push(new winston.transports.Console({
        level: this.config.console.level,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
    
    // File transport
    if (this.config.file.enabled) {
      transports.push(new winston.transports.File({
        filename: this.config.file.path,
        level: this.config.file.level,
        maxsize: this.config.file.maxSize,
        maxFiles: this.config.file.maxFiles,
        format: winston.format.combine(...formats)
      }));
    }
    
    // Error file transport
    if (this.config.file.enabled) {
      transports.push(new winston.transports.File({
        filename: this.config.file.path.replace('.log', '.error.log'),
        level: 'error',
        maxsize: this.config.file.maxSize,
        maxFiles: this.config.file.maxFiles,
        format: winston.format.combine(...formats)
      }));
    }
    
    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(...formats),
      transports,
      exitOnError: false
    });
  }
  
  // Core logging methods with context
  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { context });
  }
  
  info(message: string, context?: LogContext): void {
    this.logger.info(message, { context });
  }
  
  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { context });
  }
  
  error(message: string, error?: Error | string, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    };
    
    this.logger.error(message, { 
      context: errorContext,
      stack: error instanceof Error ? error.stack : undefined
    });
  }
  
  // Specialized logging methods
  audit(action: string, context: LogContext & { 
    resourceType: string; 
    resourceId?: string; 
    oldValues?: any; 
    newValues?: any; 
  }): void {
    this.info(`AUDIT: ${action}`, {
      ...context,
      metadata: {
        auditType: 'user_action',
        ...context.metadata
      }
    });
  }
  
  performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 1000 ? 'warn' : 'info';
    this.logger[level](`PERF: ${operation}`, {
      context: {
        ...context,
        duration,
        metadata: {
          performanceType: 'operation_timing',
          ...context?.metadata
        }
      }
    });
  }
  
  security(event: string, context: LogContext & { 
    severity: 'low' | 'medium' | 'high' | 'critical';
    threat?: string;
  }): void {
    this.warn(`SECURITY: ${event}`, {
      ...context,
      metadata: {
        securityType: 'security_event',
        ...context.metadata
      }
    });
  }
  
  apiRequest(context: LogContext & {
    method: string;
    route: string;
    statusCode: number;
    duration: number;
    requestSize?: number;
    responseSize?: number;
  }): void {
    const level = context.statusCode >= 400 ? 'warn' : 'info';
    this.logger[level](`API: ${context.method} ${context.route}`, {
      context: {
        ...context,
        metadata: {
          requestType: 'api_request',
          ...context.metadata
        }
      }
    });
  }
  
  aiGeneration(context: LogContext & {
    provider: string;
    model: string;
    generationType: string;
    tokens?: number;
    cost?: number;
    duration: number;
    success: boolean;
  }): void {
    const level = context.success ? 'info' : 'error';
    this.logger[level](`AI: ${context.generationType} via ${context.provider}`, {
      context: {
        ...context,
        metadata: {
          aiType: 'generation_request',
          ...context.metadata
        }
      }
    });
  }
  
  workflow(workflowId: string, step: string, status: 'started' | 'completed' | 'failed', context?: LogContext): void {
    const level = status === 'failed' ? 'error' : 'info';
    this.logger[level](`WORKFLOW: ${step} ${status}`, {
      context: {
        ...context,
        metadata: {
          workflowType: 'workflow_step',
          workflowId,
          step,
          status,
          ...context?.metadata
        }
      }
    });
  }
  
  // Correlation ID support
  withCorrelationId(correlationId: string): StructuredLogger {
    const childLogger = Object.create(this);
    const originalLogger = this.logger;
    
    childLogger.logger = originalLogger.child({ correlationId });
    return childLogger;
  }
  
  // Create child logger with persistent context
  child(persistentContext: LogContext): StructuredLogger {
    const childLogger = Object.create(this);
    const originalMethods = ['debug', 'info', 'warn', 'error'];
    
    originalMethods.forEach(method => {
      childLogger[method] = (message: string, context?: LogContext) => {
        const mergedContext = { ...persistentContext, ...context };
        this[method as keyof this](message, mergedContext);
      };
    });
    
    return childLogger;
  }
  
  // Metrics and monitoring
  getMetrics(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    recentErrors: Array<{ timestamp: string; message: string; error?: any }>;
  } {
    // Note: This would typically integrate with a metrics system
    return {
      totalLogs: 0,
      logsByLevel: {},
      recentErrors: []
    };
  }
}

// Log formatters for different output targets
export class LogFormatters {
  static json(info: any): string {
    return JSON.stringify(info);
  }
  
  static pretty(info: any): string {
    const { timestamp, level, message, context } = info;
    let output = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    if (context) {
      if (context.userId) output += ` | User: ${context.userId}`;
      if (context.requestId) output += ` | Request: ${context.requestId}`;
      if (context.duration) output += ` | Duration: ${context.duration}ms`;
    }
    
    return output;
  }
  
  static syslog(info: any): string {
    const { timestamp, level, message, service } = info;
    const priority = LogFormatters.getSyslogPriority(level);
    return `<${priority}>${timestamp} ${service}: ${message}`;
  }
  
  private static getSyslogPriority(level: string): number {
    const priorities: Record<string, number> = {
      error: 3,
      warn: 4,
      info: 6,
      debug: 7
    };
    return priorities[level] || 6;
  }
}

// Log sampling for high-volume scenarios
export class LogSampler {
  private samples = new Map<string, { count: number; lastSample: number }>();
  
  shouldSample(key: string, sampleRate: number = 0.1): boolean {
    const sample = this.samples.get(key) || { count: 0, lastSample: 0 };
    sample.count++;
    
    const shouldSample = Math.random() < sampleRate || 
                        (sample.count - sample.lastSample) >= 100; // Always sample every 100th
    
    if (shouldSample) {
      sample.lastSample = sample.count;
      this.samples.set(key, sample);
    }
    
    return shouldSample;
  }
  
  reset(): void {
    this.samples.clear();
  }
}

// Logger factory
export class LoggerFactory {
  private static loggers = new Map<string, StructuredLogger>();
  
  static getLogger(service: string, version?: string): StructuredLogger {
    const key = `${service}:${version || '1.0.0'}`;
    
    if (!this.loggers.has(key)) {
      this.loggers.set(key, new StructuredLogger(service, version));
    }
    
    return this.loggers.get(key)!;
  }
  
  static createRequestLogger(requestId: string): StructuredLogger {
    return this.getLogger('api').withCorrelationId(requestId);
  }
  
  static createUserLogger(userId: string, clientId?: string): StructuredLogger {
    return this.getLogger('user').child({ userId, clientId });
  }
}

// Export singleton loggers for different services
export const apiLogger = LoggerFactory.getLogger('api');
export const authLogger = LoggerFactory.getLogger('auth');
export const workflowLogger = LoggerFactory.getLogger('workflow');
export const aiLogger = LoggerFactory.getLogger('ai');
export const securityLogger = LoggerFactory.getLogger('security');
export const dbLogger = LoggerFactory.getLogger('database');