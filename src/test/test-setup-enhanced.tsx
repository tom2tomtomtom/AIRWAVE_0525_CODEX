/**
 * Enhanced Test Setup for AIRWAVE Platform
 * Addresses critical test coverage gaps and provides comprehensive testing utilities
 */

import React from 'react';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Mock Next.js components and hooks
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi
      .fn()
      .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      download: vi.fn().mockResolvedValue({ data: null, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'mock-url' } }),
    })),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.MFA_ENCRYPTION_KEY = 'dGVzdC1lbmNyeXB0aW9uLWtleS1mb3ItdGVzdGluZw=='; // base64 encoded test key

// Mock localStorage and sessionStorage
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', { value: mockStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockStorage });

// Mock crypto for Node.js environment
if (typeof crypto === 'undefined') {
  const mockCrypto = {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
  };

  global.crypto = mockCrypto as any;
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(_callback => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// Mock File and FileReader
global.File = class MockFile {
  constructor(
    public parts: (string | Blob)[],
    public name: string,
    public options?: FilePropertyBag
  ) {}

  size = 1024;
  type = 'text/plain';
  lastModified = Date.now();
  webkitRelativePath = '';

  text() {
    return Promise.resolve('mock file content');
  }
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(8));
  }
  stream() {
    return new ReadableStream();
  }
  slice() {
    return new Blob();
  }
} as any;

global.FileReader = class MockFileReader {
  readAsText = vi.fn().mockImplementation(() => {
    setTimeout(() => {
      this.onload?.({ target: { result: 'mock file content' } } as any);
    }, 0);
  });

  readAsDataURL = vi.fn().mockImplementation(() => {
    setTimeout(() => {
      this.onload?.({ target: { result: 'data:text/plain;base64,bW9jayBmaWxl' } } as any);
    }, 0);
  });

  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  result: string | ArrayBuffer | null = null;
} as any;

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true }),
  text: () => Promise.resolve('mock response'),
  blob: () => Promise.resolve(new Blob()),
  headers: new Headers(),
} as Response);

// Test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'editor',
  permissions: ['read', 'write'],
  isActive: true,
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  userId: 'user-123',
  email: 'test@example.com',
  role: 'editor',
  permissions: ['read', 'write'],
  sessionId: 'session-123',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600000,
  lastActivity: Date.now(),
  ...overrides,
});

export const createMockAsset = (overrides = {}) => ({
  id: 'asset-123',
  name: 'Test Asset',
  type: 'image',
  url: 'https://example.com/asset.jpg',
  size: 1024,
  userId: 'user-123',
  createdAt: new Date().toISOString(),
  metadata: {
    dimensions: '1920x1080',
    format: 'jpg',
    fileSize: '1024',
  },
  ...overrides,
});

export const createMockCampaign = (overrides = {}) => ({
  id: 'campaign-123',
  name: 'Test Campaign',
  description: 'Test campaign description',
  status: 'draft',
  clientId: 'client-123',
  userId: 'user-123',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockBrief = (overrides = {}) => ({
  id: 'brief-123',
  title: 'Test Brief',
  content: 'Test brief content',
  status: 'pending',
  campaignId: 'campaign-123',
  userId: 'user-123',
  createdAt: new Date().toISOString(),
  ...overrides,
});

// Mock API responses
export const mockApiResponse = (data: any, success = true) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : { code: 'TEST_ERROR', message: 'Test error' },
  meta: {
    timestamp: new Date().toISOString(),
    requestId: 'test-request-id',
  },
});

// Mock error scenarios
export const createMockError = (message = 'Test error', code = 'TEST_ERROR') => ({
  code,
  message,
  details: { testError: true },
});

// Database mock helpers
export const mockDatabase = {
  users: new Map(),
  sessions: new Map(),
  assets: new Map(),
  campaigns: new Map(),
  briefs: new Map(),

  clear() {
    this.users.clear();
    this.sessions.clear();
    this.assets.clear();
    this.campaigns.clear();
    this.briefs.clear();
  },

  seed() {
    this.users.set('user-123', createMockUser());
    this.sessions.set('session-123', createMockSession());
    this.assets.set('asset-123', createMockAsset());
    this.campaigns.set('campaign-123', createMockCampaign());
    this.briefs.set('brief-123', createMockBrief());
  },
};

// Test setup and teardown
beforeAll(() => {
  // Suppress console errors in tests unless explicitly testing error scenarios
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (args[0]?.includes?.('Warning:') || args[0]?.includes?.('Error:')) {
      return; // Suppress React warnings in tests
    }
    originalError.call(console, ...args);
  };
});

beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Reset mock storage
  mockStorage.getItem.mockReturnValue(null);
  mockStorage.setItem.mockImplementation(() => {});
  mockStorage.removeItem.mockImplementation(() => {});
  mockStorage.clear.mockImplementation(() => {});

  // Reset database
  mockDatabase.clear();
  mockDatabase.seed();

  // Reset fetch mock
  (global.fetch as any).mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Export mock instances for use in tests
export { mockSupabaseClient, mockStorage };

// Performance testing utilities
export const measurePerformance = async (fn: () => Promise<any> | any, label = 'test') => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;

  console.log(`Performance [${label}]: ${duration.toFixed(2)}ms`);

  return { result, duration };
};

// Memory leak detection
export const detectMemoryLeaks = (fn: () => void, iterations = 100) => {
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const memoryIncrease = finalMemory - initialMemory;

  return {
    initialMemory,
    finalMemory,
    memoryIncrease,
    leakDetected: memoryIncrease > 1024 * 1024, // 1MB threshold
  };
};

export default {
  createMockUser,
  createMockSession,
  createMockAsset,
  createMockCampaign,
  createMockBrief,
  mockApiResponse,
  createMockError,
  mockDatabase,
  measurePerformance,
  detectMemoryLeaks,
};
