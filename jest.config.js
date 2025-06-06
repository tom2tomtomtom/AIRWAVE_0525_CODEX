module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/src/components/__tests__',
    '<rootDir>/src/utils',
    '<rootDir>/tests/api',
  ],
  testMatch: [
    '**/__tests__/**/*.ts?(x)',
    '**/?(*.)+(spec|test).ts?(x)',
    '!**/tests/e2e/**',
    '!**/*.e2e.ts',
    '!**/*.e2e.spec.ts',
    '!**/tests/**/*.e2e.ts',
    '!**/tests/**/*.e2e.spec.ts',
    '!**/tests/e2e/**',
    '!**/tests/**/*.playwright.ts',
    '!**/tests/**/*.playwright.spec.ts',
    '!**/tests/ui-*.spec.ts',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/tests/e2e/**',
    '!**/*.e2e.ts',
    '!**/*.e2e.spec.ts',
    '!**/tests/**/*.e2e.ts',
    '!**/tests/**/*.e2e.spec.ts',
    '!**/tests/ui-*.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
