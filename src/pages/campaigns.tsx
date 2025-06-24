import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Stack,
  Grid} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Campaign as CampaignIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as BudgetIcon,
  TrendingUp as TrendingIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Archive as ArchiveIcon} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorMessage from '@/components/ErrorMessage';
import { CardSkeleton } from '@/components/SkeletonLoaders';
import { AnimatedActionButton } from '@/components/AnimatedComponents';
import ClientSelector from '@/components/ClientSelector';
import { useCampaigns } from '@/hooks/useData';
import { useClient } from '@/contexts/ClientContext';
import { format } from 'date-fns';

const CampaignsPage: React.FC = () => {
  const router = useRouter();
  const { activeClient } = useClient();
  const { data: campaigns, isLoading, error, refetch } = useCampaigns(activeClient?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, campaign: any) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedCampaign(campaign);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCreateCampaign = () => {
    router.push('/campaigns/new');
  };

  const handleViewCampaign = (campaignId: string) => {
    router.push(`/campaigns/${campaignId}`);
  };

  const handleEditCampaign = (campaignId: string) => {
    router.push(`/campaigns/${campaignId}/edit`);
    handleMenuClose();
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'info';
      case 'draft':
        return 'default';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayIcon sx={{ fontSize: 16 }} />;
      case 'paused':
        return <PauseIcon sx={{ fontSize: 16 }} />;
      case 'archived':
        return <ArchiveIcon sx={{ fontSize: 16 }} />;
      default:
        return <></>;
    }
  };

  const filteredCampaigns =
    campaigns?.filter(
      (campaign: any) =>
        campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.objective?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  return (
    <DashboardLayout>
      <Head>
        <title>Campaigns | AIRFLOW</title>
      </Head>
      <Container maxWidth="lg">
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Campaigns
              </Typography>
              <ClientSelector variant="compact" />
            </Box>
            <AnimatedActionButton onClick={handleCreateCampaign} loading={false}>
              <AddIcon sx={{ mr: 1 }} />
              Create Campaign
            </AnimatedActionButton>
          </Box>
          <TextField
            fullWidth
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )}}
          />
        </Box>

        {!activeClient && (
          <Box textAlign="center" py={8}>
            <CampaignIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select a client to view campaigns
            </Typography>
            <ClientSelector variant="button" />
          </Box>
        )}

        {activeClient && isLoading && (
          <Grid container spacing={3}>
            {[1, 2, 3].map((i: any) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <CardSkeleton height={300} />
              </Grid>
            ))}
          </Grid>
        )}

        {activeClient && error && (
          <ErrorMessage title="Failed to load campaigns" error={error} onRetry={refetch} />
        )}

        {activeClient && !isLoading && !error && filteredCampaigns.length === 0 && (
          <Box textAlign="center" py={8}>
            <CampaignIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchTerm ? 'No campaigns found' : 'No campaigns yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {searchTerm
                ? 'Try adjusting your search criteria'
                : 'Create your first campaign to get started'}
            </Typography>
            {!searchTerm && (
              <Box sx={{ mt: 2 }}>
                <AnimatedActionButton onClick={handleCreateCampaign} loading={false}>
                  <AddIcon sx={{ mr: 1 }} />
                  Create First Campaign
                </AnimatedActionButton>
              </Box>
            )}
          </Box>
        )}

        {activeClient && (
          <Grid container spacing={3}>
            {filteredCampaigns.map((campaign: any) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={campaign.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3 }}}
                  onClick={() => handleViewCampaign(campaign.id)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      mb={2}
                    >
                      <Typography variant="h6" component="h2" gutterBottom>
                        {campaign.name}
                      </Typography>
                      <IconButton size="small" onClick={e => handleMenuOpen(e, campaign)}>
                        <MoreIcon />
                      </IconButton>
                    </Box>
                    <Stack direction="row" spacing={1} mb={2}>
                      <Chip
                        label={campaign.status}
                        size="small"
                        color={getStatusColor(campaign.status)}
                        icon={getStatusIcon(campaign.status)}
                      />
                      {campaign.targeting?.platforms?.map((platform: string) => (
                        <Chip key={platform} label={platform} size="small" variant="outlined" />
                      ))}
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      paragraph
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' }}
                    >
                      {campaign.description || campaign.objective}
                    </Typography>
                    {campaign.schedule && (
                      <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                        <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(campaign.schedule.startDate), 'MMM d, yyyy')}
                          {campaign.schedule.endDate &&
                            ` - ${format(new Date(campaign.schedule.endDate), 'MMM d, yyyy')}`}
                        </Typography>
                      </Box>
                    )}
                    {campaign.budget && (
                      <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                        <BudgetIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          ${campaign.budget.spent.toLocaleString()} / $
                          {campaign.budget.total.toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                    {campaign.budget && (
                      <Box mt={2}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            Budget Used
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {Math.round((campaign.budget.spent / campaign.budget.total) * 100)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(campaign.budget.spent / campaign.budget.total) * 100}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<TrendingIcon />}>
                      View Performance
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Actions Menu */}
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={() => selectedCampaign && handleEditCampaign(selectedCampaign.id)}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => {
              console.log('Archive campaign:', selectedCampaign);
              handleMenuClose();
            }}
          >
            <ArchiveIcon fontSize="small" sx={{ mr: 1 }} />
            Archive
          </MenuItem>
          <MenuItem
            onClick={() => {
              console.log('Delete campaign:', selectedCampaign);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>
      </Container>
    </DashboardLayout>
  );
};

export default CampaignsPage;
