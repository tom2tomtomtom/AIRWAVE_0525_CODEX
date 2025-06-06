import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Container,
  Grid,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Launch as LaunchIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorMessage from '@/components/ErrorMessage';
import { useClients } from '@/hooks/useData';
import { useClient } from '@/contexts/ClientContext';
import { EmptyClients } from '@/components/EmptyStates';
import { CardSkeleton } from '@/components/SkeletonLoaders';
import { AnimatedActionButton } from '@/components/AnimatedComponents';
import type { Client } from '@/types/models';

const ClientsPage: React.FC = () => {
  const router = useRouter();
  const { data: clients, isLoading, error, refetch } = useClients();
  const { activeClient, setActiveClient } = useClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Handle authentication errors
  useEffect(() => {
    if (error && error.message.includes('Authentication failed')) {
      // Redirect to login if authentication fails
      router.push('/login');
    }
  }, [error, router]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, client: Client) => {
    setAnchorEl(event.currentTarget);
    setSelectedClient(client);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCreateClient = () => {
    router.push('/create-client');
  };

  const handleEditClient = (clientId: string) => {
    router.push(`/clients/${clientId}`);
    handleMenuClose();
  };

  const handleViewClient = (clientId: string) => {
    router.push(`/clients/${clientId}`);
  };

  const handleSelectClient = (client: Client) => {
    setActiveClient(client);
    // Use router.replace to avoid navigation history issues
    router.replace('/dashboard');
  };

  const handleDeleteClient = () => {
    // TODO: Implement actual delete functionality
    if (process.env.NODE_ENV === 'development') {
      process.env.NODE_ENV === 'development' && console.log('Delete client:', selectedClient);
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const filteredClients = clients?.filter((client: Client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <DashboardLayout>
      <Head>
        <title>Clients | AIrWAVE</title>
      </Head>

      <Container maxWidth="lg">
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4">
              Clients
            </Typography>
            <AnimatedActionButton onClick={handleCreateClient}>
              <AddIcon sx={{ mr: 1 }} />
              Add Client
            </AnimatedActionButton>
          </Box>

          <TextField
            fullWidth
            placeholder="Search clients by name, industry, or description..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLElement>) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {isLoading && (
          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <CardSkeleton height={300} />
              </Grid>
            ))}
          </Grid>
        )}

        {error && (
          <ErrorMessage
            title="Failed to load clients"
            error={error}
            onRetry={refetch}
          />
        )}

        {!isLoading && !error && filteredClients.length === 0 && !searchTerm && (
          <EmptyClients onAddClient={handleCreateClient} />
        )}

        {!isLoading && !error && filteredClients.length === 0 && searchTerm && (
          <Box textAlign="center" py={8}>
            <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No clients found for "{searchTerm}"
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Try adjusting your search criteria or create a new client
            </Typography>
            <AnimatedActionButton onClick={() => setSearchTerm('')}>
              Clear Search
            </AnimatedActionButton>
          </Box>
        )}

        <Grid container spacing={3}>
          {filteredClients.map((client: Client) => (
            <Grid item xs={12} sm={6} md={4} key={client.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3,
                  },
                  ...(activeClient?.id === client.id && {
                    borderColor: 'primary.main',
                    borderWidth: 2,
                    borderStyle: 'solid',
                  }),
                }}
                onClick={() => handleViewClient(client.id)}
              >
                <Box sx={{ position: 'relative', height: 140, bgcolor: client.primaryColor || 'grey.200' }}>
                  {client.logo ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={client.logo}
                      alt={client.name}
                      sx={{ objectFit: 'contain', p: 2, bgcolor: 'white' }}
                    />
                  ) : (
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      height="100%"
                    >
                      <Avatar
                        sx={{
                          width: 80,
                          height: 80,
                          bgcolor: 'white',
                          color: client.primaryColor || 'primary.main',
                        }}
                      >
                        <BusinessIcon sx={{ fontSize: 40 }} />
                      </Avatar>
                    </Box>
                  )}
                  <IconButton
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      handleMenuOpen(e, client);
                    }}
                  >
                    <MoreIcon />
                  </IconButton>
                </Box>

                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {client.name}
                  </Typography>
                  <Chip
                    label={client.industry}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {client.description}
                  </Typography>
                  {client.contacts?.length > 0 && (
                    <Box display="flex" alignItems="center" mt={1}>
                      <PeopleIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {client.contacts.length} contact{client.contacts.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      handleSelectClient(client);
                    }}
                    disabled={activeClient?.id === client.id}
                  >
                    {activeClient?.id === client.id ? 'Active' : 'Select'}
                  </Button>
                  {client.website && (
                    <IconButton
                      size="small"
                      onClick={(e: React.MouseEvent<HTMLElement>) => {
                        e.stopPropagation();
                        window.open(client.website, '_blank');
                      }}
                    >
                      <LaunchIcon fontSize="small" />
                    </IconButton>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => selectedClient && handleEditClient(selectedClient.id)}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => setDeleteDialogOpen(true)}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Client</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete &quot;{selectedClient?.name}&quot;? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDeleteClient}
              color="error"
              variant="contained"
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </DashboardLayout>
  );
};

export default ClientsPage;