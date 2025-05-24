import React, { useState } from 'react';
import Head from 'next/head';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Chip,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import YouTubeIcon from '@mui/icons-material/YouTube';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PinterestIcon from '@mui/icons-material/Pinterest';
import TikTokIcon from '@mui/icons-material/MusicNote';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DashboardLayout from '@/components/DashboardLayout';

import { useQuery } from '@tanstack/react-query';
import type { Database } from '../lib/supabase';
type TemplateRow = Database['public']['Tables']['templates']['Row'];

// Fetch templates from API
const fetchTemplates = async (): Promise<TemplateRow[]> => {
  const res = await fetch('/api/templates');
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
};

// Platform icons mapping
const platformIcons: Record<string, React.ReactNode> = {
  Instagram: <InstagramIcon sx={{ color: '#E1306C' }} />,
  Facebook: <FacebookIcon sx={{ color: '#1877F2' }} />,
  Twitter: <TwitterIcon sx={{ color: '#1DA1F2' }} />,
  YouTube: <YouTubeIcon sx={{ color: '#FF0000' }} />,
  LinkedIn: <LinkedInIcon sx={{ color: '#0A66C2' }} />,
  Pinterest: <PinterestIcon sx={{ color: '#E60023' }} />,
  TikTok: <TikTokIcon sx={{ color: '#000000' }} />, // Using TikTokIcon
};

// Template card component
const TemplateCard: React.FC<{
  template: TemplateRow;
  onEdit: (template: TemplateRow) => void;
  onDelete: (templateId: string) => void;
  onDuplicate: (template: TemplateRow) => void;
  onCreateMatrix: (templateId: string) => void;
}> = ({ template, onEdit, onDelete, onDuplicate, onCreateMatrix }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          height: 180,
          bgcolor: 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {platformIcons[template.platform] || (
          <AspectRatioIcon sx={{ fontSize: 48, color: 'grey.400' }} />
        )}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <IconButton
            aria-label="more"
            id={`template-menu-${template.id}`}
            aria-controls={open ? `template-menu-${template.id}` : undefined}
            aria-expanded={open ? 'true' : undefined}
            aria-haspopup="true"
            onClick={handleClick}
            size="small"
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            id={`template-menu-${template.id}`}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{
              'aria-labelledby': `template-menu-${template.id}`,
            }}
          >
            <MenuItem
              onClick={() => {
                handleClose();
                onEdit(template);
              }}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleClose();
                onDuplicate(template);
              }}
            >
              <ListItemIcon>
                <ContentCopyIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Duplicate</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleClose();
                onDelete(template.id);
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="div" gutterBottom noWrap>
          {template.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Chip
            size="small"
            icon={platformIcons[template.platform] as React.ReactElement}
            label={template.platform}
          />
          <Chip size="small" icon={<AspectRatioIcon />} label={template.aspect_ratio} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {template.description}
        </Typography>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              onClick={() => onCreateMatrix(template.id)}
              sx={{
                mb: 1,
                fontWeight: 'bold',
                py: 1,
              }}
            >
              SELECT
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button variant="outlined" fullWidth onClick={() => onCreateMatrix(template.id)}>
              Use Template
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                // Use window.open for client-side navigation to a new tab
                window.open(`/preview?templateId=${template.id}`, '_blank');
              }}
            >
              Preview
            </Button>
          </Grid>
        </Grid>
      </CardContent>
      <Box sx={{ p: 2, pt: 0 }}>
        <Typography variant="caption" color="text.secondary">
          Last modified: {template.updated_at ?? ''}
        </Typography>
      </Box>
    </Card>
  );
};

const TemplatesNew: React.FC = () => {
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });

  // Example filter state (you may already have these)
  const [platformFilter, setPlatformFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<TemplateRow | null>(null);

  // Filtering logic
  const filteredTemplates = (templates ?? []).filter((template: TemplateRow) => {
    // Platform filter
    if (platformFilter !== 'All' && template.platform !== platformFilter) return false;
    // Search filter
    if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    // Add more filters as needed
    return true;
  });

  const handlePlatformFilterChange = (e: SelectChangeEvent) => {
    setPlatformFilter(e.target.value as string);
  };

  const handleAddTemplate = () => {
    setCurrentTemplate(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentTemplate(null);
  };

  const handleDuplicateTemplate = (template: TemplateRow) => {
    // Implement duplication logic using API if needed
    // For now, just log
    console.log('Duplicate template', template);
  };

  const handleEditTemplate = (template: TemplateRow) => {
    // Implement edit logic
    console.log('Edit template', template);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    // Implement delete logic using API
    console.log('Delete template', templateId);
  };

  const handleCreateMatrix = (templateId: string) => {
    // Implement navigation logic
    console.log('Create matrix for', templateId);
  };

  if (isLoading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <Typography color="error">Failed to load templates</Typography>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Templates | AIrWAVE</title>
      </Head>
      <DashboardLayout title="Templates">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
            Templates
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage templates for different platforms and formats
          </Typography>
        </Box>
        {/* Filters and Actions */}
        <Paper sx={{ p: 2, mb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search templates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="platform-filter-label">Platform</InputLabel>
                <Select
                  labelId="platform-filter-label"
                  id="platform-filter"
                  value={platformFilter}
                  label="Platform"
                  onChange={handlePlatformFilterChange}
                >
                  <MenuItem value="All">All Platforms</MenuItem>
                  <MenuItem value="Instagram">Instagram</MenuItem>
                  <MenuItem value="Facebook">Facebook</MenuItem>
                  <MenuItem value="Twitter">Twitter</MenuItem>
                  <MenuItem value="YouTube">YouTube</MenuItem>
                  <MenuItem value="LinkedIn">LinkedIn</MenuItem>
                  <MenuItem value="Pinterest">Pinterest</MenuItem>
                  <MenuItem value="TikTok">TikTok</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid
              item
              xs={12}
              md={5}
              sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}
            >
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddTemplate}>
                Create Template
              </Button>
            </Grid>
          </Grid>
        </Paper>
        {/* Templates Grid */}
        <Grid container spacing={3}>
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((template: TemplateRow) => (
              <Grid item key={template.id} xs={12} sm={6} md={4}>
                <TemplateCard
                  template={template}
                  onEdit={handleEditTemplate}
                  onDelete={handleDeleteTemplate}
                  onDuplicate={handleDuplicateTemplate}
                  onCreateMatrix={handleCreateMatrix}
                />
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Typography variant="body1" color="text.secondary" align="center">
                No templates found
              </Typography>
            </Grid>
          )}
        </Grid>

        {/* Create/Edit Template Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{currentTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <TextField
                margin="dense"
                id="name"
                label="Template Name"
                type="text"
                fullWidth
                variant="outlined"
                defaultValue={currentTemplate?.name || ''}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                <InputLabel id="platform-label">Platform</InputLabel>
                <Select
                  labelId="platform-label"
                  id="platform"
                  defaultValue={currentTemplate?.platform || 'Instagram'}
                  label="Platform"
                >
                  <MenuItem value="Instagram">Instagram</MenuItem>
                  <MenuItem value="Facebook">Facebook</MenuItem>
                  <MenuItem value="Twitter">Twitter</MenuItem>
                  <MenuItem value="YouTube">YouTube</MenuItem>
                  <MenuItem value="LinkedIn">LinkedIn</MenuItem>
                  <MenuItem value="Pinterest">Pinterest</MenuItem>
                  <MenuItem value="TikTok">TikTok</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                <InputLabel id="aspect-ratio-label">Aspect Ratio</InputLabel>
                <Select
                  labelId="aspect-ratio-label"
                  id="aspect-ratio"
                  defaultValue={currentTemplate?.aspect_ratio || '1:1'}
                  label="Aspect Ratio"
                >
                  <MenuItem value="1:1">1:1 (Square)</MenuItem>
                  <MenuItem value="4:5">4:5 (Instagram Portrait)</MenuItem>
                  <MenuItem value="16:9">16:9 (Landscape)</MenuItem>
                  <MenuItem value="9:16">9:16 (Vertical)</MenuItem>
                  <MenuItem value="2:3">2:3 (Pinterest)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                margin="dense"
                id="description"
                label="Description"
                type="text"
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                defaultValue={currentTemplate?.description || ''}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button variant="contained">{currentTemplate ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </>
  );
};

export default TemplatesNew;
