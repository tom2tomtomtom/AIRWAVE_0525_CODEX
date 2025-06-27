import { Pool, PoolClient, PoolConfig } from 'pg';
import { getDatabaseConfig } from '@/lib/config';
import { loggers } from '@/lib/logger';

export interface ConnectionPoolOptions extends PoolConfig {
  // Pool-specific options
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  
  // Monitoring options
  enableMonitoring?: boolean;
  monitoringInterval?: number;
  
  // Performance options
  statement_timeout?: number;
  query_timeout?: number;
  application_name?: string;
}

export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
  minConnections: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  duration: number;
}

export class DatabaseConnectionPool {
  private pool: Pool;
  private config: ConnectionPoolOptions;
  private isInitialized = false;
  private stats = {
    totalQueries: 0,
    totalDuration: 0,
    slowQueries: 0,
    errors: 0
  };
  
  constructor(options?: Partial<ConnectionPoolOptions>) {
    const dbConfig = getDatabaseConfig();
    
    this.config = {
      // Connection settings
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      
      // Pool settings
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      
      // Performance settings
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'airwave-app',
      
      // Monitoring
      enableMonitoring: true,
      monitoringInterval: 60000,
      
      ...options
    };
    
    this.pool = new Pool(this.config);
    this.setupEventHandlers();
    
    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }
  }
  
  private setupEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      loggers.general.debug('New database connection established');
      
      // Set session configuration
      client.query(`SET statement_timeout = ${this.config.statement_timeout}`);
      client.query(`SET application_name = '${this.config.application_name}'`);
    });
    
    this.pool.on('acquire', () => {
      loggers.general.debug('Connection acquired from pool');
    });
    
    this.pool.on('release', () => {
      loggers.general.debug('Connection released back to pool');
    });
    
    this.pool.on('error', (error: Error) => {
      loggers.general.error('Database pool error', error);
      this.stats.errors++;
    });
    
    this.pool.on('remove', () => {
      loggers.general.debug('Connection removed from pool');
    });
  }
  
  private startMonitoring(): void {
    setInterval(() => {
      const stats = this.getStats();
      
      loggers.general.info('Database pool stats', {
        ...stats,
        queryStats: {
          total: this.stats.totalQueries,
          avgDuration: this.stats.totalQueries > 0 ? this.stats.totalDuration / this.stats.totalQueries : 0,
          slowQueries: this.stats.slowQueries,
          errors: this.stats.errors
        }
      });
    }, this.config.monitoringInterval);
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as timestamp, version()');
      client.release();
      
      loggers.general.info('Database connection pool initialized', {
        timestamp: result.rows[0].timestamp,
        version: result.rows[0].version.split(' ')[0],
        poolConfig: {
          min: this.config.min,
          max: this.config.max,
          idleTimeout: this.config.idleTimeoutMillis,
          connectionTimeout: this.config.connectionTimeoutMillis
        }
      });
      
      this.isInitialized = true;
    } catch (error: any) {
      loggers.general.error('Failed to initialize database pool', error);
      throw error;
    }
  }
  
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.stats.totalQueries++;
      this.stats.totalDuration += duration;
      
      if (duration > 1000) { // Consider queries > 1s as slow
        this.stats.slowQueries++;
        loggers.general.warn('Slow query detected', {
          query: text.substring(0, 100),
          duration,
          params: params?.length || 0
        });
      }
      
      loggers.general.debug('Query executed', {
        query: text.substring(0, 50),
        duration,
        rowCount: result.rowCount
      });
      
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        command: result.command,
        duration
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.stats.errors++;
      
      loggers.general.error('Query failed', {
        query: text.substring(0, 100),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }
  
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      loggers.general.debug('Transaction completed successfully');
      return result;
      
    } catch (error: any) {
      await client.query('ROLLBACK');
      loggers.general.error('Transaction failed, rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getConnection(): Promise<PoolClient> {
    return this.pool.connect();
  }
  
  getStats(): PoolStats {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingRequests: this.pool.waitingCount,
      maxConnections: this.config.max || 10,
      minConnections: this.config.min || 2
    };
  }
  
  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    connections: PoolStats;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        connections: this.getStats()
      };
    } catch (error: any) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        connections: this.getStats(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async close(): Promise<void> {
    await this.pool.end();
    loggers.general.info('Database connection pool closed');
  }
  
  // Query optimization helpers
  async explain(query: string, params?: any[]): Promise<any[]> {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    const result = await this.query(explainQuery, params);
    return result.rows[0]['QUERY PLAN'];
  }
  
  async analyzeTable(tableName: string): Promise<void> {
    await this.query(`ANALYZE ${tableName}`);
    loggers.general.info(`Table statistics updated: ${tableName}`);
  }
  
  async getSlowQueries(limit = 10): Promise<any[]> {
    // This would require pg_stat_statements extension
    const query = `
      SELECT 
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        rows
      FROM pg_stat_statements 
      ORDER BY mean_exec_time DESC 
      LIMIT $1
    `;
    
    try {
      const result = await this.query(query, [limit]);
      return result.rows;
    } catch (error: any) {
      loggers.general.warn('pg_stat_statements not available', error);
      return [];
    }
  }
  
  async vacuum(tableName?: string): Promise<void> {
    const query = tableName ? `VACUUM ANALYZE ${tableName}` : 'VACUUM ANALYZE';
    await this.query(query);
    loggers.general.info(`Vacuum completed${tableName ? ` for ${tableName}` : ''}`);
  }
  
  async getTableSizes(): Promise<Array<{ table_name: string; size: string; rows: number }>> {
    const query = `
      SELECT 
        schemaname,
        tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_tup_ins + n_tup_upd + n_tup_del as rows
      FROM pg_tables t
      LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
    
    const result = await this.query(query);
    return result.rows;
  }
  
  async getIndexUsage(): Promise<Array<{
    table_name: string;
    index_name: string;
    scans: number;
    tuples_read: number;
    tuples_fetched: number;
  }>> {
    const query = `
      SELECT 
        schemaname,
        tablename as table_name,
        indexname as index_name,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
    `;
    
    const result = await this.query(query);
    return result.rows;
  }
}

// Singleton instance
let poolInstance: DatabaseConnectionPool | null = null;

export const getDatabasePool = (options?: Partial<ConnectionPoolOptions>): DatabaseConnectionPool => {
  if (!poolInstance) {
    poolInstance = new DatabaseConnectionPool(options);
  }
  return poolInstance;
};

export const initializePool = async (options?: Partial<ConnectionPoolOptions>): Promise<DatabaseConnectionPool> => {
  const pool = getDatabasePool(options);
  await pool.initialize();
  return pool;
};

export const closePool = async (): Promise<void> => {
  if (poolInstance) {
    await poolInstance.close();
    poolInstance = null;
  }
};

// Helper functions for common operations
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const pool = getDatabasePool();
  return pool.transaction(callback);
};

export const query = async <T = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
  const pool = getDatabasePool();
  return pool.query<T>(text, params);
};