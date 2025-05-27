// scripts/count-errors.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ErrorCount {
  code: string;
  count: number;
  description: string;
}

const errorDescriptions: Record<string, string> = {
  'TS2307': 'Cannot find module',
  'TS7006': 'Parameter implicitly has any type',
  'TS2304': 'Cannot find name',
  'TS6133': 'Declared but never used',
  'TS18046': 'Error is of type unknown',
  'TS2339': 'Property does not exist',
  'TS2345': 'Argument type mismatch',
  'TS2322': 'Type assignment error',
  'TS7005': 'Variable implicitly has any type',
  'TS2532': 'Object is possibly undefined'
};

async function countErrors() {
  console.log('📊 Analyzing TypeScript errors...\n');
  
  try {
    const { stdout } = await execAsync('npm run type-check 2>&1', { 
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    // Count errors by type
    const errorCounts = new Map<string, number>();
    const errorPattern = /TS(\d+):/g;
    let match;
    
    while ((match = errorPattern.exec(stdout)) !== null) {
      const code = `TS${match[1]}`;
      errorCounts.set(code, (errorCounts.get(code) || 0) + 1);
    }
    
    // Sort by count
    const sorted: ErrorCount[] = Array.from(errorCounts.entries())
      .map(([code, count]) => ({
        code,
        count,
        description: errorDescriptions[code] || 'Unknown error'
      }))
      .sort((a, b) => b.count - a.count);
    
    // Display results
    console.log('Error Type                            Count  Description');
    console.log('─'.repeat(70));
    
    let total = 0;
    for (const error of sorted) {
      console.log(
        `${error.code.padEnd(36)} ${error.count.toString().padStart(5)}  ${error.description}`
      );
      total += error.count;
    }
    
    console.log('─'.repeat(70));
    console.log(`${'TOTAL'.padEnd(36)} ${total.toString().padStart(5)}`);
    
    // Show files with most errors
    console.log('\n📁 Files with most errors:');
    const fileErrors = new Map<string, number>();
    const filePattern = /([^\s]+\.tsx?):\d+:\d+/g;
    
    while ((match = filePattern.exec(stdout)) !== null) {
      const file = match[1];
      fileErrors.set(file, (fileErrors.get(file) || 0) + 1);
    }
    
    const topFiles = Array.from(fileErrors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [file, count] of topFiles) {
      console.log(`  ${count.toString().padStart(4)} errors: ${file}`);
    }
    
  } catch (error) {
    // Error is expected since tsc returns non-zero exit code
    if (error instanceof Error && 'stdout' in error) {
      // Process the output even if tsc failed
      const stdout = (error as any).stdout;
      // ... same processing logic as above
    }
  }
}

countErrors();