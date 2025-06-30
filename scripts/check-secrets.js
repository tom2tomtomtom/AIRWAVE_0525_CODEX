#!/usr/bin/env node

/**
 * Pre-commit hook to scan for potential secrets in code
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns that might indicate secrets
const SECRET_PATTERNS = [
  // API Keys
  /(?:api[_-]?key|apikey|access[_-]?key)[\s]*[:=][\s]*['"]([a-zA-Z0-9_\-]{20,})['"](?![a-zA-Z0-9_\-])/gi,

  // AWS
  /(?:AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
  /aws[_-]?secret[_-]?access[_-]?key[\s]*[:=][\s]*['"]([a-zA-Z0-9/+=]{40})['"](?![a-zA-Z0-9/+=])/gi,

  // Generic secrets
  /(?:secret|password|passwd|pwd)[\s]*[:=][\s]*['"]([^'"]{8,})['"](?![a-zA-Z0-9_\-])/gi,

  // Bearer tokens (only match actual tokens, not the word "Bearer Token")
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,

  // Private keys
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,

  // Database URLs with credentials
  /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^/]+/gi,

  // JWT tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,

  // Hardcoded IPs (excluding common safe ones)
  /(?:^|\s)(?!(?:127\.0\.0\.1|0\.0\.0\.0|localhost))(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\s|$)/g,

  // Email/password combinations
  /(?:email|username)[\s]*[:=][\s]*['"][^'"]+@[^'"]+['"][\s]*,?\s*(?:password|pwd)[\s]*[:=][\s]*['"][^'"]+['"]/gi,
];

// Files/directories to skip
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /dist/,
  /build/,
  /coverage/,
  /\.env\.example/,
  /\.env\..*\.example/,
  /test-results/,
  /playwright-report/,
  /\.md$/,
  /\.json$/,
  /package-lock\.json/,
  /yarn\.lock/,
  /check-secrets\.js$/, // Don't scan self
];

// Known safe patterns (to reduce false positives)
const SAFE_PATTERNS = [
  'mock-',
  'test-',
  'example-',
  'your-',
  'placeholder',
  'xxxx',
  '****',
  '<YOUR_',
  'process.env.',
  'env.',
  'import.meta.env.',
  'console.log',
  'console.error',
  'Bearer Token', // UI text
  '// Bearer tokens', // Comment
  'Password:', // UI label
  'password:', // Console output context
  'TestPass123!', // Test password in validation tests
  'TestPass123', // Test password in test files
  'Password123!', // Test password in validation tests
  'test@example.com', // Test email in test files
  'TEST_JWT_TOKEN_PLACEHOLDER', // Test JWT tokens
  'DEFAULT_JWT_TOKEN_PLACEHOLDER', // Test JWT tokens
  '.test-signature', // Test JWT signatures
  '.default-signature', // Test JWT signatures
  'eyJpc3MiOiJ0ZXN0Ii', // Test JWT payload
  'too-short', // Test JWT secret for validation
  'short-secret', // Test JWT secret for validation
  "JWT_SECRET: 'too-short'", // Test validation context
  "JWT_SECRET: 'short-secret'", // Test validation context
  'JBSWY3DPEHPK3PXP', // Test MFA secret in MFA tests
  'NEWSECRET123', // Test MFA secret in MFA tests
  'TESTSECRET', // Test MFA secret in MFA tests
  'SUPERSECRET123', // Test MFA secret in MFA tests
  'should-not-be-exposed', // Test internal secret in session tests
  'classified', // Test server config secret in session tests
  'testpassword123', // Test password in verification script
];

function shouldIgnoreFile(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

function isSafeMatch(match, filePath = '') {
  const lowerMatch = match.toLowerCase();
  const isTestFile =
    filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('/tests/');

  // Allow test credentials in test files
  if (isTestFile && (lowerMatch.includes('testpass') || lowerMatch.includes('test@example'))) {
    return true;
  }

  return SAFE_PATTERNS.some(safe => lowerMatch.includes(safe));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  SECRET_PATTERNS.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern);

    while ((match = regex.exec(content)) !== null) {
      const matchText = match[0];

      // Skip if it's a known safe pattern
      if (isSafeMatch(matchText, filePath)) {
        continue;
      }

      // Find line number
      const lines = content.substring(0, match.index).split('\n');
      const lineNumber = lines.length;
      const line = content.split('\n')[lineNumber - 1];

      issues.push({
        file: filePath,
        line: lineNumber,
        match: matchText.substring(0, 50) + (matchText.length > 50 ? '...' : ''),
        context: line.trim().substring(0, 100) + (line.length > 100 ? '...' : ''),
      });
    }
  });

  return issues;
}

function scanDirectory(dir) {
  const issues = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (shouldIgnoreFile(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        // Only scan text files
        const ext = path.extname(entry.name);
        if (['.js', '.jsx', '.ts', '.tsx', '.env', '.sh', '.yml', '.yaml'].includes(ext)) {
          const fileIssues = scanFile(fullPath);
          issues.push(...fileIssues);
        }
      }
    }
  }

  walk(dir);
  return issues;
}

function getGitStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.split('\n').filter(file => file.length > 0);
  } catch (error) {
    return [];
  }
}

// Main execution
console.log('🔍 Scanning for potential secrets...\n');

const stagedFiles = getGitStagedFiles();
let issues = [];

if (stagedFiles.length > 0) {
  // Scan only staged files
  console.log(`Scanning ${stagedFiles.length} staged files...\n`);

  for (const file of stagedFiles) {
    if (fs.existsSync(file) && !shouldIgnoreFile(file)) {
      const ext = path.extname(file);
      if (['.js', '.jsx', '.ts', '.tsx', '.env', '.sh', '.yml', '.yaml'].includes(ext)) {
        const fileIssues = scanFile(file);
        issues.push(...fileIssues);
      }
    }
  }
} else {
  // Full scan if no staged files
  console.log('No staged files found. Running full scan...\n');
  issues = scanDirectory(process.cwd());
}

if (issues.length > 0) {
  console.error('❌ Found potential secrets in the following locations:\n');

  issues.forEach(issue => {
    console.error(`📄 ${issue.file}:${issue.line}`);
    console.error(`   Found: ${issue.match}`);
    console.error(`   Context: ${issue.context}\n`);
  });

  console.error(`\n⚠️  Found ${issues.length} potential secret(s)`);
  console.error('\nPlease review and remove any real secrets before committing.');
  console.error(
    'If these are false positives, you can add them to SAFE_PATTERNS in scripts/check-secrets.js\n'
  );

  process.exit(1);
} else {
  console.log('✅ No secrets detected\n');
  process.exit(0);
}
