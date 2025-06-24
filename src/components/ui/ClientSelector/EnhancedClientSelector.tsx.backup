import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  IconButton,
  Card,
  CardContent,
  Badge} from '@mui/material';
import {
  ArrowDropDown as ArrowDropDownIcon,
  Business as BusinessIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Clear as ClearIcon} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useClient } from '@/contexts/ClientContext';
import { LoadingState } from '../feedback/LoadingState';
import { ErrorState } from '../feedback/ErrorState';
import { createAccessibleField } from '@/utils/accessibility';
import type { Client } from '@/types/models';

interface EnhancedClientSelectorProps {
  variant?: 'button' | 'chip' | 'compact' | 'card';
  size?: 'small' | 'medium' | 'large';
  showAddOption?: boolean;
  showClientDetails?: boolean;
  showSearch?: boolean;
  showRecentClients?: boolean;
  maxMenuHeight?: number;
  onClientChange?: (client: Client | null) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export const EnhancedClientSelector: React.FC<EnhancedClientSelectorProps> = ({
  variant = 'button',
  size = 'medium',
  showAddOption = true,
  showClientDetails = true,
  showSearch = true,
  showRecentClients = true,
  maxMenuHeight = 400,
  onClientChange,
  onCreateNew,
  placeholder = 'Select a client...',
  disabled = false,
  error = false,
  helperText}) => {
  const router = useRouter();
  const { activeClient, setActiveClient, clients, loading, error: clientError } = useClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const isOpen = Boolean(anchorEl);

  // Create accessible props
  const { fieldProps } = createAccessibleField('Client Selector', {
    required: false,
    invalid: error});

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    let filtered = clients;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((client: any) =>
        client.name.toLowerCase().includes(search) ||
        client.email?.toLowerCase().includes(search) ||
        client.industry?.toLowerCase().includes(search)
      );
    }
    
    // Sort by active client first, then alphabetically
    return filtered.sort((a, b) => {
      if (a.id === activeClient?.id) return -1;
      if (b.id === activeClient?.id) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [clients, searchTerm, activeClient]);

  // Get recent clients (last 5 excluding current)
  const recentClients = useMemo(() => {
    if (!clients || !showRecentClients) return [];
    
    return clients
      .filter((client: any) => client.id !== activeClient?.id)
      .slice(0, 5);
  }, [clients, activeClient, showRecentClients]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
    setSearchTerm('');
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm('');
  };

  const handleClientSelect = (client: Client) => {
    setActiveClient(client);
    onClientChange?.(client);
    handleClose();
  };

  const handleClearSelection = (event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveClient(null);
    onClientChange?.(null);
  };

  const handleCreateNew = () => {
    handleClose();
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/clients/new');
    }
  };

  const renderClientInfo = (client: Client, compact = false) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Avatar
        sx={{
          width: compact ? 24 : 32,
          height: compact ? 24 : 32,
          bgcolor: 'primary.main',
          fontSize: compact ? '0.75rem' : '0.875rem'}}
      >
        {client.name.charAt(0).toUpperCase()}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant={compact ? 'body2' : 'body1'}
          sx={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'}}
        >
          {client.name}
        </Typography>
        {!compact && showClientDetails && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            {client.industry && (
              <Chip
                size="small"
                label={client.industry}
                sx={{
                  height: 16,
                  fontSize: '0.65rem',
                  bgcolor: 'action.hover',
                  color: 'text.secondary'}}
              />
            )}
            {client.email && (
              <Typography variant="caption" color="text.secondary">
                {client.email}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderButton = () => {
    const getSizeProps = () => {
      switch (size) {
        case 'small':
          return { padding: '6px 12px', minHeight: '32px' };
        case 'large':
          return { padding: '12px 20px', minHeight: '48px' };
        default:
          return { padding: '8px 16px', minHeight: '40px' };
      }
    };

    return (
      <Button
        {...fieldProps}
        variant="outlined"
        onClick={handleClick}
        disabled={disabled}
        endIcon={
          activeClient ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton
                size="small"
                onClick={handleClearSelection}
                sx={{ p: 0.25 }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
              <ArrowDropDownIcon />
            </Box>
          ) : (
            <ArrowDropDownIcon />
          )
        }
        sx={{
          justifyContent: 'space-between',
          textTransform: 'none',
          bgcolor: 'background.paper',
          borderColor: error ? 'error.main' : 'divider',
          color: activeClient ? 'text.primary' : 'text.secondary',
          ...getSizeProps(),
          '&:hover': {
            borderColor: error ? 'error.dark' : 'primary.main'}}}
      >
        {activeClient ? renderClientInfo(activeClient, true) : placeholder}
      </Button>
    );
  };

  const renderChip = () => (
    <Chip
      {...fieldProps}
      variant="outlined"
      label={activeClient ? activeClient.name : placeholder}
      avatar={
        activeClient ? (
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {activeClient.name.charAt(0)}
          </Avatar>
        ) : (
          <BusinessIcon />
        )
      }
      onClick={handleClick}
      onDelete={activeClient ? handleClearSelection : undefined}
      disabled={disabled}
      color={error ? 'error' : 'default'}
      sx={{
        maxWidth: '200px',
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis'}}}
    />
  );

  const renderCompact = () => (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        '&:hover': {
          opacity: disabled ? 0.6 : 0.8}}}
    >
      {activeClient ? (
        renderClientInfo(activeClient, true)
      ) : (
        <>
       <BusinessIcon color="action" />
          <Typography variant="body2" color="text.secondary">
            {placeholder}
          </Typography>
        </>
      )}
      <ArrowDropDownIcon color="action" />
    </Box>
  );

  const renderCard = () => (
    <Card
      variant="outlined"
      sx={{
        cursor: disabled ? 'default' : 'pointer',
        borderColor: error ? 'error.main' : 'divider',
        '&:hover': {
          borderColor: disabled ? 'divider' : error ? 'error.dark' : 'primary.main'}}}
      onClick={handleClick}
    >
      <CardContent sx={{ p: 2 }}>
        {activeClient ? (
          renderClientInfo(activeClient)
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BusinessIcon color="action" />
            <Typography color="text.secondary">{placeholder}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderSelector = () => {
    switch (variant) {
      case 'chip':
        return renderChip();
      case 'compact':
        return renderCompact();
      case 'card':
        return renderCard();
      default:
        return renderButton();
    }
  };

  if (loading) {
    return <LoadingState type="skeleton" rows={1} />;
  }

  if (clientError) {
    return (
      <ErrorState
        type="error"
        message="Failed to load clients"
        variant="alert"
        showRetry
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <Box>
      {renderSelector()}
      
      {helperText && (
        <Typography
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ mt: 0.5, display: 'block' }}
        >
          {helperText}
        </Typography>
      )}

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {},
  maxHeight: maxMenuHeight,
            width: Math.max(anchorEl?.getBoundingClientRect().width || 0, 300),
            mt: 1}}}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        {showSearch && (
          <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              size="small"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )}}
              sx={{ width: '100%' }}
            />
          </Box>
        )}

        {showRecentClients && recentClients.length > 0 && !searchTerm && (
          <>
       <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Recent Clients
              </Typography>
            </Box>
            {recentClients.map((client: any) => (
              <MenuItem
                key={`recent-${client.id}`}
                onClick={() => handleClientSelect(client)}
                sx={{ px: 2 }}
              >
                <Badge
                  badgeContent="Recent"
                  color="primary"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.6rem',
                      height: 16,
                      minWidth: 16}}}
                >
                  {renderClientInfo(client)}
                </Badge>
              </MenuItem>
            ))}
            <Divider />
          </>
        )}

        {filteredClients.length === 0 ? (
          <MenuItem disabled>
            <Typography color="text.secondary">
              {searchTerm ? 'No clients found' : 'No clients available'}
            </Typography>
          </MenuItem>
        ) : (
          filteredClients.map((client: any) => (
            <MenuItem
              key={client.id}
              onClick={() => handleClientSelect(client)}
              selected={client.id === activeClient?.id}
              sx={{ px: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {client.id === activeClient?.id && <CheckIcon color="primary" />}
              </ListItemIcon>
              <ListItemText sx={{ ml: -1 }}>
                {renderClientInfo(client)}
              </ListItemText>
            </MenuItem>
          ))
        )}

        {showAddOption && (
          <>
       <Divider />
            <MenuItem onClick={handleCreateNew} sx={{ px: 2 }}>
              <ListItemIcon>
                <AddIcon color="primary" />
              </ListItemIcon>
              <ListItemText>
                <Typography color="primary" sx={{ fontWeight: 500 }}>
                  Create New Client
                </Typography>
              </ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};