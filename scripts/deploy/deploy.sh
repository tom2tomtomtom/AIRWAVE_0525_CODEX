#!/bin/bash

# AIrWAVE Deployment Script
# Supports multiple environments and deployment strategies

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=""
SKIP_TESTS=false
SKIP_BACKUP=false
DRY_RUN=false
VERBOSE=false
ROLLBACK=false
ROLLBACK_VERSION=""

# Functions
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

info() {
    log "INFO" "${BLUE}$*${NC}"
}

warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

error() {
    log "ERROR" "${RED}$*${NC}"
}

success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        log "DEBUG" "$*"
    fi
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy AIrWAVE application to specified environment.

OPTIONS:
    -e, --environment ENV    Target environment (staging|production)
    -t, --skip-tests        Skip test execution
    -b, --skip-backup       Skip database backup (not recommended for production)
    -d, --dry-run          Show what would be deployed without executing
    -v, --verbose          Enable verbose logging
    -r, --rollback         Rollback to previous version
    --rollback-version VER  Rollback to specific version
    -h, --help             Show this help message

EXAMPLES:
    $0 -e staging
    $0 -e production -v
    $0 -e production --skip-tests --dry-run
    $0 --rollback --environment production

EOF
}

check_dependencies() {
    info "Checking dependencies..."
    
    local deps=("node" "npm" "git" "curl" "jq")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "Required dependency '$dep' not found"
            exit 1
        fi
        debug "$dep: $(command -v "$dep")"
    done
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"
    
    if ! npx semver -r ">=$required_version" "$node_version" &> /dev/null; then
        error "Node.js version $node_version is below required version $required_version"
        exit 1
    fi
    
    success "All dependencies satisfied"
}

validate_environment() {
    if [[ -z "$ENVIRONMENT" ]]; then
        error "Environment must be specified with -e/--environment"
        usage
        exit 1
    fi
    
    if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
        error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
        exit 1
    fi
    
    info "Target environment: $ENVIRONMENT"
}

load_config() {
    local env_file="$PROJECT_ROOT/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]]; then
        info "Loading environment configuration from $env_file"
        # Don't source directly for security - just validate it exists
        debug "Environment file found: $env_file"
    else
        warn "Environment file not found: $env_file"
        warn "Make sure to configure environment variables in your deployment platform"
    fi
}

check_git_status() {
    info "Checking git status..."
    
    if ! git diff-index --quiet HEAD --; then
        warn "Working directory has uncommitted changes"
        if [[ "$DRY_RUN" == "false" ]]; then
            read -p "Continue with uncommitted changes? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                error "Deployment cancelled"
                exit 1
            fi
        fi
    fi
    
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    local target_branch
    
    case "$ENVIRONMENT" in
        staging)
            target_branch="develop"
            ;;
        production)
            target_branch="main"
            ;;
    esac
    
    if [[ "$current_branch" != "$target_branch" ]]; then
        warn "Current branch '$current_branch' doesn't match target branch '$target_branch' for $ENVIRONMENT"
        if [[ "$DRY_RUN" == "false" ]]; then
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                error "Deployment cancelled"
                exit 1
            fi
        fi
    fi
    
    local commit_hash=$(git rev-parse HEAD)
    local commit_message=$(git log -1 --pretty=format:"%s")
    
    info "Deploying commit: $commit_hash"
    info "Commit message: $commit_message"
}

run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        warn "Skipping tests (--skip-tests flag provided)"
        return 0
    fi
    
    info "Running test suite..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would run tests"
        return 0
    fi
    
    # Install dependencies
    info "Installing dependencies..."
    npm ci
    
    # Run linting
    info "Running linting..."
    npm run lint
    
    # Run type checking
    info "Running type checking..."
    npm run type-check
    
    # Run unit tests
    info "Running unit tests..."
    npm run test:unit
    
    # Environment-specific tests
    if [[ "$ENVIRONMENT" == "production" ]]; then
        info "Running integration tests for production..."
        npm run test:integration
    fi
    
    success "All tests passed"
}

backup_database() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        warn "Skipping database backup (--skip-backup flag provided)"
        return 0
    fi
    
    if [[ "$ENVIRONMENT" != "production" ]]; then
        info "Skipping backup for non-production environment"
        return 0
    fi
    
    info "Creating database backup..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would create database backup"
        return 0
    fi
    
    local backup_name="airwave-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Run backup script
    npm run db:backup:production -- --name "$backup_name"
    
    success "Database backup created: $backup_name"
}

build_application() {
    info "Building application..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would build application"
        return 0
    fi
    
    # Clean previous builds
    rm -rf .next/
    
    # Build for production
    NODE_ENV=production npm run build
    
    # Validate build
    if [[ ! -d ".next" ]]; then
        error "Build failed - .next directory not found"
        exit 1
    fi
    
    local build_size=$(du -sh .next/ | cut -f1)
    info "Build completed successfully (size: $build_size)"
}

run_migrations() {
    info "Checking for database migrations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would check and run migrations"
        return 0
    fi
    
    # Check if migrations are needed
    local pending_migrations=$(npm run db:status --silent | grep -c "pending" || true)
    
    if [[ "$pending_migrations" -gt 0 ]]; then
        info "Found $pending_migrations pending migrations"
        npm run db:migrate:$ENVIRONMENT
        success "Database migrations completed"
    else
        info "No pending migrations"
    fi
}

deploy_to_platform() {
    info "Deploying to $ENVIRONMENT environment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would deploy to $ENVIRONMENT"
        return 0
    fi
    
    case "$ENVIRONMENT" in
        staging)
            deploy_to_vercel_staging
            ;;
        production)
            deploy_to_vercel_production
            ;;
    esac
}

deploy_to_vercel_staging() {
    info "Deploying to Vercel staging..."
    npx vercel --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"
    local preview_url=$(npx vercel ls --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" | head -n 2 | tail -n 1 | awk '{print $2}')
    info "Staging deployment URL: https://$preview_url"
}

deploy_to_vercel_production() {
    info "Deploying to Vercel production..."
    npx vercel --prod --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"
    info "Production deployment completed"
}

verify_deployment() {
    info "Verifying deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would verify deployment"
        return 0
    fi
    
    local base_url
    case "$ENVIRONMENT" in
        staging)
            base_url="$STAGING_URL"
            ;;
        production)
            base_url="$PRODUCTION_URL"
            ;;
    esac
    
    if [[ -z "$base_url" ]]; then
        warn "Base URL not configured for $ENVIRONMENT environment"
        return 0
    fi
    
    # Wait for deployment to be ready
    info "Waiting for deployment to be ready..."
    sleep 30
    
    # Health check
    info "Running health checks..."
    local health_check_url="$base_url/api/health"
    
    for i in {1..5}; do
        if curl -f "$health_check_url" > /dev/null 2>&1; then
            success "Health check passed"
            break
        else
            warn "Health check failed (attempt $i/5)"
            if [[ $i -eq 5 ]]; then
                error "Health check failed after 5 attempts"
                exit 1
            fi
            sleep 10
        fi
    done
    
    # Basic functionality test
    info "Testing basic functionality..."
    if curl -f "$base_url" > /dev/null 2>&1; then
        success "Basic functionality test passed"
    else
        error "Basic functionality test failed"
        exit 1
    fi
}

rollback_deployment() {
    info "Rolling back deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would rollback deployment"
        return 0
    fi
    
    if [[ -n "$ROLLBACK_VERSION" ]]; then
        info "Rolling back to version: $ROLLBACK_VERSION"
        # Implementation depends on deployment platform
        npm run deploy:rollback -- --version "$ROLLBACK_VERSION" --environment "$ENVIRONMENT"
    else
        info "Rolling back to previous version"
        npm run deploy:rollback -- --environment "$ENVIRONMENT"
    fi
    
    success "Rollback completed"
}

cleanup() {
    info "Cleaning up..."
    
    # Clean up temporary files
    find "$PROJECT_ROOT" -name "*.tmp" -delete 2>/dev/null || true
    
    # Archive logs
    if [[ -f "$LOG_FILE" ]]; then
        local log_archive_dir="$PROJECT_ROOT/logs/archive"
        mkdir -p "$log_archive_dir"
        cp "$LOG_FILE" "$log_archive_dir/"
    fi
    
    debug "Cleanup completed"
}

send_notification() {
    local status=$1
    local message=$2
    
    if [[ -z "$WEBHOOK_URL" ]]; then
        debug "No webhook URL configured, skipping notification"
        return 0
    fi
    
    local commit_hash=$(git rev-parse HEAD)
    local commit_message=$(git log -1 --pretty=format:"%s")
    
    local payload=$(cat << EOF
{
    "text": "🚀 Deployment Notification",
    "attachments": [{
        "color": "$([[ "$status" == "success" ]] && echo "good" || echo "danger")",
        "fields": [
            {"title": "Status", "value": "$status", "short": true},
            {"title": "Environment", "value": "$ENVIRONMENT", "short": true},
            {"title": "Commit", "value": "$commit_hash", "short": true},
            {"title": "Message", "value": "$commit_message", "short": false},
            {"title": "Details", "value": "$message", "short": false}
        ]
    }]
}
EOF
    )
    
    curl -X POST "$WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "$payload" \
        > /dev/null 2>&1 || debug "Failed to send notification"
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -b|--skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -r|--rollback)
                ROLLBACK=true
                shift
                ;;
            --rollback-version)
                ROLLBACK_VERSION="$2"
                ROLLBACK=true
                shift 2
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
    
    # Create logs directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Start deployment
    info "Starting AIrWAVE deployment process..."
    info "Deployment mode: $([[ "$DRY_RUN" == "true" ]] && echo "DRY RUN" || echo "LIVE")"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Main deployment flow
    if [[ "$ROLLBACK" == "true" ]]; then
        validate_environment
        rollback_deployment
        verify_deployment
        send_notification "success" "Rollback completed successfully"
    else
        check_dependencies
        validate_environment
        load_config
        check_git_status
        run_tests
        backup_database
        build_application
        run_migrations
        deploy_to_platform
        verify_deployment
        send_notification "success" "Deployment completed successfully"
    fi
    
    success "Deployment process completed successfully!"
    info "Deployment log: $LOG_FILE"
}

# Run main function
main "$@"