import React, { useState, useEffect } from 'react';
// Optimized MUI imports - individual components for better tree shaking
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';

// Optimized icon imports - individual icons to reduce bundle size
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import CampaignIcon from '@mui/icons-material/Campaign';
import ImageIcon from '@mui/icons-material/Image';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import DescriptionIcon from '@mui/icons-material/Description';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import WebhookIcon from '@mui/icons-material/Webhook';
import ShareIcon from '@mui/icons-material/Share';
import SearchIcon from '@mui/icons-material/Search';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useRouter } from 'next/router';
import ClientSelector from './ClientSelector';
import UserMenu from './UserMenu';
import LiveCollaboration from './realtime/LiveCollaboration';
import { GlobalSearch } from './GlobalSearch';
import { useThemeMode } from '@/contexts/ThemeContext';

const drawerWidth = 240;

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { name: 'Clients', href: '/clients', icon: BusinessIcon },
  { name: 'Campaigns', href: '/campaigns', icon: CampaignIcon },
  { name: 'Flow', href: '/flow', icon: TrendingUpIcon },
  { divider: true },
  { name: 'Strategy', href: '/strategy', icon: PsychologyIcon },
  { name: 'Analytics', href: '/analytics', icon: AnalyticsIcon },
  { name: 'Assets', href: '/assets', icon: ImageIcon },
  { name: 'Templates', href: '/templates', icon: DescriptionIcon },
  { name: 'Matrix', href: '/matrix', icon: ViewModuleIcon },
  { divider: true },
  { name: 'Execute', href: '/execute', icon: PlayArrowIcon },
  { name: 'Approvals', href: '/approvals', icon: AssignmentIcon },
  { name: 'Preview', href: '/preview', icon: VisibilityIcon },
  { divider: true },
  {
    name: 'Social Publishing',
    href: '/social-publishing',
    icon: ShareIcon,
    disabled: true,
    comingSoon: true,
  },
  { name: 'Webhooks', href: '/webhooks', icon: WebhookIcon },
];

export type DashboardLayoutProps = {
  title?: string;
  children: React.ReactNode;
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ title, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { mode, toggleMode } = useThemeMode();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Add Cmd+K / Ctrl+K keyboard shortcut for global search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const drawer = (
    <div>
      <Toolbar sx={{ py: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="h5"
            noWrap
            component="div"
            className="text-gradient"
            sx={{
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1.75rem',
              letterSpacing: '-0.02em',
            }}
            onClick={() => router.push('/dashboard')}
          >
            AIrFLOW
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {navigation.map((item, index) => {
          if (item.divider) {
            return <Divider key={`divider-${index}`} sx={{ my: 1 }} />;
          }

          const Icon = item.icon!;
          const isActive =
            router.pathname === item.href ||
            (item.href === '/clients' && router.pathname.startsWith('/clients')) ||
            (item.href === '/campaigns' && router.pathname.startsWith('/campaigns'));

          return (
            <ListItem key={item.name} disablePadding>
              <ListItemButton
                selected={isActive}
                disabled={!!item.disabled}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!item.disabled && item.href) {
                    router.push(item.href);
                    if (isMobile) {
                      setMobileOpen(false);
                    }
                  }
                }}
                className="floating-card"
                sx={{
                  mx: 1,
                  borderRadius: 3,
                  transition: 'all 0.3s ease',
                  opacity: item.disabled ? 0.5 : 1,
                  '&:hover': {
                    paddingLeft: item.disabled ? '16px' : '20px',
                  },
                  '&.Mui-selected': {
                    background: theme =>
                      theme.palette.mode === 'light'
                        ? 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'
                        : 'linear-gradient(135deg, #A78BFA 0%, #F472B6 100%)',
                    color: '#FFFFFF',
                    '& .MuiListItemIcon-root': {
                      color: '#FFFFFF',
                    },
                    '&:hover': {
                      opacity: 0.9,
                    },
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5,
                    '& .MuiListItemIcon-root': {
                      color: 'text.disabled',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    transition: 'transform 0.3s ease',
                    ...(isActive && { transform: 'scale(1.1)' }),
                  }}
                >
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  secondary={item.comingSoon ? 'Coming Soon' : undefined}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.95rem',
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.75rem',
                    color: 'text.disabled',
                  }}
                />
                {item.comingSoon && (
                  <Chip
                    label="Soon"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.6rem',
                      bgcolor: 'warning.light',
                      color: 'warning.contrastText',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        className="glass-panel"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: theme =>
            theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 22, 41, 0.6)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: 'text.primary',
          boxShadow: 'none',
          borderBottom: '1px solid',
          borderColor: theme =>
            theme.palette.mode === 'light'
              ? 'rgba(124, 58, 237, 0.1)'
              : 'rgba(167, 139, 250, 0.15)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {title || 'AIrFLOW Dashboard'}
          </Typography>

          {/* Global Search Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 2 }}>
            <TextField
              size="small"
              placeholder="Search... (⌘K)"
              onClick={() => setSearchOpen(true)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Chip
                      label="⌘K"
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </InputAdornment>
                ),
                readOnly: true,
              }}
              sx={{
                minWidth: 200,
                cursor: 'pointer',
                '& .MuiInputBase-input': {
                  cursor: 'pointer',
                },
                display: { xs: 'none', md: 'block' },
              }}
            />

            {/* Mobile search icon */}
            <IconButton
              onClick={() => setSearchOpen(true)}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              <SearchIcon />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ClientSelector variant="chip" />
            <LiveCollaboration compact />
            <IconButton
              onClick={toggleMode}
              sx={{
                p: 1,
                background: theme =>
                  theme.palette.mode === 'light'
                    ? 'rgba(124, 58, 237, 0.1)'
                    : 'rgba(167, 139, 250, 0.1)',
                '&:hover': {
                  background: theme =>
                    theme.palette.mode === 'light'
                      ? 'rgba(124, 58, 237, 0.2)'
                      : 'rgba(167, 139, 250, 0.2)',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s ease',
              }}
              title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
            {/* <NotificationCenter /> */}
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="navigation menu"
        data-testid="sidebar-nav"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              background: theme =>
                theme.palette.mode === 'light'
                  ? 'rgba(255, 255, 255, 0.7)'
                  : 'rgba(15, 22, 41, 0.6)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRight: '1px solid',
              borderColor: theme =>
                theme.palette.mode === 'light'
                  ? 'rgba(255, 255, 255, 0.18)'
                  : 'rgba(167, 139, 250, 0.2)',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              background: theme =>
                theme.palette.mode === 'light'
                  ? 'rgba(255, 255, 255, 0.7)'
                  : 'rgba(15, 22, 41, 0.6)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRight: '1px solid',
              borderColor: theme =>
                theme.palette.mode === 'light'
                  ? 'rgba(255, 255, 255, 0.18)'
                  : 'rgba(167, 139, 250, 0.2)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 4,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          background: 'transparent',
          position: 'relative',
        }}
      >
        <Toolbar />
        {children}
      </Box>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
};

export default DashboardLayout;
