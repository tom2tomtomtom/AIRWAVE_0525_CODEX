import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Typography,
  Divider,
  IconButton,
  Chip,
  Tooltip} from '@mui/material';
import {
  Dashboard,
  PlayArrow,
  Folder,
  Analytics,
  Settings,
  ExpandLess,
  ExpandMore,
  VideoLibrary,
  Image,
  GridView,
  Group,
  Campaign,
  Approval,
  Close} from '@mui/icons-material';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavItem[];
  badge?: string;
  description?: string;
}

interface SimplifiedNavigationProps {
  open: boolean;
  onClose: () => void;
  variant?: 'permanent' | 'temporary';
}

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Dashboard />,
    href: '/dashboard',
    description: 'Overview and quick actions' },
  {
    id: 'create',
    label: 'Create',
    icon: <PlayArrow />,
    children: [
      {
        id: 'workflow',
        label: 'Brief to Video',
        icon: <PlayArrow />,
        href: '/flow',
        description: 'Complete workflow from brief to render' },
      {
        id: 'strategy',
        label: 'Strategy Generator',
        icon: <PlayArrow />,
        href: '/strategy',
        description: 'AI-powered strategy generation' },
      {
        id: 'templates',
        label: 'Templates',
        icon: <VideoLibrary />,
        href: '/templates',
        description: 'Pre-built video templates' },
      {
        id: 'assets',
        label: 'Assets',
        icon: <Image />,
        href: '/assets',
        description: 'Manage images, videos, and files'},
    ]},
  {
    id: 'manage',
    label: 'Manage',
    icon: <Folder />,
    children: [
      {
        id: 'clients',
        label: 'Clients',
        icon: <Group />,
        href: '/clients',
        description: 'Client management' },
      {
        id: 'campaigns',
        label: 'Campaigns',
        icon: <Campaign />,
        href: '/campaigns',
        description: 'Campaign overview' },
      {
        id: 'matrix',
        label: 'Content Matrix',
        icon: <GridView />,
        href: '/matrix',
        description: 'Content planning and organization' },
    ]},
  {
    id: 'execute',
    label: 'Execute',
    icon: <PlayArrow />,
    children: [
      {
        id: 'approvals',
        label: 'Approvals',
        icon: <Approval />,
        href: '/approvals',
        badge: '3',
        description: 'Review and approve content' },
      {
        id: 'execute-page',
        label: 'Execute',
        icon: <PlayArrow />,
        href: '/execute',
        description: 'Launch and monitor campaigns' },
    ]},
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <Analytics />,
    href: '/analytics',
    description: 'Performance metrics and insights' },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings />,
    children: [
      {
        id: 'webhooks',
        label: 'Webhooks',
        icon: <Settings />,
        href: '/webhooks',
        description: 'API integrations' },
      {
        id: 'social',
        label: 'Social Publishing',
        icon: <Campaign />,
        href: '/social-publishing',
        description: 'Social media management' },
    ]},
];

export const SimplifiedNavigation: React.FC<SimplifiedNavigationProps> = ({
  open,
  onClose,
  variant = 'temporary'}) => {
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>(['create']);

  const handleItemClick = (item: NavItem) => {
    if (item.href) {
      router.push(item.href);
      if (variant === 'temporary') {
        onClose();
      }
    } else if (item.children) {
      toggleExpanded(item.id);
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId) ? prev.filter((id: any) => id !== itemId) : [...prev, itemId]
    );
  };

  const isActive = (href: string) => {
    return router.pathname === href;
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const active = item.href ? isActive(item.href) : false;

    return (
      <React.Fragment key={item.id}>
        <Tooltip title={item.description || ''} placement="right" arrow>
          <ListItem disablePadding sx={{ pl: depth * 2 }}>
            <ListItemButton
              onClick={() => handleItemClick(item)}
              sx={{
                borderRadius: 1,
                mx: 1,
                mb: 0.5,
                backgroundColor: active ? 'primary.main' : 'transparent',
                color: active ? 'primary.contrastText' : 'inherit',
                '&:hover': {
                  backgroundColor: active ? 'primary.dark' : 'action.hover' }}}
            >
              <ListItemIcon
                sx={{
                  color: active ? 'primary.contrastText' : 'inherit',
                  minWidth: 40 }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={active ? 600 : 400}>
                      {item.label}
                    </Typography>
                    {item.badge && (
                      <Chip
                        label={item.badge}
                        size="small"
                        color="error"
                        sx={{ height: 16, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                }
              />
              {hasChildren && (
                <IconButton
                  size="small"
                  sx={{ color: 'inherit' }}
                  aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                >
                  {' '}
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              )}
            </ListItemButton>
          </ListItem>
        </Tooltip>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map((child: any) => renderNavItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const drawerContent = (
    <Box sx={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={600} color="primary">
          AIrFLOW
        </Typography>
        {variant === 'temporary' && (
          <IconButton onClick={onClose} size="small" aria-label="Close navigation">
            {' '}
            <Close />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Navigation Items */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <List>{navigationItems.map((item: any) => renderNavItem(item))}</List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" display="block">
          AIrFLOW v2.0
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Simplified Interface
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: 280,
          border: 'none',
          boxShadow: variant === 'permanent' ? 'none' : 3 }}}
    >
      {drawerContent}
    </Drawer>
  );
};
