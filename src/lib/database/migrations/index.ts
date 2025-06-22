import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

export interface Migration {
  id: string;
  name: string;
  version: number;
  up: string;
  down: string;
  checksum: string;
  appliedAt?: string;
  executionTime?: number;
}

export interface MigrationResult {
  success: boolean;
  migration: Migration;
  error?: string;
  executionTime: number;
}

export class MigrationManager {
  private supabase = createClient();
  private migrationsPath: string;
  
  constructor(migrationsPath = path.join(process.cwd(), 'src/lib/database/migrations/files')) {
    this.migrationsPath = migrationsPath;
  }
  
  // Initialize migration tracking table
  async initialize(): Promise<void> {
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        execution_time_ms INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);
    `;
    
    try {
      const { error } = await this.supabase.rpc('exec_sql', { 
        sql: createMigrationsTable 
      });
      
      if (error) {
        throw new Error(`Failed to initialize migrations table: ${error.message}`);
      }
      
      loggers.general.info('Migration tracking table initialized');
    } catch (error) {
      loggers.general.error('Failed to initialize migration system', error);
      throw error;
    }
  }
  
  // Load migration files from disk
  async loadMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure chronological order
      
      const migrations: Migration[] = [];
      
      for (const file of migrationFiles) {
        const filePath = path.join(this.migrationsPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Parse migration file
        const migration = this.parseMigrationFile(file, content);
        migrations.push(migration);
      }
      
      return migrations.sort((a, b) => a.version - b.version);
    } catch (error) {
      loggers.general.error('Failed to load migrations', error);
      throw error;
    }
  }
  
  // Parse migration file format
  private parseMigrationFile(filename: string, content: string): Migration {
    const lines = content.split('\n');
    const metadata: Record<string, string> = {};
    let upSection = '';
    let downSection = '';
    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse metadata comments
      if (trimmed.startsWith('-- @')) {
        const [key, ...valueParts] = trimmed.substring(4).split(':');
        metadata[key.trim()] = valueParts.join(':').trim();
        continue;
      }
      
      // Section markers
      if (trimmed === '-- +migrate Up') {
        currentSection = 'up';
        continue;
      }
      if (trimmed === '-- +migrate Down') {
        currentSection = 'down';
        continue;
      }
      
      // Add content to appropriate section
      if (currentSection === 'up') {
        upSection += line + '\n';
      } else if (currentSection === 'down') {
        downSection += line + '\n';
      }
    }
    
    // Extract version from filename (e.g., "001_initial_schema.sql" -> 1)
    const versionMatch = filename.match(/^(\d+)_/);
    const version = versionMatch ? parseInt(versionMatch[1], 10) : 0;
    
    // Generate checksum
    const checksum = this.generateChecksum(upSection + downSection);
    
    return {
      id: metadata.id || filename.replace('.sql', ''),
      name: metadata.name || filename.replace(/^\d+_/, '').replace('.sql', ''),
      version,
      up: upSection.trim(),
      down: downSection.trim(),
      checksum
    };
  }
  
  // Generate SHA-256 checksum
  private generateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  // Get applied migrations from database
  async getAppliedMigrations(): Promise<Migration[]> {
    try {
      const { data, error } = await this.supabase
        .from('schema_migrations')
        .select('*')
        .order('version', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to fetch applied migrations: ${error.message}`);
      }
      
      return (data || []).map(row => ({
        id: row.migration_id,
        name: row.name,
        version: row.version,
        up: '',
        down: '',
        checksum: row.checksum,
        appliedAt: row.applied_at,
        executionTime: row.execution_time_ms
      }));
    } catch (error) {
      loggers.general.error('Failed to get applied migrations', error);
      throw error;
    }
  }
  
  // Get pending migrations
  async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    return allMigrations.filter(migration => !appliedVersions.has(migration.version));
  }
  
  // Apply a single migration
  async applyMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      loggers.general.info(`Applying migration: ${migration.name} (v${migration.version})`);
      
      // Execute the migration SQL
      const { error: sqlError } = await this.supabase.rpc('exec_sql', {
        sql: migration.up
      });
      
      if (sqlError) {
        throw new Error(`Migration SQL failed: ${sqlError.message}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Record migration in tracking table
      const { error: recordError } = await this.supabase
        .from('schema_migrations')
        .insert({
          migration_id: migration.id,
          name: migration.name,
          version: migration.version,
          checksum: migration.checksum,
          execution_time_ms: executionTime
        });
      
      if (recordError) {
        throw new Error(`Failed to record migration: ${recordError.message}`);
      }
      
      loggers.general.info(`Migration applied successfully: ${migration.name}`, {
        version: migration.version,
        executionTime
      });
      
      return {
        success: true,
        migration,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      loggers.general.error(`Migration failed: ${migration.name}`, {
        version: migration.version,
        error: errorMessage,
        executionTime
      });
      
      return {
        success: false,
        migration,
        error: errorMessage,
        executionTime
      };
    }
  }
  
  // Rollback a migration
  async rollbackMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      loggers.general.info(`Rolling back migration: ${migration.name} (v${migration.version})`);
      
      if (!migration.down) {
        throw new Error('No rollback SQL defined for this migration');
      }
      
      // Execute rollback SQL
      const { error: sqlError } = await this.supabase.rpc('exec_sql', {
        sql: migration.down
      });
      
      if (sqlError) {
        throw new Error(`Rollback SQL failed: ${sqlError.message}`);
      }
      
      // Remove from tracking table
      const { error: deleteError } = await this.supabase
        .from('schema_migrations')
        .delete()
        .eq('migration_id', migration.id);
      
      if (deleteError) {
        throw new Error(`Failed to remove migration record: ${deleteError.message}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      loggers.general.info(`Migration rolled back successfully: ${migration.name}`, {
        version: migration.version,
        executionTime
      });
      
      return {
        success: true,
        migration,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      loggers.general.error(`Rollback failed: ${migration.name}`, {
        version: migration.version,
        error: errorMessage,
        executionTime
      });
      
      return {
        success: false,
        migration,
        error: errorMessage,
        executionTime
      };
    }
  }
  
  // Apply all pending migrations
  async migrate(): Promise<MigrationResult[]> {
    await this.initialize();
    
    const pendingMigrations = await this.getPendingMigrations();
    const results: MigrationResult[] = [];
    
    if (pendingMigrations.length === 0) {
      loggers.general.info('No pending migrations to apply');
      return results;
    }
    
    loggers.general.info(`Applying ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      const result = await this.applyMigration(migration);
      results.push(result);
      
      if (!result.success) {
        loggers.general.error('Migration failed, stopping execution', {
          failedMigration: migration.name,
          error: result.error
        });
        break;
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    loggers.general.info('Migration batch completed', {
      total: results.length,
      successful,
      failed
    });
    
    return results;
  }
  
  // Rollback to a specific version
  async rollbackTo(targetVersion: number): Promise<MigrationResult[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationsToRollback = appliedMigrations
      .filter(m => m.version > targetVersion)
      .sort((a, b) => b.version - a.version); // Reverse order for rollback
    
    const results: MigrationResult[] = [];
    
    if (migrationsToRollback.length === 0) {
      loggers.general.info(`No migrations to rollback to version ${targetVersion}`);
      return results;
    }
    
    loggers.general.info(`Rolling back ${migrationsToRollback.length} migrations to version ${targetVersion}`);
    
    // Load full migration definitions for rollback
    const allMigrations = await this.loadMigrations();
    const migrationMap = new Map(allMigrations.map(m => [m.version, m]));
    
    for (const appliedMigration of migrationsToRollback) {
      const fullMigration = migrationMap.get(appliedMigration.version);
      if (!fullMigration) {
        loggers.general.error(`Migration definition not found for version ${appliedMigration.version}`);
        continue;
      }
      
      const result = await this.rollbackMigration(fullMigration);
      results.push(result);
      
      if (!result.success) {
        loggers.general.error('Rollback failed, stopping execution', {
          failedMigration: fullMigration.name,
          error: result.error
        });
        break;
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    loggers.general.info('Rollback batch completed', {
      total: results.length,
      successful,
      failed,
      targetVersion
    });
    
    return results;
  }
  
  // Get migration status
  async getStatus(): Promise<{
    applied: Migration[];
    pending: Migration[];
    total: number;
    currentVersion: number;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    const total = applied.length + pending.length;
    const currentVersion = applied.length > 0 ? 
      Math.max(...applied.map(m => m.version)) : 0;
    
    return {
      applied,
      pending,
      total,
      currentVersion
    };
  }
  
  // Validate migration checksums
  async validateMigrations(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      const currentMigrations = await this.loadMigrations();
      
      for (const applied of appliedMigrations) {
        const current = currentMigrations.find(m => m.version === applied.version);
        
        if (!current) {
          errors.push(`Applied migration v${applied.version} not found in migration files`);
          continue;
        }
        
        if (current.checksum !== applied.checksum) {
          errors.push(`Checksum mismatch for migration v${applied.version}: ${current.name}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors
      };
    }
  }
}

// Singleton instance
let migrationManager: MigrationManager | null = null;

export const getMigrationManager = (): MigrationManager => {
  if (!migrationManager) {
    migrationManager = new MigrationManager();
  }
  return migrationManager;
};

// Helper function for CLI usage
export const getAppliedMigrations = async (): Promise<Migration[]> => {
  const manager = getMigrationManager();
  return manager.getAppliedMigrations();
};