import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';
import type { Client } from '@/types/models';

interface ClientSelectorProps {
  fullWidth?: boolean;
  showCreateButton?: boolean;
  onClientChange?: (client: Client | null) => void;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({
  fullWidth = true,
  showCreateButton = true,
  onClientChange,
}) => {
  const router = useRouter();
  const { 
    clients, 
    activeClient, 
    setActiveClient, 
    loading: clientsLoading,
    error: clientsError,
    refreshClients,
  } = useClient();
  const { showNotification } = useNotification();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDescription, setNewClientDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Filter clients based on search term
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.description && client.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleClientChange = (clientId: string) => {
    const selectedClient = clients.find(c => c.id === clientId) || null;
    setActiveClient(selectedClient);
    if (onClientChange) {
      onClientChange(selectedClient);
    }
    if (selectedClient) {
      showNotification(`Switched to ${selectedClient.name}`, 'info');
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      showNotification('Please enter a client name', 'error');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClientName.trim(),
          description: newClientDescription.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create client');
      }

      const newClient = await response.json();
      showNotification(`Client "${newClient.name}" created successfully`, 'success');
      
      // Refresh clients list and select the new client
      await refreshClients();
      setActiveClient(newClient);
      
      // Reset form and close dialog
      setNewClientName('');
      setNewClientDescription('');
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating client:', error);
      showNotification('Failed to create client', 'error');
    } finally {
      setCreating(false);
    }
  };

  const getClientAvatar = (client: Client) => {
    if (client.logo) {
      return <Avatar src={client.logo} sx={{ width: 24, height: 24, mr: 1 }} />;
    }
    return (
      <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: 'primary.main' }}>
        <BusinessIcon sx={{ fontSize: 16 }} />
      </Avatar>
    );
  };

  if (clientsError) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={refreshClients}>
          Retry
        </Button>
      }>
        Failed to load clients
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: fullWidth ? '100%' : 'auto' }}>
      <FormControl 
        fullWidth={fullWidth} 
        size="small"
        disabled={clientsLoading}
      >
        <InputLabel id="client-selector-label">Client</InputLabel>
        <Select
          labelId="client-selector-label"
          id="client-selector"
          value={activeClient?.id || ''}
          label="Client"
          onChange={(e) => handleClientChange(e.target.value)}
          startAdornment={
            clientsLoading ? (
              <InputAdornment position="start">
                <CircularProgress size={20} />
              </InputAdornment>
            ) : undefined
          }
          renderValue={(value) => {
            const client = clients.find(c => c.id === value);
            if (!client) return <em>Select a client</em>;
            return (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getClientAvatar(client)}
                <Typography variant="body2">{client.name}</Typography>
              </Box>
            );
          }}
        >
          <MenuItem value="" sx={{ py: 1 }}>
            <TextField
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => {
                e.stopPropagation();
                setSearchTerm(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm('');
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </MenuItem>
          
          {filteredClients.length === 0 ? (
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'No clients found' : 'No clients available'}
              </Typography>
            </MenuItem>
          ) : (
            filteredClients.map((client) => (
              <MenuItem key={client.id} value={client.id} sx={{ py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  {getClientAvatar(client)}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{client.name}</Typography>
                    {client.description && (
                      <Typography variant="caption" color="text.secondary">
                        {client.description}
                      </Typography>
                    )}
                  </Box>
                  {client.status === 'active' ? (
                    <Chip label="Active" size="small" color="success" />
                  ) : (
                    <Chip label="Inactive" size="small" color="default" />
                  )}
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {showCreateButton && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          New Client
        </Button>
      )}

      {/* Create Client Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => !creating && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Client</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Client Name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              fullWidth
              required
              disabled={creating}
              helperText="Enter the name of your client or organization"
            />
            <TextField
              label="Description"
              value={newClientDescription}
              onChange={(e) => setNewClientDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              disabled={creating}
              helperText="Optional: Add a brief description of the client"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setCreateDialogOpen(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateClient}
            variant="contained"
            disabled={!newClientName.trim() || creating}
            startIcon={creating ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {creating ? 'Creating...' : 'Create Client'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientSelector;