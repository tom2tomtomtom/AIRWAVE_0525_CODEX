import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Box, Container } from '@mui/material';
import {
  Edit,
  TrendingUp,
  Facebook,
  Instagram,
  Twitter,
  YouTube,
  LinkedIn,
  CheckCircle,
  Warning,
  Error} from '@mui/icons-material';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { useCampaign } from '../../hooks/useData';
import { useNotification } from '../../contexts/NotificationContext';
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`campaign-tabpanel-${index}`}
      aria-labelledby={`campaign-tab-${index}`}
      {...other}
    >
      {' '}
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}{' '}
    </div>
  );
}
const platformIcons: Record<string, React.ReactElement> = {
  facebook: <Facebook />,
  instagram: <Instagram />,
  twitter: <Twitter />,
  youtube: <YouTube />,
  linkedin: <LinkedIn /> };
const statusColors: Record<
  string,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  draft: 'default',
  active: 'primary',
  paused: 'warning',
  completed: 'success',
  cancelled: 'error' };
const statusIcons: Record<string, React.ReactElement> = {
  draft: <Edit fontSize="small" />,
  active: <TrendingUp fontSize="small" />,
  paused: <Warning fontSize="small" />,
  completed: <CheckCircle fontSize="small" />,
  cancelled: <Error fontSize="small" /> };
export default function CampaignDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { showNotification } = useNotification();
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { data: campaign, isLoading: loading, error } = useCampaign(id as string);
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleEdit = () => {
    router.push(`/campaigns/${id}/edit`);
  };
  const handleDuplicate = () => {
    showNotification('Campaign duplicated successfully', 'success');
    handleMenuClose();
  };
  const handleArchive = () => {
    showNotification('Campaign archived', 'info');
    handleMenuClose();
  };
  if (loading) {
    return (
      <DashboardLayout>
        {' '}
        <Container maxWidth="lg">
          {' '}
          <LoadingSpinner />{' '}
        </Container>{' '}
      </DashboardLayout>
    );
  }
  if (error || !campaign) {
    return (
      <DashboardLayout>
        {' '}
        <Container maxWidth="lg">
          {' '}
          <ErrorMessage message="Failed to load campaign details. Please try again." />{' '}
        </Container>{' '}
      </DashboardLayout>
    );
  } // Type guard to ensure campaign is a single object if (Array.isArray(campaign)) { return ( <DashboardLayout> <Container maxWidth="lg"> <Alert severity="error">Invalid campaign data format</Alert> </Container> </DashboardLayout> ); } const campaignData = campaign as Campaign; // Calculate budget values let budgetTotal = 0; let budgetSpent = 0; if (campaignData.budget) { if (typeof campaignData.budget === 'object' && 'total' in campaignData.budget) { budgetTotal = campaignData.budget?.total; budgetSpent = campaignData.budget.spent || 0; } else if (typeof campaignData.budget === 'number') { budgetTotal = campaignData.budget; budgetSpent = budgetTotal * 0.65; // Mock spent amount } } const budgetPercentage = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0; return ( <DashboardLayout> <Container maxWidth="lg"> <Box sx={{ mb: 4 }}> <Button startIcon={<ArrowBack />} onClick={() => router.push('/campaigns')} sx={{ mb: 2 }} > Back to Campaigns </Button> <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}> <Box> <Typography variant="h4" component="h1" gutterBottom> {campaignData.name} </Typography> <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}> <Chip {...(statusIcons[campaignData.status] && { icon: statusIcons[campaignData.status] })} label={campaignData.status.charAt(0).toUpperCase() + campaignData.status.slice(1)} color={statusColors[campaignData.status] || 'default'} size="small" /> <Typography variant="body2" color="text.secondary"> Created {format(new Date(campaignData.dateCreated), 'MMM d, yyyy')} </Typography> </Box> </Box> <Box> <Button variant="contained" startIcon={<Edit />} onClick={handleEdit} sx={{ mr: 1 }} > Edit Campaign </Button> <IconButton onClick={handleMenuOpen}> <MoreVert /> </IconButton> <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} > <MenuItem onClick={handleDuplicate}>Duplicate</MenuItem> <MenuItem onClick={handleArchive}>Archive</MenuItem> </Menu> </Box> </Box> </Box> <Grid container spacing={3}> <Grid md={8} xs={12} md={8}> <Paper> <Tabs value={tabValue} onChange={handleTabChange} aria-label="campaign tabs"> <Tab label="Overview" /> <Tab label="Assets" /> <Tab label="Performance" /> <Tab label="Settings" /> </Tabs> <TabPanel value={tabValue} index={0}> <Grid container spacing={3}> <Grid xs={12}> <Typography variant="h6" gutterBottom> Campaign Details </Typography> <Typography variant="body1" paragraph> {campaignData.description || 'No description provided.'} </Typography> </Grid> <Grid xs={12}> <Typography variant="h6" gutterBottom> Target Platforms </Typography> <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}> {campaignData.targeting?.platforms?.map((platform: string) => ( <Chip key={platform} {...(platformIcons[platform.toLowerCase()] && { icon: platformIcons[platform.toLowerCase()] })} label={platform} variant="outlined" /> ))} </Box> </Grid> <Grid xs={12}> <Typography variant="h6" gutterBottom> Recent Activity </Typography> <List> <ListItem> <ListItemAvatar> <Avatar sx={{ bgcolor: 'primary.main' }}> <Edit /> </Avatar> </ListItemAvatar> <ListItemText primary="Campaign updated" secondary="2 hours ago" /> </ListItem> <ListItem> <ListItemAvatar> <Avatar sx={{ bgcolor: 'success.main' }}> <CheckCircle /> </Avatar> </ListItemAvatar> <ListItemText primary="Assets approved" secondary="1 day ago" /> </ListItem> </List> </Grid> </Grid> </TabPanel> <TabPanel value={tabValue} index={1}> <Typography variant="h6" gutterBottom> Campaign Assets </Typography> <Typography variant="body2" color="text.secondary"> Asset management coming soon... </Typography> </TabPanel> <TabPanel value={tabValue} index={2}> <Typography variant="h6" gutterBottom> Performance Metrics </Typography> <Typography variant="body2" color="text.secondary"> Analytics integration coming soon... </Typography> </TabPanel> <TabPanel value={tabValue} index={3}> <Typography variant="h6" gutterBottom> Campaign Settings </Typography> <Typography variant="body2" color="text.secondary"> Settings configuration coming soon... </Typography> </TabPanel> </Paper> </Grid> <Grid md={4} xs={12} md={4}> <Grid container spacing={3}> <Grid size={{ xs: 12 }}> <Card> <CardContent> <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}> <Schedule sx={{ mr: 1, color: 'text.secondary' }} /> <Typography variant="h6">Timeline</Typography> </Box> <Typography variant="body2" color="text.secondary" gutterBottom> Start Date </Typography> <Typography variant="body1" gutterBottom> {campaignData.schedule?.startDate ? format(new Date(campaignData.schedule.startDate), 'MMMM d, yyyy') : 'Not set'} </Typography> <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}> End Date </Typography> <Typography variant="body1"> {campaignData.schedule?.endDate ? format(new Date(campaignData.schedule.endDate), 'MMMM d, yyyy') : 'Not set'} </Typography> </CardContent> </Card> </Grid> <Grid size={{ xs: 12 }}> <Card> <CardContent> <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}> <AttachMoney sx={{ mr: 1, color: 'text.secondary' }} /> <Typography variant="h6">Budget</Typography> </Box> <Typography variant="h4" gutterBottom> ${budgetTotal.toLocaleString()} </Typography> <Box sx={{ mb: 1 }}> <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}> <Typography variant="body2" color="text.secondary"> Spent </Typography> <Typography variant="body2"> ${budgetSpent.toLocaleString()} </Typography> </Box> <LinearProgress variant="determinate" value={budgetPercentage} sx={{ height: 8, borderRadius: 4 }} /> </Box> <Typography variant="body2" color="text.secondary"> {budgetPercentage.toFixed(0)}% of budget used </Typography> </CardContent> </Card> </Grid> <Grid size={{ xs: 12 }}> <Card> <CardContent> <Typography variant="h6" gutterBottom> Quick Stats </Typography> <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}> <Box> <Typography variant="body2" color="text.secondary"> Impressions </Typography> <Typography variant="h6">1.2M</Typography> </Box> <Box> <Typography variant="body2" color="text.secondary"> Clicks </Typography> <Typography variant="h6">45.3K</Typography> </Box> <Box> <Typography variant="body2" color="text.secondary"> CTR </Typography> <Typography variant="h6">3.8%</Typography> </Box> </Box> </CardContent> </Card> </Grid> </Grid> </Grid> </Grid> </Container> </DashboardLayout> ); } export const getServerSideProps: GetServerSideProps = async () => {
  // In a real app, you might fetch the campaign data here
  // For now, we'll rely on client-side data fetching
  return {
    props: {}
  };
}
