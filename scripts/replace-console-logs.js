#!/usr/bin/env node

/**
 * Console.log Replacement Script for AIRFLOW
 * 
 * Systematically replaces console.log with structured logging:
 * - Analyzes context to determine appropriate logger and level
 * - Preserves original intent while improving logging standards
 * - Adds proper logger imports where needed
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Mapping of context keywords to logger types and levels
const CONTEXT_MAPPING = {
  // Error contexts
  'error': { logger: 'general', level: 'error' },
  'fail': { logger: 'general', level: 'error' },
  'exception': { logger: 'general', level: 'error' },
  'catch': { logger: 'general', level: 'error' },
  
  // Warning contexts  
  'warn': { logger: 'general', level: 'warn' },
  'warning': { logger: 'general', level: 'warn' },
  'deprecated': { logger: 'general', level: 'warn' },
  
  // Auth contexts
  'auth': { logger: 'auth', level: 'info' },
  'login': { logger: 'auth', level: 'info' },
  'signup': { logger: 'auth', level: 'info' },
  'token': { logger: 'auth', level: 'debug' },
  'session': { logger: 'auth', level: 'debug' },
  
  // API contexts
  'api': { logger: 'api', level: 'info' },
  'request': { logger: 'api', level: 'debug' },
  'response': { logger: 'api', level: 'debug' },
  'endpoint': { logger: 'api', level: 'info' },
  
  // Database contexts
  'database': { logger: 'db', level: 'debug' },
  'supabase': { logger: 'supabase', level: 'debug' },
  'query': { logger: 'db', level: 'debug' },
  'insert': { logger: 'db', level: 'debug' },
  'update': { logger: 'db', level: 'debug' },
  'delete': { logger: 'db', level: 'debug' },
  
  // AI contexts
  'ai': { logger: 'ai', level: 'info' },
  'openai': { logger: 'ai', level: 'info' },
  'generation': { logger: 'ai', level: 'info' },
  'prompt': { logger: 'ai', level: 'debug' },
  
  // Storage contexts
  'storage': { logger: 'storage', level: 'info' },
  'upload': { logger: 'storage', level: 'info' },
  'download': { logger: 'storage', level: 'info' },
  'file': { logger: 'storage', level: 'debug' },
  
  // Security contexts
  'security': { logger: 'general', level: 'warn' },
  'csrf': { logger: 'general', level: 'warn' },
  'rate': { logger: 'general', level: 'warn' },
  'headers': { logger: 'general', level: 'debug' },
  
  // Default
  'default': { logger: 'general', level: 'info' }
};

function analyzeContext(logStatement, fileContent) {
  const statement = logStatement.toLowerCase();
  const context = fileContent.toLowerCase();
  
  // Check for specific keywords in the log statement
  for (const [keyword, mapping] of Object.entries(CONTEXT_MAPPING)) {
    if (statement.includes(keyword) || context.includes(keyword)) {
      return mapping;
    }
  }
  
  // File path analysis
  if (context.includes('/api/')) return { logger: 'api', level: 'debug' };
  if (context.includes('/auth/')) return { logger: 'auth', level: 'info' };
  if (context.includes('supabase')) return { logger: 'supabase', level: 'debug' };
  
  return CONTEXT_MAPPING.default;
}

function hasLoggerImport(content) {
  return content.includes('import') && (
    content.includes('createLogger') ||
    content.includes('getLogger') ||
    content.includes('loggers')
  );
}

function addLoggerImport(content, loggerName) {
  const importStatement = `import { loggers } from '@/lib/logger';\n`;
  
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex === -1) {
    // No imports found, add at the top
    return importStatement + '\n' + content;
  } else {
    // Add after the last import
    lines.splice(lastImportIndex + 1, 0, importStatement);
    return lines.join('\n');
  }
}

function replaceConsoleLog(content, filePath) {
  let modified = content;
  let changes = 0;
  let addedImport = false;
  
  // Pattern to match console.log statements
  const consoleLogRegex = /console\.log\s*\([^)]+\)/g;
  
  modified = modified.replace(consoleLogRegex, (match) => {
    const context = analyzeContext(match, content);
    
    // Add logger import if not present
    if (!addedImport && !hasLoggerImport(content)) {
      addedImport = true;
    }
    
    changes++;
    
    // Extract the content inside console.log()
    const argsMatch = match.match(/console\.log\s*\((.+)\)/);
    if (!argsMatch) return match;
    
    const args = argsMatch[1];
    
    // Convert to structured logging
    return `loggers.${context.logger}.${context.level}(${args})`;
  });
  
  // Add import if needed
  if (addedImport) {
    modified = addLoggerImport(modified, 'general');
  }
  
  return { content: modified, changes };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if no console.log statements
    if (!content.includes('console.log')) {
      return { processed: false, changes: 0 };
    }
    
    const result = replaceConsoleLog(content, filePath);
    
    if (result.changes > 0) {
      fs.writeFileSync(filePath, result.content, 'utf8');
      console.log(`✅ ${filePath}: ${result.changes} console.log statements replaced`);
      return { processed: true, changes: result.changes };
    }
    
    return { processed: false, changes: 0 };
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { processed: false, changes: 0 };
  }
}

function main() {
  console.log('🔍 Replacing console.log statements with structured logging...\n');
  
  const pattern = 'src/**/*.{ts,tsx}';
  const files = glob.sync(pattern);
  
  let totalFiles = 0;
  let processedFiles = 0;
  let totalChanges = 0;
  
  files.forEach(file => {
    totalFiles++;
    const result = processFile(file);
    if (result.processed) {
      processedFiles++;
      totalChanges += result.changes;
    }
  });
  
  console.log('\n📊 Replacement Summary:');
  console.log(`- Total files scanned: ${totalFiles}`);
  console.log(`- Files modified: ${processedFiles}`);
  console.log(`- Console.log statements replaced: ${totalChanges}`);
  console.log(`- Improvement: ${processedFiles > 0 ? '✨ Code quality enhanced!' : '💡 Already optimized!'}`);
  
  if (processedFiles > 0) {
    console.log('\n🎯 Next Steps:');
    console.log('1. Review the changes to ensure context accuracy');
    console.log('2. Run tests to verify functionality');
    console.log('3. Commit the structured logging improvements');
  }
}

if (require.main === module) {
  main();
}

module.exports = { replaceConsoleLog, analyzeContext };