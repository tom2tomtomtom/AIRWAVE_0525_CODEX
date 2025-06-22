import winston from 'winston';
import { getLoggingConfig } from '@/lib/config';
import { 
  StructuredLogger, 
  LoggerFactory, 
  apiLogger,
  authLogger, 
  workflowLogger,
  aiLogger,
  securityLogger,
  dbLogger 
} from './structured';

// Create legacy winston logger for backwards compatibility
const createLegacyLogger = (name: string): winston.Logger => {
  const config = getLoggingConfig();
  
  const formats = [
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let output = `${timestamp} [${level.toUpperCase()}] [${name}] ${message}`;
      
      if (Object.keys(meta).length > 0) {
        output += ` ${JSON.stringify(meta)}`;
      }
      
      return output;
    })
  ];
  
  const transports: winston.transport[] = [];
  
  // Console transport
  if (config.console.enabled) {
    transports.push(new winston.transports.Console({
      level: config.console.level,
      format: winston.format.combine(
        winston.format.colorize(),
        ...formats
      )
    }));
  }
  
  // File transport
  if (config.file.enabled) {
    transports.push(new winston.transports.File({
      filename: config.file.path,
      level: config.file.level,
      maxsize: config.file.maxSize,
      maxFiles: config.file.maxFiles,
      format: winston.format.combine(...formats)
    }));
  }
  
  return winston.createLogger({
    level: config.level,
    transports,
    exitOnError: false
  });
};

// Legacy loggers for backwards compatibility
export const loggers = {
  general: createLegacyLogger('general'),
  auth: createLegacyLogger('auth'),
  api: createLegacyLogger('api'),
  workflow: createLegacyLogger('workflow'),
  ai: createLegacyLogger('ai'),
  security: createLegacyLogger('security'),
  database: createLegacyLogger('database')
};

// Export structured loggers (recommended for new code)
export {
  StructuredLogger,
  LoggerFactory,
  apiLogger,
  authLogger,
  workflowLogger,
  aiLogger,
  securityLogger,
  dbLogger
};

// Export types for TypeScript
export type { LogContext, StructuredLogEntry } from './structured';

// Helper function to get appropriate logger
export const getLogger = (service: string): StructuredLogger => {
  return LoggerFactory.getLogger(service);
};

// Request-scoped logger factory
export const createRequestLogger = (requestId: string, userId?: string, clientId?: string): StructuredLogger => {
  return LoggerFactory.getLogger('request')
    .withCorrelationId(requestId)
    .child({ userId, clientId });
};

// Middleware logger for Express/Next.js
export const createMiddlewareLogger = () => {
  return (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    // Attach logger to request
    req.logger = createRequestLogger(
      requestId,
      req.user?.id,
      req.user?.clientId
    );
    
    // Log request start
    req.logger.info('Request started', {
      method: req.method,
      route: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId
    });
    
    // Override res.end to log completion
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      
      req.logger.apiRequest({
        method: req.method,
        route: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId
      });
      
      originalEnd.apply(res, args);
    };
    
    next();
  };
};

// Error logger middleware
export const createErrorLogger = () => {
  return (error: Error, req: any, res: any, next: any) => {
    const logger = req.logger || getLogger('error');
    
    logger.error('Unhandled request error', error, {
      method: req.method,
      route: req.path,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id']
    });
    
    next(error);
  };
};

// Graceful shutdown logger
export const setupGracefulShutdown = () => {
  const logger = getLogger('system');
  
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    // Close all winston transports
    Object.values(loggers).forEach(logger => {
      logger.close();
    });
    
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Initialize logging system
export const initializeLogging = () => {
  const logger = getLogger('system');
  
  logger.info('Logging system initialized', {
    environment: process.env.NODE_ENV || 'development',
    logLevel: getLoggingConfig().level,
    transports: {
      console: getLoggingConfig().console.enabled,
      file: getLoggingConfig().file.enabled
    }
  });
  
  // Set up graceful shutdown
  setupGracefulShutdown();
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', reason as Error, {
      promise: promise.toString()
    });
  });
};