#!/bin/bash

# Database utilities for deployment
# Handles migrations, backups, and database operations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT=""
OPERATION=""
BACKUP_NAME=""
RESTORE_FILE=""
TARGET_VERSION=""
DRY_RUN=false
VERBOSE=false

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO") echo -e "${timestamp} [${BLUE}INFO${NC}] $message" ;;
        "WARN") echo -e "${timestamp} [${YELLOW}WARN${NC}] $message" ;;
        "ERROR") echo -e "${timestamp} [${RED}ERROR${NC}] $message" ;;
        "SUCCESS") echo -e "${timestamp} [${GREEN}SUCCESS${NC}] $message" ;;
        "DEBUG") [[ "$VERBOSE" == "true" ]] && echo -e "${timestamp} [DEBUG] $message" ;;
    esac
}

info() { log "INFO" "$*"; }
warn() { log "WARN" "$*"; }
error() { log "ERROR" "$*"; }
success() { log "SUCCESS" "$*"; }
debug() { log "DEBUG" "$*"; }

usage() {
    cat << EOF
Usage: $0 [OPERATION] [OPTIONS]

Database utilities for AIrWAVE deployment.

OPERATIONS:
    migrate         Run database migrations
    rollback        Rollback migrations
    backup          Create database backup
    restore         Restore from backup
    seed            Seed database with test data
    status          Show migration status
    validate        Validate database schema
    reset           Reset database (destructive)

OPTIONS:
    -e, --environment ENV    Environment (development|test|staging|production)
    -n, --name NAME         Backup name
    -f, --file FILE         Restore file path
    -t, --target VERSION    Target migration version
    -d, --dry-run          Show what would be done
    -v, --verbose          Enable verbose logging
    -h, --help             Show this help

EXAMPLES:
    $0 migrate -e production
    $0 backup -e production -n pre-deploy-backup
    $0 restore -e staging -f backup-20231201.sql
    $0 rollback -e staging -t 5
    $0 status -e production

EOF
}

validate_environment() {
    if [[ -z "$ENVIRONMENT" ]]; then
        error "Environment must be specified with -e/--environment"
        exit 1
    fi
    
    if [[ ! "$ENVIRONMENT" =~ ^(development|test|staging|production)$ ]]; then
        error "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    info "Environment: $ENVIRONMENT"
}

load_database_config() {
    local env_file="$PROJECT_ROOT/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]]; then
        debug "Loading database config from $env_file"
        export $(grep -E '^DATABASE_' "$env_file" | xargs)
    fi
    
    if [[ -z "${DATABASE_URL:-}" ]]; then
        error "DATABASE_URL not configured for environment: $ENVIRONMENT"
        exit 1
    fi
    
    debug "Database URL: ${DATABASE_URL%:*}" # Hide password
}

run_migrations() {
    info "Running database migrations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would run migrations for $ENVIRONMENT"
        node -e "
            const { getMigrationManager } = require('./src/lib/database/migrations');
            getMigrationManager().getPendingMigrations().then(pending => {
                console.log('Pending migrations:');
                pending.forEach(m => console.log('  -', m.name));
            });
        "
        return 0
    fi
    
    # Run migrations using our migration system
    node -e "
        const { getMigrationManager } = require('./src/lib/database/migrations');
        
        async function runMigrations() {
            const manager = getMigrationManager();
            try {
                const results = await manager.migrate();
                console.log('Migration results:');
                results.forEach(result => {
                    console.log(\`  \${result.success ? '✅' : '❌'} \${result.migration.name}\`);
                    if (result.error) console.log(\`     Error: \${result.error}\`);
                });
                
                if (results.some(r => !r.success)) {
                    process.exit(1);
                }
            } catch (error) {
                console.error('Migration failed:', error);
                process.exit(1);
            }
        }
        
        runMigrations();
    "
    
    success "Migrations completed successfully"
}

rollback_migrations() {
    if [[ -z "$TARGET_VERSION" ]]; then
        error "Target version must be specified with -t/--target for rollback"
        exit 1
    fi
    
    info "Rolling back migrations to version $TARGET_VERSION..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would rollback to version $TARGET_VERSION"
        return 0
    fi
    
    # Rollback using our migration system
    node -e "
        const { getMigrationManager } = require('./src/lib/database/migrations');
        
        async function rollbackMigrations() {
            const manager = getMigrationManager();
            try {
                const results = await manager.rollbackTo($TARGET_VERSION);
                console.log('Rollback results:');
                results.forEach(result => {
                    console.log(\`  \${result.success ? '✅' : '❌'} \${result.migration.name}\`);
                    if (result.error) console.log(\`     Error: \${result.error}\`);
                });
                
                if (results.some(r => !r.success)) {
                    process.exit(1);
                }
            } catch (error) {
                console.error('Rollback failed:', error);
                process.exit(1);
            }
        }
        
        rollbackMigrations();
    "
    
    success "Rollback completed successfully"
}

create_backup() {
    local backup_name="${BACKUP_NAME:-airwave-backup-$(date +%Y%m%d-%H%M%S)}"
    
    info "Creating database backup: $backup_name"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would create backup $backup_name"
        return 0
    fi
    
    # Create backup using our backup system
    node -e "
        const { getBackupManager } = require('./src/lib/database/backup');
        
        async function createBackup() {
            const manager = getBackupManager();
            try {
                const backupPath = './backups/$backup_name.backup';
                const result = await manager.createBackup({
                    destination: backupPath,
                    compress: true,
                    verbose: $VERBOSE
                });
                
                if (result.success) {
                    console.log(\`Backup created: \${result.file}\`);
                    console.log(\`Size: \${(result.size / 1024 / 1024).toFixed(2)} MB\`);
                    console.log(\`Duration: \${result.duration}ms\`);
                } else {
                    console.error('Backup failed:', result.error);
                    process.exit(1);
                }
            } catch (error) {
                console.error('Backup failed:', error);
                process.exit(1);
            }
        }
        
        createBackup();
    " --backup-name="$backup_name"
    
    success "Backup created successfully: $backup_name"
}

restore_backup() {
    if [[ -z "$RESTORE_FILE" ]]; then
        error "Restore file must be specified with -f/--file"
        exit 1
    fi
    
    if [[ ! -f "$RESTORE_FILE" ]]; then
        error "Restore file not found: $RESTORE_FILE"
        exit 1
    fi
    
    info "Restoring database from: $RESTORE_FILE"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        warn "⚠️  PRODUCTION RESTORE DETECTED ⚠️"
        warn "This will overwrite the production database!"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            read -p "Are you absolutely sure? Type 'yes' to continue: " -r
            if [[ "$REPLY" != "yes" ]]; then
                error "Restore cancelled"
                exit 1
            fi
        fi
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would restore from $RESTORE_FILE"
        return 0
    fi
    
    # Restore using our backup system
    node -e "
        const { getBackupManager } = require('./src/lib/database/backup');
        
        async function restoreBackup() {
            const manager = getBackupManager();
            try {
                const result = await manager.restoreBackup({
                    backupFile: '$RESTORE_FILE',
                    dropExisting: true,
                    verbose: $VERBOSE
                });
                
                if (result.success) {
                    console.log(\`Restore completed in \${result.duration}ms\`);
                    console.log(\`Tables restored: \${result.tablesRestored}\`);
                } else {
                    console.error('Restore failed:', result.error);
                    process.exit(1);
                }
            } catch (error) {
                console.error('Restore failed:', error);
                process.exit(1);
            }
        }
        
        restoreBackup();
    "
    
    success "Restore completed successfully"
}

seed_database() {
    info "Seeding database with test data..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would seed database for $ENVIRONMENT"
        return 0
    fi
    
    # Seed using our seeding system
    node -e "
        const { getDatabaseSeeder } = require('./src/lib/database/seeders');
        
        async function seedDatabase() {
            const seeder = getDatabaseSeeder();
            try {
                const result = await seeder.seed({
                    environment: '$ENVIRONMENT',
                    reset: false,
                    verbose: $VERBOSE
                });
                
                if (result.success) {
                    console.log('Seeding completed:');
                    Object.entries(result.created).forEach(([type, count]) => {
                        if (count > 0) console.log(\`  \${type}: \${count}\`);
                    });
                    console.log(\`Duration: \${result.duration}ms\`);
                } else {
                    console.error('Seeding failed');
                    result.errors.forEach(err => console.error('  Error:', err));
                    process.exit(1);
                }
            } catch (error) {
                console.error('Seeding failed:', error);
                process.exit(1);
            }
        }
        
        seedDatabase();
    "
    
    success "Database seeding completed"
}

show_status() {
    info "Checking migration status..."
    
    node -e "
        const { getMigrationManager } = require('./src/lib/database/migrations');
        
        async function showStatus() {
            const manager = getMigrationManager();
            try {
                const status = await manager.getStatus();
                
                console.log('Migration Status:');
                console.log(\`  Current version: \${status.currentVersion}\`);
                console.log(\`  Applied migrations: \${status.applied.length}\`);
                console.log(\`  Pending migrations: \${status.pending.length}\`);
                console.log(\`  Total migrations: \${status.total}\`);
                
                if (status.pending.length > 0) {
                    console.log('\\nPending migrations:');
                    status.pending.forEach(m => {
                        console.log(\`  v\${m.version}: \${m.name}\`);
                    });
                }
                
                // Validate migrations
                const validation = await manager.validateMigrations();
                if (!validation.valid) {
                    console.log('\\n❌ Migration validation failed:');
                    validation.errors.forEach(err => console.log(\`  \${err}\`));
                    process.exit(1);
                } else {
                    console.log('\\n✅ All migrations are valid');
                }
            } catch (error) {
                console.error('Failed to get status:', error);
                process.exit(1);
            }
        }
        
        showStatus();
    "
}

validate_schema() {
    info "Validating database schema..."
    
    node -e "
        const { getDatabasePool } = require('./src/lib/database/pool');
        
        async function validateSchema() {
            const pool = getDatabasePool();
            try {
                await pool.initialize();
                
                // Check table sizes
                const tableSizes = await pool.getTableSizes();
                console.log('Table sizes:');
                tableSizes.forEach(table => {
                    console.log(\`  \${table.table_name}: \${table.size} (\${table.rows} rows)\`);
                });
                
                // Check index usage
                const indexUsage = await pool.getIndexUsage();
                const unusedIndexes = indexUsage.filter(idx => idx.scans === 0);
                if (unusedIndexes.length > 0) {
                    console.log('\\n⚠️  Unused indexes found:');
                    unusedIndexes.forEach(idx => {
                        console.log(\`  \${idx.table_name}.\${idx.index_name}\`);
                    });
                }
                
                // Health check
                const health = await pool.healthCheck();
                if (health.healthy) {
                    console.log(\`\\n✅ Database healthy (latency: \${health.latency}ms)\`);
                } else {
                    console.log(\`\\n❌ Database health check failed: \${health.error}\`);
                    process.exit(1);
                }
            } catch (error) {
                console.error('Schema validation failed:', error);
                process.exit(1);
            }
        }
        
        validateSchema();
    "
    
    success "Schema validation completed"
}

reset_database() {
    warn "⚠️  DATABASE RESET REQUESTED ⚠️"
    warn "This will completely wipe the database!"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        error "Database reset is not allowed in production environment"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == "false" ]]; then
        read -p "Are you sure you want to reset the database? Type 'RESET' to continue: " -r
        if [[ "$REPLY" != "RESET" ]]; then
            error "Reset cancelled"
            exit 1
        fi
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would reset database for $ENVIRONMENT"
        return 0
    fi
    
    # Reset and seed database
    node -e "
        const { getDatabaseSeeder } = require('./src/lib/database/seeders');
        
        async function resetDatabase() {
            const seeder = getDatabaseSeeder();
            try {
                const result = await seeder.seed({
                    environment: '$ENVIRONMENT',
                    reset: true,
                    verbose: true
                });
                
                if (result.success) {
                    console.log('Database reset and seeded successfully');
                } else {
                    console.error('Reset failed');
                    process.exit(1);
                }
            } catch (error) {
                console.error('Reset failed:', error);
                process.exit(1);
            }
        }
        
        resetDatabase();
    "
    
    success "Database reset completed"
}

main() {
    # Parse arguments
    if [[ $# -eq 0 ]]; then
        usage
        exit 1
    fi
    
    OPERATION="$1"
    shift
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -n|--name)
                BACKUP_NAME="$2"
                shift 2
                ;;
            -f|--file)
                RESTORE_FILE="$2"
                shift 2
                ;;
            -t|--target)
                TARGET_VERSION="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Validate inputs
    validate_environment
    load_database_config
    
    # Execute operation
    case "$OPERATION" in
        migrate)
            run_migrations
            ;;
        rollback)
            rollback_migrations
            ;;
        backup)
            create_backup
            ;;
        restore)
            restore_backup
            ;;
        seed)
            seed_database
            ;;
        status)
            show_status
            ;;
        validate)
            validate_schema
            ;;
        reset)
            reset_database
            ;;
        *)
            error "Unknown operation: $OPERATION"
            usage
            exit 1
            ;;
    esac
}

main "$@"