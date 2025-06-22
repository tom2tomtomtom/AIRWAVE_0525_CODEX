import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';
import { getDatabaseConfig } from '@/lib/config';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BackupOptions {
  destination: string;
  includeTables?: string[];
  excludeTables?: string[];
  compress?: boolean;
  verbose?: boolean;
}

export interface RestoreOptions {
  backupFile: string;
  dropExisting?: boolean;
  verbose?: boolean;
}

export interface BackupResult {
  success: boolean;
  file?: string;
  size?: number;
  duration: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  duration: number;
  tablesRestored?: number;
  error?: string;
}

export class DatabaseBackupManager {
  private supabase = createClient();
  private config = getDatabaseConfig();
  
  // Full database backup using pg_dump
  async createBackup(options: BackupOptions): Promise<BackupResult> {
    const startTime = Date.now();
    
    try {
      loggers.general.info('Starting database backup', options);
      
      // Ensure backup directory exists
      await fs.mkdir(path.dirname(options.destination), { recursive: true });
      
      // Generate pg_dump command
      const dumpCommand = this.buildPgDumpCommand(options);
      
      if (options.verbose) {
        loggers.general.info(`Executing backup command: ${dumpCommand}`);
      }
      
      // Execute backup
      const { stdout, stderr } = await execAsync(dumpCommand);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`Backup failed: ${stderr}`);
      }
      
      // Get file size
      const stats = await fs.stat(options.destination);
      const duration = Date.now() - startTime;
      
      loggers.general.info('Database backup completed', {
        file: options.destination,
        size: stats.size,
        duration
      });
      
      return {
        success: true,
        file: options.destination,
        size: stats.size,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      loggers.general.error('Database backup failed', error);
      
      return {
        success: false,
        duration,
        error: errorMessage
      };
    }
  }
  
  // Restore database from backup
  async restoreBackup(options: RestoreOptions): Promise<RestoreResult> {
    const startTime = Date.now();
    
    try {
      loggers.general.info('Starting database restore', options);
      
      // Check if backup file exists
      await fs.access(options.backupFile);
      
      if (options.dropExisting) {
        await this.dropAllTables();
      }
      
      // Generate psql restore command
      const restoreCommand = this.buildPsqlCommand(options);
      
      if (options.verbose) {
        loggers.general.info(`Executing restore command: ${restoreCommand}`);
      }
      
      // Execute restore
      const { stdout, stderr } = await execAsync(restoreCommand);
      
      if (stderr && !stderr.includes('WARNING') && !stderr.includes('NOTICE')) {
        throw new Error(`Restore failed: ${stderr}`);
      }
      
      const duration = Date.now() - startTime;
      
      loggers.general.info('Database restore completed', {
        backupFile: options.backupFile,
        duration
      });
      
      return {
        success: true,
        duration,
        tablesRestored: await this.countTables()
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      loggers.general.error('Database restore failed', error);
      
      return {
        success: false,
        duration,
        error: errorMessage
      };
    }
  }
  
  // Create incremental backup of specific tables
  async createIncrementalBackup(
    tables: string[],
    destination: string,
    since?: Date
  ): Promise<BackupResult> {
    const startTime = Date.now();
    
    try {
      loggers.general.info('Starting incremental backup', { tables, since });
      
      const backupData: Record<string, any[]> = {};
      
      for (const table of tables) {
        let query = this.supabase.from(table).select('*');
        
        if (since) {
          // Assume tables have updated_at or created_at fields
          query = query.or(`updated_at.gte.${since.toISOString()},created_at.gte.${since.toISOString()}`);
        }
        
        const { data, error } = await query;
        
        if (error) {
          throw new Error(`Failed to backup table ${table}: ${error.message}`);
        }
        
        backupData[table] = data || [];
      }
      
      // Write backup to file
      const backupContent = JSON.stringify({
        metadata: {
          timestamp: new Date().toISOString(),
          since: since?.toISOString(),
          tables,
          version: '1.0'
        },
        data: backupData
      }, null, 2);
      
      await fs.writeFile(destination, backupContent, 'utf-8');
      
      const stats = await fs.stat(destination);
      const duration = Date.now() - startTime;
      
      loggers.general.info('Incremental backup completed', {
        file: destination,
        size: stats.size,
        duration,
        tables: tables.length
      });
      
      return {
        success: true,
        file: destination,
        size: stats.size,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      loggers.general.error('Incremental backup failed', error);
      
      return {
        success: false,
        duration,
        error: errorMessage
      };
    }
  }
  
  // Restore from incremental backup
  async restoreIncrementalBackup(backupFile: string): Promise<RestoreResult> {
    const startTime = Date.now();
    
    try {
      loggers.general.info('Starting incremental restore', { backupFile });
      
      const backupContent = await fs.readFile(backupFile, 'utf-8');
      const backup = JSON.parse(backupContent);
      
      if (!backup.metadata || !backup.data) {
        throw new Error('Invalid backup file format');
      }
      
      let tablesRestored = 0;
      
      for (const [table, records] of Object.entries(backup.data) as [string, any[]][]) {
        if (records.length === 0) continue;
        
        // Upsert records (insert or update)
        const { error } = await this.supabase
          .from(table)
          .upsert(records, { onConflict: 'id' });
        
        if (error) {
          loggers.general.warn(`Failed to restore table ${table}`, error);
        } else {
          tablesRestored++;
          loggers.general.info(`Restored ${records.length} records to ${table}`);
        }
      }
      
      const duration = Date.now() - startTime;
      
      loggers.general.info('Incremental restore completed', {
        backupFile,
        duration,
        tablesRestored
      });
      
      return {
        success: true,
        duration,
        tablesRestored
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      loggers.general.error('Incremental restore failed', error);
      
      return {
        success: false,
        duration,
        error: errorMessage
      };
    }
  }
  
  // Schedule automated backups
  async scheduleBackups(schedule: {
    full: { enabled: boolean; cron: string; retention: number };
    incremental: { enabled: boolean; cron: string; retention: number };
    destination: string;
  }): Promise<void> {
    loggers.general.info('Backup scheduling not implemented in this version');
    // Note: In production, this would integrate with a job scheduler like cron or a queue system
  }
  
  // Helper methods
  private buildPgDumpCommand(options: BackupOptions): string {
    const parts = ['pg_dump'];
    
    // Connection parameters
    if (this.config.host) parts.push(`--host=${this.config.host}`);
    if (this.config.port) parts.push(`--port=${this.config.port}`);
    if (this.config.database) parts.push(`--dbname=${this.config.database}`);
    if (this.config.username) parts.push(`--username=${this.config.username}`);
    
    // Backup options
    parts.push('--verbose');
    parts.push('--no-owner');
    parts.push('--no-privileges');
    parts.push('--format=custom');
    
    // Table filtering
    if (options.includeTables) {
      options.includeTables.forEach(table => {
        parts.push(`--table=${table}`);
      });
    }
    
    if (options.excludeTables) {
      options.excludeTables.forEach(table => {
        parts.push(`--exclude-table=${table}`);
      });
    }
    
    // Output file
    parts.push(`--file=${options.destination}`);
    
    return parts.join(' ');
  }
  
  private buildPsqlCommand(options: RestoreOptions): string {
    const parts = ['pg_restore'];
    
    // Connection parameters
    if (this.config.host) parts.push(`--host=${this.config.host}`);
    if (this.config.port) parts.push(`--port=${this.config.port}`);
    if (this.config.database) parts.push(`--dbname=${this.config.database}`);
    if (this.config.username) parts.push(`--username=${this.config.username}`);
    
    // Restore options
    parts.push('--verbose');
    parts.push('--no-owner');
    parts.push('--no-privileges');
    parts.push('--clean'); // Clean before restore
    parts.push('--if-exists'); // Don't error if objects don't exist
    
    // Input file
    parts.push(options.backupFile);
    
    return parts.join(' ');
  }
  
  private async dropAllTables(): Promise<void> {
    const { data: tables, error } = await this.supabase.rpc('get_table_names');
    
    if (error) {
      throw new Error(`Failed to get table list: ${error.message}`);
    }
    
    for (const table of tables || []) {
      try {
        const { error: dropError } = await this.supabase.rpc('drop_table', { table_name: table.table_name });
        if (dropError) {
          loggers.general.warn(`Failed to drop table ${table.table_name}`, dropError);
        }
      } catch (error) {
        loggers.general.warn(`Error dropping table ${table.table_name}`, error);
      }
    }
  }
  
  private async countTables(): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('get_table_names');
      return data?.length || 0;
    } catch (error) {
      return 0;
    }
  }
  
  // Get backup history
  async getBackupHistory(directory: string): Promise<Array<{
    file: string;
    size: number;
    created: Date;
    type: 'full' | 'incremental';
  }>> {
    try {
      const files = await fs.readdir(directory);
      const backups = [];
      
      for (const file of files) {
        if (!file.endsWith('.backup') && !file.endsWith('.json')) continue;
        
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        backups.push({
          file,
          size: stats.size,
          created: stats.birthtime,
          type: file.endsWith('.json') ? 'incremental' as const : 'full' as const
        });
      }
      
      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
      
    } catch (error) {
      loggers.general.error('Failed to get backup history', error);
      return [];
    }
  }
}

// Singleton instance
let backupManagerInstance: DatabaseBackupManager | null = null;

export const getBackupManager = (): DatabaseBackupManager => {
  if (!backupManagerInstance) {
    backupManagerInstance = new DatabaseBackupManager();
  }
  return backupManagerInstance;
};

// Helper functions for CLI usage
export const createFullBackup = async (destination: string, options?: Partial<BackupOptions>): Promise<BackupResult> => {
  const manager = getBackupManager();
  return manager.createBackup({
    destination,
    compress: true,
    verbose: true,
    ...options
  });
};

export const restoreFromBackup = async (backupFile: string, options?: Partial<RestoreOptions>): Promise<RestoreResult> => {
  const manager = getBackupManager();
  return manager.restoreBackup({
    backupFile,
    dropExisting: false,
    verbose: true,
    ...options
  });
};