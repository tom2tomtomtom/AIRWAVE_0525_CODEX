// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../login';
import { supabase } from '@/lib/supabase';
const supabaseMock = supabase as any;

// Mock the modules
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-for-testing-purposes-only',
    JWT_EXPIRY: '24h',
    NODE_ENV: 'test',
  },
}));

// Create mock request and response
const createMockReq = (options: Partial<NextApiRequest> = {}): NextApiRequest => {
  return {
    method: 'POST',
    headers: {},
    body: {},
    query: {},
    ...options,
  } as NextApiRequest;
};

const createMockRes = (): NextApiResponse => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('/api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Method not allowed',
    });
  });

  it('should return 400 for invalid email', async () => {
    const req = createMockReq({
      body: {
        email: 'invalid-email',
        password: 'password123',
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: expect.stringContaining('Invalid email format'),
    });
  });

  it('should return 400 for missing password', async () => {
    const req = createMockReq({
      body: {
        email: 'test@example.com',
        password: '',
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: expect.stringContaining('Password is required'),
    });
  });

  it('should return 401 for invalid credentials', async () => {
    // Mock failed authentication
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    const req = createMockReq({
      body: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid email or password',
    });
  });

  it('should successfully login with valid credentials', async () => {
    // Mock successful authentication
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
    };

    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'user',
    };

    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });

    supabaseMock.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          single: vi.fn().mockResolvedValueOnce({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    });

    const req = createMockReq({
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      token: expect.any(String),
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('auth_token=')
    );
  });
});
