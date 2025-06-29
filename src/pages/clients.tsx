import React, { useState } from 'react';
import Head from 'next/head';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Tooltip,
  ListItemIcon,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Business as BusinessIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Language as WebsiteIcon,
  Person as PersonIcon,
  Palette as PaletteIcon,
  ExpandMore as ExpandMoreIcon,
  Facebook,
  Twitter,
  Instagram,
  LinkedIn,
  YouTube
} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';
import type { Client, Contact } from '@/types/models';

interface ClientFormData {
  name: string;
  industry: string;
  description: string;
  website: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  contacts: Contact[];
  brand_guidelines: {
    voiceTone: string;
    targetAudience: string;
    keyMessages: string[];
  };
}

const ClientsPage: React.FC = () => {
  const { clients, loading, createClient, updateClient, deleteClient } = useClient();
  const { showNotification } = useNotification();

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    industry: '',
    description: '',
    website: '',
    logo: '',
    primaryColor: '#2196F3',
    secondaryColor: '#FF9800',
    socialMedia: {},
    contacts: [],
    brand_guidelines: {
      voiceTone: '',
      targetAudience: '',
      keyMessages: []
    }
  });

  // Form validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Get unique industries for filter
  const industries = Array.from(new Set(clients.map((client: any) => client.industry).filter(Boolean)));

  // Filter clients
  const filteredClients = clients.filter((client: any) => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = !industryFilter || client.industry === industryFilter;
    return matchesSearch && matchesIndustry;
  });

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Client name is required';
    if (!formData.industry.trim()) errors.industry = 'Industry is required';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      if (selectedClient) {
        // Update existing client
        await updateClient(selectedClient.id, formData);
        showNotification('Client updated successfully!', 'success');
      } else {
        // Create new client
        await createClient(formData);
        showNotification('Client created successfully!', 'success');
      }
      handleCloseDialog();
    } catch (error: any) {
      showNotification('Failed to save client. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!clientToDelete) return;

    try {
      await deleteClient(clientToDelete.id);
      showNotification('Client deleted successfully!', 'success');
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (error: any) {
      showNotification('Failed to delete client. Please try again.', 'error');
    }
  };

  // Dialog handlers
  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setSelectedClient(client);
      setFormData({
        name: client.name,
        industry: client.industry,
        description: client.description,
        website: client.website,
        logo: client.logo,
        primaryColor: client.primaryColor,
        secondaryColor: client.secondaryColor,
        socialMedia: client.socialMedia || {},
          contacts: client.contacts || [],
        brand_guidelines: client.brand_guidelines || {
          voiceTone: '',
          targetAudience: '',
          keyMessages: []
        }
      });
    } else {
      setSelectedClient(null);
      setFormData({
        name: '',
        industry: '',
        description: '',
        website: '',
        logo: '',
        primaryColor: '#2196F3',
        secondaryColor: '#FF9800',
        socialMedia: {},
        contacts: [],
        brand_guidelines: {
          voiceTone: '',
          targetAudience: '',
          keyMessages: []
        }
      });
    }
    setFormErrors({});
    setActiveTab(0);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedClient(null);
    setFormErrors({});
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, client: Client) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedClient(client);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedClient(null);
  };

  // Social media icons
  const getSocialIcon = (platform: string) => {
    const icons: Record<string, React.ReactNode> = {
      facebook: <Facebook />,
      twitter: <Twitter />,
      instagram: <Instagram />,
      linkedin: <LinkedIn />,
      youtube: <YouTube />
    };
    return icons[platform] || <WebsiteIcon />;
  };

  return (
    <>
       <Head>
        <title>Clients | AIRFLOW</title>
      </Head>
      <DashboardLayout title="Clients">
        <Box sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
                Client Management
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage your clients and their brand information
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Client
            </Button>
          </Box>

          {/* Search and Filter Bar */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Filter by Industry</InputLabel>
                  <Select
                    value={industryFilter}
                    label="Filter by Industry"
                    onChange={(e) => setIndustryFilter(e.target.value)}
                  >
                    <MenuItem value="">All Industries</MenuItem>
                    {industries.map((industry: any) => (
                      <MenuItem key={industry} value={industry}>
                        {industry}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {filteredClients.length} of {clients.length} clients
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>

        {/* Loading State */}
        {loading && (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty State */}
        {!loading && clients.length === 0 && (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <BusinessIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No clients yet
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Get started by adding your first client
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Your First Client
            </Button>
          </Paper>
        )}

        {/* Clients Grid */}
        {!loading && filteredClients.length > 0 && (
          <Grid container spacing={3}>
            {filteredClients.map((client: any) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={client.id}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3}}}
                  onClick={() => handleOpenDialog(client)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          src={client.logo}
                          sx={{
                            bgcolor: client.primaryColor,
                            width: 48,
                            height: 48}}
                        >
                          <BusinessIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {client.name}
                          </Typography>
                          <Chip
                            label={client.industry}
                            size="small"
                            sx={{
                              bgcolor: client.primaryColor,
                              color: 'white'}}
                          />
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, client)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>

                    <Typography variant="body2" color="text.secondary" paragraph>
                      {client.description || 'No description provided'}
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      {client.website && (
                        <Tooltip title="Website">
                          <IconButton size="small">
                            <WebsiteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {Object.entries(client.socialMedia || {}).map(([platform, url]) => (
                        url && (
                          <Tooltip key={platform} title={platform}>
                            <IconButton size="small">
                              {getSocialIcon(platform)}
                            </IconButton>
                          </Tooltip>
                        )
                      ))}
                    </Box>

                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {client.contacts?.length || 0} contacts
                      </Typography>
                      <Box display="flex" gap={0.5}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: client.primaryColor}}
                        />
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: client.secondaryColor}}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Context Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem
            onClick={() => {
              handleMenuClose();
              if (selectedClient) handleOpenDialog(selectedClient);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Client</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleMenuClose();
              if (selectedClient) {
                setClientToDelete(selectedClient);
                setDeleteDialogOpen(true);
              }
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete Client</ListItemText>
          </MenuItem>
        </Menu>

        {/* Client Form Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {selectedClient ? 'Edit Client' : 'Add New Client'}
          </DialogTitle>
          <DialogContent>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="Basic Info" />
              <Tab label="Brand & Colors" />
              <Tab label="Social Media" />
              <Tab label="Contacts" />
            </Tabs>

            <Box sx={{ mt: 3 }}>
              {/* Tab 0: Basic Info */}
              {activeTab === 0 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Client Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      error={!!formErrors.name}
                      helperText={formErrors.name}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth error={!!formErrors.industry}>
                      <InputLabel required>Industry</InputLabel>
                      <Select
                        value={formData.industry}
                        label="Industry"
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      >
                        <MenuItem value="Technology">Technology</MenuItem>
                        <MenuItem value="Healthcare">Healthcare</MenuItem>
                        <MenuItem value="Finance">Finance</MenuItem>
                        <MenuItem value="Retail">Retail</MenuItem>
                        <MenuItem value="Education">Education</MenuItem>
                        <MenuItem value="Manufacturing">Manufacturing</MenuItem>
                        <MenuItem value="Marketing">Marketing</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Logo URL"
                      value={formData.logo}
                      onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </Grid>
                </Grid>
              )}

              {/* Tab 1: Brand & Colors */}
              {activeTab === 1 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Primary Color"
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PaletteIcon />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Secondary Color"
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PaletteIcon />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Voice & Tone"
                      value={formData.brand_guidelines.voiceTone}
                      onChange={(e) => setFormData({
                        ...formData,
                        brand_guidelines: {
                          ...formData.brand_guidelines,
                          voiceTone: e.target.value
                        }
                      })}
                      placeholder="e.g., Professional and friendly"
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Target Audience"
                      value={formData.brand_guidelines.targetAudience}
                      onChange={(e) => setFormData({
                        ...formData,
                        brand_guidelines: {
                          ...formData.brand_guidelines,
                          targetAudience: e.target.value
                        }
                      })}
                      placeholder="e.g., Young professionals aged 25-35"
                    />
                  </Grid>
                </Grid>
              )}

              {/* Tab 2: Social Media */}
              {activeTab === 2 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Facebook"
                      value={formData.socialMedia.facebook || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, facebook: e.target.value }
                      })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Facebook />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Twitter"
                      value={formData.socialMedia.twitter || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, twitter: e.target.value }
                      })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Twitter />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Instagram"
                      value={formData.socialMedia.instagram || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, instagram: e.target.value }
                      })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Instagram />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="LinkedIn"
                      value={formData.socialMedia.linkedin || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, linkedin: e.target.value }
                      })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkedIn />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="YouTube"
                      value={formData.socialMedia.youtube || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, youtube: e.target.value }
                      })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <YouTube />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                </Grid>
              )}

              {/* Tab 3: Contacts */}
              {activeTab === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Contact Information
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Add key contacts for this client
                  </Typography>

                  {formData.contacts.length === 0 ? (
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                      <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        No contacts added yet
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        sx={{ mt: 2 }}
                        onClick={() => {
                          const newContact: Contact = {
                            id: `contact_${Date.now()}`,
                            name: '',
                            email: '',
                            role: '',
                            phone: '',
                            isActive: true
                          };
                          setFormData({
                            ...formData,
                            contacts: [...formData.contacts, newContact]
                          });
                        }}
                      >
                        Add Contact
                      </Button>
                    </Paper>
                  ) : (
                    <Box>
                      {formData.contacts.map((contact, index) => (
                        <Accordion key={contact.id}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>
                              {contact.name || `Contact ${index + 1}`}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Name"
                                  value={contact.name}
                                  onChange={(e) => {
                                    const updatedContacts = [...formData.contacts];
                                    updatedContacts[index] = { ...contact, name: e.target.value };
                                    setFormData({ ...formData, contacts: updatedContacts });
                                  }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Role"
                                  value={contact.role}
                                  onChange={(e) => {
                                    const updatedContacts = [...formData.contacts];
                                    updatedContacts[index] = { ...contact, role: e.target.value };
                                    setFormData({ ...formData, contacts: updatedContacts });
                                  }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Email"
                                  type="email"
                                  value={contact.email}
                                  onChange={(e) => {
                                    const updatedContacts = [...formData.contacts];
                                    updatedContacts[index] = { ...contact, email: e.target.value };
                                    setFormData({ ...formData, contacts: updatedContacts });
                                  }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Phone"
                                  value={contact.phone || ''}
                                  onChange={(e) => {
                                    const updatedContacts = [...formData.contacts];
                                    updatedContacts[index] = { ...contact, phone: e.target.value };
                                    setFormData({ ...formData, contacts: updatedContacts });
                                  }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <Button
                                  color="error"
                                  onClick={() => {
                                    const updatedContacts = formData.contacts.filter((_, i) => i !== index);
                                    setFormData({ ...formData, contacts: updatedContacts });
                                  }}
                                >
                                  Remove Contact
                                </Button>
                              </Grid>
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        sx={{ mt: 2 }}
                        onClick={() => {
                          const newContact: Contact = {
                            id: `contact_${Date.now()}`,
                            name: '',
                            email: '',
                            role: '',
                            phone: '',
                            isActive: true
                          };
                          setFormData({
                            ...formData,
                            contacts: [...formData.contacts, newContact]
                          });
                        }}
                      >
                        Add Another Contact
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={20} /> : undefined}
            >
              {submitting ? 'Saving...' : selectedClient ? 'Update Client' : 'Create Client'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Client</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{clientToDelete?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleDelete}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </>
  );
};

export default ClientsPage;