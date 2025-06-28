import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Button,
  useTheme,
  useMediaQuery,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Settings,
  Help,
  Notifications,
  Search,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { SimplifiedNavigation } from './SimplifiedNavigation';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '@/contexts/AuthContext';

interface SimplifiedLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export const SimplifiedLayout: React.FC<SimplifiedLayoutProps> = ({
  children,
  title,
  breadcrumbs = [],
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    logout();
    handleUserMenuClose();
    router.push('/login');
  };

  const getPageTitle = () => {
    if (title) return title;

    // Auto-generate title from route
    const path = router.pathname;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';

    return (
      segments[segments.length - 1]
        ?.split('-')
        .map((word: any) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Dashboard'
    );
  };

  const generateBreadcrumbs = () => {
    if (breadcrumbs.length > 0) return breadcrumbs;

    // Auto-generate breadcrumbs from route
    const path = router.pathname;
    const segments = path.split('/').filter(Boolean);

    const crumbs: Array<{ label: string; href?: string }> = [
      { label: 'Dashboard', href: '/dashboard' },
    ];

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = segment
        .split('-')
        .map((word: any) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const crumb: { label: string; href?: string } = { label };
      if (index !== segments.length - 1) {
        crumb.href = currentPath;
      }
      crumbs.push(crumb);
    });

    return crumbs;
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Navigation */}
      {!isMobile && <SimplifiedNavigation open={true} onClose={() => {}} variant="permanent" />}

      {/* Mobile Navigation */}
      {isMobile && (
        <SimplifiedNavigation
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          variant="temporary"
        />
      )}

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top App Bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            color: 'text.primary',
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            {/* Left Side */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {isMobile && (
                <IconButton
                  edge="start"
                  onClick={() => setMobileNavOpen(true)}
                  sx={{ color: 'text.primary' }}
                >
                  <MenuIcon />
                </IconButton>
              )}

              <Box>
                <Typography variant="h6" fontWeight={600}>
                  {getPageTitle()}
                </Typography>

                {/* Breadcrumbs */}
                <Breadcrumbs aria-label="breadcrumb" sx={{ fontSize: '0.875rem' }}>
                  {generateBreadcrumbs().map((crumb, index) =>
                    crumb.href ? (
                      <Link
                        key={index}
                        color="inherit"
                        href={crumb.href}
                        onClick={e => {
                          e.preventDefault();
                          router.push(crumb.href!);
                        }}
                        sx={{
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <Typography key={index} color="text.primary" fontSize="inherit">
                        {crumb.label}
                      </Typography>
                    )
                  )}
                </Breadcrumbs>
              </Box>
            </Box>

            {/* Right Side */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Quick Actions */}
              <IconButton
                size="small"
                sx={{ color: 'text.secondary' }}
                onClick={() => setSearchOpen(true)}
              >
                <Search />
              </IconButton>

              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <Notifications />
              </IconButton>

              {/* User Menu */}
              <Button
                onClick={handleUserMenuOpen}
                startIcon={
                  <Avatar sx={{ width: 32, height: 32 }}>{user?.name?.charAt(0) || 'U'}</Avatar>
                }
                sx={{
                  textTransform: 'none',
                  color: 'text.primary',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                {user?.name || 'User'}
              </Button>

              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem
                  onClick={() => {
                    router.push('/profile');
                    handleUserMenuClose();
                  }}
                >
                  <AccountCircle sx={{ mr: 2 }} />
                  Profile
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    router.push('/settings');
                    handleUserMenuClose();
                  }}
                >
                  <Settings sx={{ mr: 2 }} />
                  Settings
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    router.push('/help');
                    handleUserMenuClose();
                  }}
                >
                  <Help sx={{ mr: 2 }} />
                  Help
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <Logout sx={{ mr: 2 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            backgroundColor: 'background.default',
            overflow: 'auto',
          }}
        >
          {children}
        </Box>

        {/* Global Search */}
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      </Box>
    </Box>
  );
};
