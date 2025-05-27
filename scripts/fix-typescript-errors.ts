// scripts/fix-typescript-errors.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface Fix {
  pattern: RegExp;
  replacement: string;
  description: string;
}

const fixes: Fix[] = [
  // Fix missing Next.js types
  {
    pattern: /export default function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
    replacement: 'export default function $1($2: { req: NextApiRequest; res: NextApiResponse }) {',
    description: 'Add NextApiRequest/Response types to API handlers'
  },
  
  // Fix error handling
  {
    pattern: /catch\s*\(\s*error\s*\)\s*{/g,
    replacement: 'catch (error) {\n    const message = getErrorMessage(error);',
    description: 'Fix error handling with proper typing'
  },
  
  // Fix useState without types
  {
    pattern: /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState\(null\)/g,
    replacement: 'const [$1, set$1] = useState<any>(null)',
    description: 'Add type to useState(null)'
  },
  
  // Fix async function returns
  {
    pattern: /async\s+function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
    replacement: 'async function $1($2): Promise<void> {',
    description: 'Add Promise<void> return type to async functions'
  },
  
  // Fix event handlers
  {
    pattern: /on(\w+)=\{(?:async\s+)?\((\w+)\)\s*=>/g,
    replacement: 'on$1={(e: React.$1Event<HTMLElement>) =>',
    description: 'Add event types to handlers'
  }
];

async function fixFile(filePath: string): Promise<number> {
  let content = await fs.readFile(filePath, 'utf-8');
  let fixCount = 0;
  
  // Skip if file already has proper imports
  const hasNextImports = content.includes('import { NextApiRequest, NextApiResponse }');
  const hasErrorUtils = content.includes('import { getErrorMessage }');
  
  // Add imports if needed
  if (!hasNextImports && filePath.includes('pages/api/')) {
    content = `import { NextApiRequest, NextApiResponse } from 'next';\n${content}`;
    fixCount++;
  }
  
  if (!hasErrorUtils && content.includes('catch')) {
    content = `import { getErrorMessage } from '@/utils/errorUtils';\n${content}`;
    fixCount++;
  }
  
  // Apply fixes
  for (const fix of fixes) {
    const matches = content.match(fix.pattern);
    if (matches) {
      content = content.replace(fix.pattern, fix.replacement);
      fixCount += matches.length;
      console.log(`  ✓ ${fix.description} (${matches.length} occurrences)`);
    }
  }
  
  if (fixCount > 0) {
    await fs.writeFile(filePath, content);
  }
  
  return fixCount;
}

async function main() {
  console.log('🔧 Starting automated TypeScript fixes...\n');
  
  // Find all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', '.next/**', 'scripts/fix-typescript-errors.ts']
  });
  
  let totalFixes = 0;
  let filesFixed = 0;
  
  for (const file of files) {
    const fixes = await fixFile(file);
    if (fixes > 0) {
      console.log(`📝 Fixed ${file} (${fixes} fixes)`);
      totalFixes += fixes;
      filesFixed++;
    }
  }
  
  console.log(`\n✅ Complete! Fixed ${totalFixes} issues in ${filesFixed} files`);
  console.log('\nNext steps:');
  console.log('1. Run "npm run type-check" to see remaining errors');
  console.log('2. Enable strict mode in tsconfig.json gradually');
  console.log('3. Fix remaining errors manually');
}

main().catch(console.error);