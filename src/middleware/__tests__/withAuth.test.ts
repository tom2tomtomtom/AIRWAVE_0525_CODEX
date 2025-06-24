/**
 * @jest-environment jsdom
 */

import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import {
  withAuth,
  withRoles,
  withPermissions,
  withClientAccess,
  AuthenticatedRequest,
  AuthenticatedHandler} from '../withAuth';
import { UserRole } from '@/types/auth';

// Mock Supabase
const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser
    },
    from: mockFrom
  }))
}));

// Mock error utils
jest.mock('@/utils/errorUtils', () => ({
  getErrorMessage: (error: Error) => error.message || 'Unknown error'}));

// Mock API utils
jest.mock('@/utils/api', () => ({
  errorResponse: jest.fn((res, code, message, status) => {
    res.status(status).json({ success: false, error: { code, message } });
  }),
  ErrorCode: {},
  UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR' }));

// Setup mocks
beforeEach(() => {
  jest.clearAllMocks();
  
  // Chain setup for Supabase queries
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ single: mockSingle });
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
  mockInsert.mockReturnValue({ select: mockSelect });
});

describe('withAuth middleware', () => {
  describe('authentication validation', () => {
    it('should authenticate user with valid cookies', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'valid-token' });

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read'],
        tenant_id: 'tenant-123'};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withAuth(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        permissions: ['read'],
        clientIds: [],
        tenantId: 'tenant-123'});
    });

    it('should authenticate user with Bearer token', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' });

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'admin',
        permissions: ['*'],
        tenant_id: 'tenant-123'};

      // First call (cookies) fails, second call (bearer) succeeds
      mockGetUser
        .mockResolvedValueOnce({ data: { user: null }, error: new Error('No cookie') })
        .mockResolvedValueOnce({ data: { user: mockUser }, error: null });

      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withAuth(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user?.role).toBe('admin');
    });

    it('should authenticate user with custom auth header', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: { 'x-auth-token': 'custom-token' });

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read'],
        tenant_id: 'tenant-123'};

      // First two calls fail, third call (custom header) succeeds
      mockGetUser
        .mockResolvedValueOnce({ data: { user: null }, error: new Error('No cookie') })
        .mockResolvedValueOnce({ data: { user: null }, error: new Error('No bearer') })
        .mockResolvedValueOnce({ data: { user: mockUser }, error: null });

      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withAuth(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET'});

      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthenticated') });

      const handler: AuthenticatedHandler = jest.fn();
      const wrappedHandler = withAuth(handler);
      await wrappedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(401);
    });

    it('should create profile if it does not exist', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'valid-token' });

      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        user_metadata: { name: 'New User' };

      const mockNewProfile = {
        id: 'user-123',
        first_name: 'New',
        last_name: 'User',
        role: 'user',
        email: 'newuser@example.com'};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      // Profile not found (PGRST116 error)
      mockSingle
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({ data: mockNewProfile, error: null });

      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withAuth(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledWith({
        id: 'user-123',
        first_name: 'New',
        last_name: 'User',
        role: 'user',
        email: 'newuser@example.com',
        created_at: expect.any(String),
        updated_at: expect.any(String)});
    });

    it('should handle profile creation errors gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'valid-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        user_metadata: { name: 'Test User' };

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      // Profile not found and creation fails
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      mockInsert.mockReturnValue({
        select: () => ({
    single: () => Promise.resolve({ data: null, error: new Error('Creation failed') })
        })
      });

      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withAuth(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user?.email).toBe('user@example.com');
      expect((req as AuthenticatedRequest).user?.role).toBe(UserRole.VIEWER);
    });

    it('should handle database connection errors', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'valid-token' });

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockRejectedValue(new Error('Database connection failed'));

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withAuth(handler);
      await wrappedHandler(req, res);

      // Should still work with fallback profile
      expect(handler).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user?.id).toBe('user-123');
    });
  });

  describe('withRoles middleware', () => {
    it('should allow access for users with required role', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'admin-token' });

      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com'};

      const mockProfile = {
        id: 'admin-123',
        role: 'admin',
        permissions: ['*']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withRoles(UserRole.ADMIN)(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });

    it('should deny access for users without required role', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn();
      const wrappedHandler = withRoles(UserRole.ADMIN)(handler);
      await wrappedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(403);
    });

    it('should work with multiple allowed roles', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'editor-token' });

      const mockUser = {
        id: 'editor-123',
        email: 'editor@example.com'};

      const mockProfile = {
        id: 'editor-123',
        role: 'editor',
        permissions: ['read', 'write']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withRoles([UserRole.ADMIN, UserRole.EDITOR])(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('withPermissions middleware', () => {
    it('should allow access for users with required permissions', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read', 'write']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withPermissions(['read', 'write'])(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });

    it('should allow access for users with wildcard permissions', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'admin-token' });

      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com'};

      const mockProfile = {
        id: 'admin-123',
        role: 'admin',
        permissions: ['*']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withPermissions(['delete', 'admin'])(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });

    it('should deny access for users without required permissions', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn();
      const wrappedHandler = withPermissions(['delete', 'admin'])(handler);
      await wrappedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(403);
    });
  });

  describe('withClientAccess middleware', () => {
    it('should allow admin access to any client', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { clientId: 'client-456'  },
  cookies: { 'sb-access-token': 'admin-token' });

      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com'};

      const mockProfile = {
        id: 'admin-123',
        role: 'admin',
        permissions: ['*']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withClientAccess()(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });

    it('should allow user access to their assigned clients', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { clientId: 'client-456'  },
  cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']};

      const mockUserClients = [
        { client_id: 'client-456'  }
        { client_id: 'client-789'  }
      ];

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: mockUserClients, error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withClientAccess()(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });

    it('should deny user access to unassigned clients', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: { clientId: 'client-999'  },
  cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']};

      const mockUserClients = [
        { client_id: 'client-456'  }
        { client_id: 'client-789'  }
      ];

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: mockUserClients, error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn();
      const wrappedHandler = withClientAccess()(handler);
      await wrappedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(403);
    });

    it('should handle missing client ID', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']};

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: [], error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn();
      const wrappedHandler = withClientAccess()(handler);
      await wrappedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(400);
    });

    it('should check client ID from request body', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: { clientId: 'client-456'  },
  cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']};

      const mockUserClients = [
        { client_id: 'client-456'  }
      ];

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: mockUserClients, error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withClientAccess()(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });

    it('should check client ID from custom header', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {},
        'x-client-id': 'client-456' 
      },
        cookies: { 'sb-access-token': 'user-token' });

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'};

      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']};

      const mockUserClients = [
        { client_id: 'client-456'  }
      ];

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ 
        single: () => Promise.resolve({ data: mockUserClients, error: null }) 
      });

      const handler: AuthenticatedHandler = jest.fn(async (req, res) => {
        res.status(200).json({ success: true });
      });

      const wrappedHandler = withClientAccess()(handler);
      await wrappedHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });
  });
});