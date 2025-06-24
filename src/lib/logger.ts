import { getErrorMessage } from '@/utils/errorUtils';
import { env } from './env';

// Define Express types locally to avoid dependency
interface Request {
  method: string;
  url: string;
  ip?: string;
  connection?: {
    remoteAddress?: string;
  };
  headers: {},
    [key: string]: string | string[] | undefined;
  };
}

interface Response {
  statusCode: number;
  end: any;
}

interface NextFunction {
  (): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: string | number | boolean | null | undefined | LogContext;
}

class Logger {
  private name: string;
  private minLevel: LogLevel;

  constructor(name: string) {
    this.name = name;
    this.minLevel = this.getMinLevel();
  }

  private getMinLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
      return envLevel as LogLevel;
    }
    return env.NODE_ENV === 'production' ? 'info' : 'debug';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        if (process.env.NODE_ENV === 'development') {
          console.info(formattedMessage);
        }
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }

    // In production, send to external logging service
    if (env.NODE_ENV === 'production' && level === 'error') {
      this.sendToLoggingService(level, message, context);
    }
  }

  private sendToLoggingService(_level: LogLevel, _message: string, _context?: LogContext) {
    // TODO: Implement integration with logging service (e.g., Sentry, LogDNA)
    // Example:
    // if (window.Sentry) {
    //   window.Sentry.captureMessage(message, level);
    // }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = { ...context };
    
    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack};
    } else if (error) {
      errorContext.error = String(error);
    }

    this.log('error', message, errorContext);
  }

  // Create a child logger with additional context
  child(context: LogContext): Logger {
    const childLogger = new Logger(`${this.name}:${context.module || 'child'}`);
    return childLogger;
  }
}

// Factory function to create loggers
export function createLogger(name: string): Logger {
  return new Logger(name);
}

// Alias for createLogger (commonly expected name)
export const getLogger = createLogger;

// Pre-configured loggers for common modules
export const loggers = {
  api: createLogger('api'),
  auth: createLogger('auth'),
  db: createLogger('db'),
  ai: createLogger('ai'),
  storage: createLogger('storage'),
  general: createLogger('app'),
  supabase: createLogger('supabase')};

// Performance logging utility
export function logPerformance<T>(
  logger: Logger,
  operation: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now();
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result
        .then((value) => {
          const duration = performance.now() - start;
          logger.debug(`${operation} completed`, { duration: `${duration.toFixed(2)}ms` });
          return value;
        })
        .catch((error) => {
          const duration = performance.now() - start;
          logger.error(`${operation} failed`, error, { duration: `${duration.toFixed(2)}ms` });
          throw error;
        });
    }
    
    const duration = performance.now() - start;
    logger.debug(`${operation} completed`, { duration: `${duration.toFixed(2)}ms` });
    return result;
  } catch (error: any) {
    const message = getErrorMessage(error);
    const duration = performance.now() - start;
    logger.error(`${operation} failed`, error, { duration: `${duration.toFixed(2)}ms` });
    throw error;
  }
}

// Type definition for Express Request to include custom properties
interface CustomRequest extends Request {
  // Already includes ip and connection from our local Request interface
}

// Request logging middleware helper
export function logRequest(req: CustomRequest, res: Response, next: NextFunction) {
  const logger = loggers.api;
  const start = Date.now();
  
  // Log request
  const userAgent = req.headers['user-agent'];
  logger.info(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent || 'unknown'});

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    res.end = originalEnd;
    
    // Call original end with proper arguments
    if (typeof chunk === 'function') {
      const result = originalEnd(chunk);
      logResponse();
      return result;
    } else if (typeof encoding === 'function') {
      const result = originalEnd(chunk, encoding);
      logResponse();
      return result;
    } else {
      const result = originalEnd(chunk, encoding, cb);
      logResponse();
      return result;
    }
    
    function logResponse() {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.url} ${res.statusCode}`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`});
    }
  };

  next();
}
