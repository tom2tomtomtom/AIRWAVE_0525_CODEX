# AIRWAVE Production Operations Guide

## 🚀 Production Infrastructure Overview

AIRWAVE now includes enterprise-grade production infrastructure with comprehensive monitoring, performance testing, backup systems, and automated deployment verification. This guide covers all the operational tools and procedures.

## 📋 Quick Start Checklist

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Setup Git hooks
npm run prepare

# Initialize monitoring infrastructure
npm run monitor:setup

# Verify environment configuration
npm run validate:env:production
```

### 2. Pre-Deployment Validation
```bash
# Run complete production readiness check
npm run production:checklist

# This includes:
# - Environment validation
# - Performance testing
# - Backup system health check
# - Smoke tests
```

### 3. Deploy to Production
```bash
# Build and test Docker image
npm run docker:build
npm run docker:test

# After deployment, verify with smoke tests
npm run smoke:test:prod
```

## 🔧 Production Tools Reference

### Monitoring & Alerting

#### Setup Error Tracking
```bash
# Initialize monitoring infrastructure
npm run monitor:setup

# Configure environment variables in .env.production:
SENTRY_DSN=your_sentry_dsn_here
NEXT_PUBLIC_SENTRY_DSN=your_public_sentry_dsn_here
ALERT_WEBHOOK_URL=your_slack_webhook_url
```

#### Uptime Monitoring
```bash
# Start continuous uptime monitoring
npm run monitor:uptime

# Manual health checks
npm run health:check              # Local
npm run health:check:prod        # Production
```

#### Performance Monitoring
```bash
# View current performance metrics
npm run monitor:performance

# Integration available for Express middleware
# See: src/lib/monitoring/performance.ts
```

### Performance Testing Suite

#### Full Performance Testing
```bash
# Run complete performance test suite
npm run perf:test

# Includes:
# - Lighthouse audits (Performance, Accessibility, SEO)
# - Load testing (Artillery - 50+ RPS target)
# - Bundle size analysis (<250KB threshold)
```

#### Individual Performance Tests
```bash
# Lighthouse audits only
npm run perf:lighthouse

# Load testing only (8-minute test)
npm run perf:load-test

# Bundle size analysis only
npm run perf:bundle
```

#### Custom Performance Testing Options
```bash
# Test specific pages
node scripts/performance-testing.js --pages="/,/login,/dashboard"

# Test against different URL
node scripts/performance-testing.js --url="https://your-domain.com"

# Skip specific test types
node scripts/performance-testing.js --skip-lighthouse --skip-bundle
```

### Backup & Recovery System

#### Automated Backups
```bash
# Setup automated backup scheduling (cron)
npm run backup:schedule

# Manual backups
npm run backup:full              # Complete system backup
npm run backup:database          # Database only
npm run backup:files            # Files only
npm run backup:config           # Configuration only
```

#### Backup Management
```bash
# List available backups
npm run backup:list

# Cleanup old backups
npm run backup:cleanup

# Check backup system health
npm run backup:health
```

#### Recovery Operations
```bash
# Restore database (requires CONFIRM_RESTORE=yes)
CONFIRM_RESTORE=yes bash scripts/backup-recovery.sh restore_database /path/to/backup.sql.gz

# Restore files (requires CONFIRM_RESTORE=yes)
CONFIRM_RESTORE=yes bash scripts/backup-recovery.sh restore_files /path/to/backup.tar.gz
```

### Post-Deployment Testing

#### Smoke Testing
```bash
# Test local deployment
npm run smoke:test

# Test production deployment
npm run smoke:test:prod

# Custom smoke testing
node scripts/smoke-tests.js --url="https://your-domain.com" --timeout=15000
```

#### Deployment Verification
```bash
# Complete deployment verification
npm run deploy:verify

# Includes smoke tests + health checks
```

## ⚙️ Environment Configuration

### Required Production Environment Variables

#### Core Application
```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret_min_32_chars

# AI Services
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

#### Monitoring & Alerting
```bash
# Error Tracking
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_public_sentry_dsn

# Alerts
ALERT_WEBHOOK_URL=your_slack_or_discord_webhook
BASE_URL=https://your-production-domain.com

# Performance
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_SAMPLE_RATE=0.1
```

#### Testing & Deployment
```bash
# Testing
TEST_USER_EMAIL=test@your-domain.com
TEST_USER_PASSWORD=secure_test_password
PRODUCTION_URL=https://your-production-domain.com

# Backup
BACKUP_DIR=/path/to/backup/directory
DATABASE_URL=your_database_connection_string
SUPABASE_PROJECT_ID=your_supabase_project_id
```

## 📊 Monitoring Dashboard

### Health Check Endpoints
- `GET /api/health` - Comprehensive health status
- `GET /api/status` - Basic status check

### Available Metrics
```javascript
// Application Health
{
  "status": "healthy|degraded|unhealthy",
  "services": {
    "database": { "status": "connected", "latency": 45 },
    "storage": { "status": "available" }
  },
  "uptime": 86400,
  "version": "0.1.0",
  "environment": "production"
}

// Performance Metrics (via monitoring utilities)
{
  "memory": { "rss": 150.2, "heapUsed": 89.7 },
  "responseTime": { "avg": 234, "p95": 456, "p99": 891 },
  "requestCount": 12543,
  "errorRate": 0.002
}
```

## 🔍 Troubleshooting Guide

### Common Issues & Solutions

#### 1. Health Check Failures
```bash
# Check application logs
docker logs your-container-name

# Verify database connection
npm run health:check

# Check environment variables
npm run validate:env:production
```

#### 2. Performance Issues
```bash
# Run performance diagnostics
npm run perf:test

# Check memory usage
npm run monitor:performance

# Analyze bundle size
npm run perf:bundle
```

#### 3. Backup Issues
```bash
# Check backup system health
npm run backup:health

# Verify backup integrity
bash scripts/backup-recovery.sh verify_backup /path/to/backup.tar.gz

# Check disk space
df -h /backup/directory
```

#### 4. Deployment Failures
```bash
# Run smoke tests to identify issues
npm run smoke:test:prod

# Check all systems
npm run production:checklist

# Verify Docker build
npm run docker:build
```

### Error Codes & Meanings

| Code | Meaning | Action |
|------|---------|--------|
| 503 | Service Unavailable | Check health endpoint, database connection |
| 500 | Server Error | Check application logs, Sentry dashboard |
| 429 | Rate Limited | Normal for auth endpoints under high load |
| 404 | Not Found | Check routing, static assets |

## 📈 Performance Benchmarks

### Target Metrics
- **Response Time:** <500ms (p95)
- **Lighthouse Score:** >90 (all categories)
- **Load Capacity:** >50 RPS
- **Bundle Size:** <250KB initial load
- **Error Rate:** <1%
- **Uptime:** >99.9%

### Load Testing Results
```bash
# Example load test output
Total Requests: 15,000
Success Rate: 99.8%
Avg Response Time: 234ms
P95 Response Time: 456ms
RPS: 52.3
```

## 🔄 Maintenance Procedures

### Daily Tasks (Automated)
- Health checks every minute
- Error log monitoring
- Performance metrics collection
- Database backup every 6 hours

### Weekly Tasks
```bash
# Cleanup old backups
npm run backup:cleanup

# Performance regression testing
npm run perf:test

# Security dependency check
npm audit
```

### Monthly Tasks
```bash
# Full system backup verification
npm run backup:full

# Load testing
npm run perf:load-test

# Review monitoring alerts and thresholds
```

## 🚨 Incident Response

### Alert Priorities

#### P0 - Critical (Immediate Response)
- Application completely down
- Database connection lost
- Critical security breach

#### P1 - High (Response within 1 hour)
- Performance degradation >500ms p95
- Error rate >5%
- Backup system failures

#### P2 - Medium (Response within 4 hours)
- Non-critical feature failures
- Monitoring system issues
- Performance warnings

### Response Procedures

1. **Acknowledge Alert** (via monitoring system)
2. **Assess Impact** (run smoke tests, check health)
3. **Identify Root Cause** (logs, metrics, recent changes)
4. **Implement Fix** (hotfix, rollback, or scaling)
5. **Verify Resolution** (smoke tests, monitoring)
6. **Document Incident** (post-mortem, lessons learned)

## 📚 Additional Resources

### Configuration Files
- `scripts/monitoring-setup.js` - Monitoring infrastructure setup
- `scripts/performance-testing.js` - Performance testing suite
- `scripts/backup-recovery.sh` - Backup and recovery system
- `scripts/smoke-tests.js` - Post-deployment testing
- `.env.monitoring.example` - Monitoring environment template

### Monitoring Integration Examples
```typescript
// Performance monitoring middleware (Express)
import { performanceMonitor } from '@/lib/monitoring/performance';
app.use(performanceMonitor.middleware());

// Error tracking
import { Sentry } from '@/lib/monitoring/sentry';
Sentry.captureException(error);

// Custom metrics
performanceMonitor.recordMetric('api_call_duration', duration, { endpoint: '/api/users' });
```

---

## 🎉 Congratulations!

Your AIRWAVE application now has enterprise-grade production infrastructure including:

✅ **Comprehensive Monitoring** - Error tracking, uptime monitoring, performance metrics  
✅ **Automated Testing** - Performance testing, load testing, smoke testing  
✅ **Backup & Recovery** - Automated backups, disaster recovery procedures  
✅ **Production Readiness** - Environment validation, security hardening  
✅ **Operational Tools** - Health checks, deployment verification  

**The application is now ready for production deployment! 🚀**

For questions or issues, refer to the troubleshooting guide above or check the monitoring dashboards for real-time system status.
