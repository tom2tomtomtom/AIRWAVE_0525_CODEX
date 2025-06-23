import { getErrorMessage } from '@/utils/errorUtils';
import { NextApiRequest, NextApiResponse } from 'next';
import { errorResponse, ErrorCode } from '@/utils/api';
import { UserRole } from '@/types/auth';
import { createServerClient } from '@supabase/ssr';

// Extended request with user information
export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;,
    email: string;,
    role: UserRole;,
    permissions: string[];,
    clientIds: string[];,
    tenantId: string;
  };
}

// Handler type with authenticated request
export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => Promise<void> | void;

// Enhanced token validation with multiple fallback methods
async function validateUserToken(req: NextApiRequest): Promise<any> {
  let supabase;
  const user: unknown = null;
  const error: unknown = null;

  // Method 1: Try Supabase SSR with cookies (primary method)
  try {
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {},
  get(name: string) {
            return req.cookies[name];
          },
          set(name: string, value: string, options: unknown) {
            // We don't need to set cookies in API routes
          ,
 }
          remove(name: string, options: unknown) {
            // We don't need to remove cookies in API routes }
    );

    const {
      data: { user: cookieUser  },
  error: cookieError} = await supabase.auth.getUser();

    if (cookieUser && !cookieError) {
      return { user: cookieUser, supabase };
    }
  } catch ($1) {
    // Handle error silently
  }

  // Method 2: Try Authorization header (Bearer token)
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {},
  get: () => undefined,
            set: () => { },
  remove: () => { }
      );

      const {
        data: { user: headerUser  },
  error: headerError} = await supabase.auth.getUser(token);

      if (headerUser && !headerError) {
        return { user: headerUser, supabase };
      }
    }
  } catch ($1) {
    // Handle error silently
  }

  // Method 3: Try custom auth headers (fallback for API clients)
  try {
    const customToken = req.headers['x-auth-token'] as string;
    if (customToken) {
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {},
  get: () => undefined,
            set: () => { },
  remove: () => { }
      );

      const {
        data: { user: customUser  },
  error: customError} = await supabase.auth.getUser(customToken);

      if (customUser && !customError) {
        return { user: customUser, supabase };
      }
    }
  } catch ($1) {
    // Handle error silently
  }

  // All methods failed
  return { user: null, supabase: null };
}

// Enhanced user profile handling with better error recovery
async function getUserProfile(supabase: unknown, user: unknown): Promise<any> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create a basic one
      if (profileError.code === 'PGRST116') {
        const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
        const nameParts = userName.split(' ');

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            first_name: nameParts[0] || userName,
            last_name: nameParts.slice(1).join(' ') || '',
            role: 'user',
            email: user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()})
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          return createFallbackProfile(user);
        }

        return newProfile;
      }

      // For other errors, return fallback profile
      return createFallbackProfile(user);
    }

    return profile;
  } catch (err: unknown) {
    console.error('Profile handling exception:', err);
    return createFallbackProfile(user);
  }
}

// Create fallback profile when database operations fail
function createFallbackProfile(user: unknown): unknown {
  return {
    id: user.id,
    email: user.email || '',
    first_name: user.user_metadata?.name?.split(' ')[0] || user.email?.split('@')[0] || 'User',
    last_name: user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
    role: 'user',
    permissions: [],
    tenant_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()};
}

// Enhanced client access fetching with error handling
async function getUserClients(supabase: unknown, userId: string): Promise<string[]> {
  try {
    const { data: userClients, error: clientsError } = await supabase
      .from('user_clients')
      .select('client_id')
      .eq('user_id', userId);

    if (clientsError) {
      console.error('Error fetching user clients:', clientsError);
      return [];
    }

    return userClients?.map((uc: { client_id: string }) => uc.client_id) || [];
  } catch (err: unknown) {
    console.error('Client access exception:', err);
    return [];
  }
}

// Middleware to require authentication
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Always require proper authentication - no bypasses for security

    try {
      // Enhanced token validation with multiple methods
      const { user, supabase } = await validateUserToken(req);

      if (!user || !supabase) {
        return errorResponse(res, ErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      // Get user profile with enhanced error handling
      const profile = await getUserProfile(supabase, user);

      // Get user's client access with error handling
      const clientIds = await getUserClients(supabase, user.id);

      // Add user info to request
      (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email || '',
        role: (profile?.role as UserRole) || UserRole.VIEWER,
        permissions: profile?.permissions || [],
        clientIds,
        tenantId: profile?.tenant_id || ''};

      console.log(`✅ Request authenticated for user: ${user.email} (${profile?.role})`);

      // Call the handler
      return await handler(req as AuthenticatedRequest, res);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('❌ Authentication error:', error);
      return errorResponse(
        res,
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Authentication service error',
        500
      );
    }
  };
}

// Middleware to require specific roles
export function withRoles(roles: UserRole | UserRole[]) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      const userRole = req.user?.role;

      if (!userRole) {
        return errorResponse(res, ErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        return errorResponse(res, ErrorCode.FORBIDDEN, 'Insufficient permissions', 403);
      }

      return await handler(req, res);
    });
  };
}

// Middleware to require specific permissions
export function withPermissions(requiredPermissions: string | string[]) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      const userPermissions = req.user?.permissions || [];

      const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      const hasAllPermissions = permissions.every(
        permission => userPermissions.includes(permission) || userPermissions.includes('*')
      );

      if (!hasAllPermissions) {
        return errorResponse(res, ErrorCode.FORBIDDEN, 'Insufficient permissions', 403);
      }

      return await handler(req, res);
    });
  };
}

// Middleware to require client access
export function withClientAccess(clientIdParam: string = 'clientId') {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      const userRole = req.user?.role;
      const userClientIds = req.user?.clientIds || [];

      // Admin can access all clients
      if (userRole === UserRole.ADMIN) {
        return await handler(req, res);
      }

      // Get client ID from request
      const clientId =
        (req.query[clientIdParam] as string) ||
        (req.body[clientIdParam] as string) ||
        (req.headers['x-client-id'] as string);

      if (!clientId) {
        return errorResponse(res, ErrorCode.VALIDATION_ERROR, 'Client ID is required', 400);
      }

      // Check if user has access to the client
      if (!userClientIds.includes(clientId)) {
        return errorResponse(
          res,
          ErrorCode.FORBIDDEN,
          'You do not have access to this client',
          403
        );
      }

      return await handler(req, res);
    });
  };
}
