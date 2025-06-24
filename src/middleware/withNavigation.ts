import { NextApiRequest, NextApiResponse } from 'next';

export interface NavigationState {
  currentPath: string;
  previousPath?: string;
  isAuthenticated: boolean;
  userRole?: string;
  redirectAttempts: number;
  lastRedirectTime?: number;
}

export function withNavigationProtection(handler: unknown) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const navigationState: NavigationState = {
    currentPath: req.url || '',
        isAuthenticated: !!(req as any).user,
        userRole: (req as any).user?.role,
        redirectAttempts: 0 };

      const referer = req.headers.referer;
      if (referer && req.url) {
        const refererPath = new URL(referer).pathname;
        const currentPath = req.url.split('?')[0];

        if (refererPath === currentPath) {
          navigationState.redirectAttempts++;

          if (navigationState.redirectAttempts > 3) {
            console.warn('🔄 Potential redirect loop detected:', {
              path: currentPath,
              referer: refererPath,
              attempts: navigationState.redirectAttempts });

            return res.redirect(302, '/dashboard');
          }
        }
      }

      (req as any).navigationState = navigationState;
      return await handler(req, res);
    } catch (error: unknown) {
      console.error('Navigation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Navigation error' });
    }
  };
}

export function withAuthRedirect(redirectTo: string = '/login') {
  return (handler: unknown) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        const user = (req as any).user;
        const navigationState = (req as any).navigationState;

        if (!user) {
          if (req.url?.includes('/login') || req.url?.includes('/auth')) {
            return await handler(req, res);
          }

          if (navigationState?.redirectAttempts > 2) {
            console.warn('🔄 Too many auth redirects, serving error page');
            return res.status(401).json({
              success: false,
              error: 'Authentication required',
              redirectTo: '/login' });
          }

          return res.redirect(302, redirectTo);
        }

        return await handler(req, res);
      } catch (error: unknown) {
        console.error('Auth redirect error:', error);
        return res.status(500).json({
          success: false,
          error: 'Authentication redirect error' });
      }
    };
  };
}
