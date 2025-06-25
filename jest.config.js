module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/test/setup.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@supabase/realtime-js$': '<rootDir>/src/test/mocks/supabase-realtime.js',
    '^@supabase/ssr$': '<rootDir>/src/test/mocks/supabase-ssr.js'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|.*\\.mjs$))'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/test/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  coverageReporters: [
    'text',
    'html',
    'lcov',
    'json-summary'
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json']
};