import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  CircularProgress,
  Avatar,
  IconButton,
  Menu,
  MenuItem as MuiMenuItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Chip,
  Divider,
  Tabs,
  Tab,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  ExpandMore as ExpandMoreIcon,
  Psychology as AIIcon,
  Lightbulb as IdeaIcon,
  Campaign as CampaignIcon,
  Insights as InsightsIcon,
  Description as DocumentIcon,
  SmartToy as BotIcon,
  AutoAwesome as MagicIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import DashboardLayout from '@/components/DashboardLayout';

// Mock data for strategic content
const mockStrategicContent = [
  {
    id: 'sc1',
    title: 'Summer Campaign Ideas',
    type: 'campaign',
    description: 'AI-generated campaign ideas for summer product launch',
    dateCreated: '2023-05-01',
    lastModified: '2023-05-10',
    content: [
      {
        id: 'idea1',
        title: 'Beach Lifestyle Series',
        description: 'Create a series of posts showcasing products in beach settings, emphasizing relaxation and summer fun.',
        details: 'Focus on bright, sunny imagery with vibrant colors. Include user testimonials about how products enhance summer experiences. Create a branded hashtag for user-generated content.',
      },
      {
        id: 'idea2',
        title: 'Summer Essentials Guide',
        description: 'Develop a comprehensive guide featuring products as must-have summer essentials.',
        details: 'Structure as a downloadable PDF or swipeable carousel. Include practical tips for summer activities that incorporate products. Partner with complementary brands for cross-promotion.',
      },
      {
        id: 'idea3',
        title: 'Limited Edition Summer Collection',
        description: 'Launch a limited-time summer-themed product collection with special packaging.',
        details: 'Create urgency with countdown timers. Design special summer packaging with tropical or beach themes. Offer bundle discounts for multiple summer collection items.',
      },
    ],
  },
  {
    id: 'sc2',
    title: 'Target Audience Analysis',
    type: 'analysis',
    description: 'Detailed analysis of primary and secondary target audiences',
    dateCreated: '2023-04-15',
    lastModified: '2023-05-05',
    content: [
      {
        id: 'segment1',
        title: 'Urban Professionals (25-34)',
        description: 'Career-focused individuals in metropolitan areas with disposable income.',
        details: 'Values convenience, quality, and status. Highly active on Instagram and LinkedIn. Shopping behavior primarily mobile-first with preference for premium brands. Responds well to lifestyle content that showcases integration of products into busy professional life.',
      },
      {
        id: 'segment2',
        title: 'Conscious Consumers (30-45)',
        description: 'Environmentally and socially conscious buyers who prioritize sustainability.',
        details: 'Values transparency, ethical production, and eco-friendly practices. Active on Pinterest and Instagram. Willing to pay premium for sustainable products. Responds to detailed content about sourcing, manufacturing processes, and company values.',
      },
    ],
  },
  {
    id: 'sc3',
    title: 'Content Pillars Framework',
    type: 'framework',
    description: 'Strategic content pillars for consistent brand messaging',
    dateCreated: '2023-04-10',
    lastModified: '2023-04-28',
    content: [
      {
        id: 'pillar1',
        title: 'Product Education',
        description: 'Content that explains features, benefits, and use cases.',
        details: 'Tutorial videos, how-to guides, feature spotlights, comparison content, FAQ content, product demos, and technical specifications.',
      },
      {
        id: 'pillar2',
        title: 'Brand Storytelling',
        description: 'Content that communicates brand values and mission.',
        details: 'Origin stories, behind-the-scenes content, team spotlights, customer testimonials, impact stories, and vision/mission content.',
      },
      {
        id: 'pillar3',
        title: 'Lifestyle Integration',
        description: 'Content showing how products enhance customer lifestyles.',
        details: 'Day-in-the-life content, seasonal usage scenarios, user-generated content, influencer partnerships, and aspirational lifestyle imagery.',
      },
      {
        id: 'pillar4',
        title: 'Industry Authority',
        description: 'Content establishing expertise in the industry.',
        details: 'Trend analysis, research reports, expert interviews, thought leadership articles, industry news commentary, and educational webinars.',
      },
    ],
  },
];

// Content type icons mapping
const contentTypeIcons: Record<string, React.ReactNode> = {
  campaign: <CampaignIcon sx={{ color: '#3a86ff' }} />,
  analysis: <InsightsIcon sx={{ color: '#8338ec' }} />,
  framework: <DocumentIcon sx={{ color: '#06d6a0' }} />,
  ideas: <IdeaIcon sx={{ color: '#ffbe0b' }} />,
};

// Interface for strategic content data
interface ContentItem {
  id: string;
  title: string;
  description: string;
  details: string;
}

interface StrategicContentItem {
  id: string;
  title: string;
  type: string;
  description: string;
  dateCreated: string;
  lastModified: string;
  content: ContentItem[];
}

// Strategic content card component
const StrategicContentCard: React.FC<{
  item: StrategicContentItem;
  onEdit: (item: StrategicContentItem) => void;
  onDelete: (itemId: string) => void;
  onDuplicate: (item: StrategicContentItem) => void;
}> = ({ item, onEdit, onDelete, onDuplicate }) => {
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
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'primary.light', mr: 1 }}>
              {contentTypeIcons[item.type] || <AIIcon />}
            </Avatar>
            <Typography variant="h6" component="div">
              {item.title}
            </Typography>
          </Box>
          <IconButton
            aria-label="more"
            id={`content-menu-${item.id}`}
            aria-controls={open ? `content-menu-${item.id}` : undefined}
            aria-expanded={open ? 'true' : undefined}
            aria-haspopup="true"
            onClick={handleClick}
            size="small"
          >
            <MoreIcon />
          </IconButton>
          <Menu
            id={`content-menu-${item.id}`}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{
              'aria-labelledby': `content-menu-${item.id}`,
            }}
          >
            <MenuItem onClick={() => { handleClose(); onEdit(item); }}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleClose(); onDuplicate(item); }}>
              <ListItemIcon>
                <DuplicateIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Duplicate</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleClose(); onDelete(item.id); }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {item.description}
        </Typography>
        <Chip
          size="small"
          label={item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          sx={{ mb: 2 }}
        />
        <Typography variant="caption" display="block" color="text.secondary">
          {item.content.length} items • Last modified: {item.lastModified ?? ''}
        </Typography>
      </CardContent>
      <Box sx={{ p: 2, pt: 0 }}>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={() => onEdit(item)}
        >
          View Content
        </Button>
      </Box>
    </Card>
  );
};

const StrategicContent: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { activeClient, loading: clientLoading } = useClient();
  const [strategicContent, setStrategicContent] = useState<StrategicContentItem[]>(mockStrategicContent);
  const [filteredContent, setFilteredContent] = useState<StrategicContentItem[]>(mockStrategicContent);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [openDialog, setOpenDialog] = useState(false);
  const [currentContent, setCurrentContent] = useState<StrategicContentItem | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [generating, setGenerating] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Redirect to client creation if authenticated but no active client
  useEffect(() => {
    if (!clientLoading && isAuthenticated && !activeClient) {
      router.push('/create-client?first=true');
    }
  }, [activeClient, clientLoading, isAuthenticated, router]);

  // Filter content based on search query and type filter
  useEffect(() => {
    let filtered = strategicContent;

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== 'All') {
      filtered = filtered.filter(item => item.type === typeFilter.toLowerCase());
    }

    setFilteredContent(filtered);
  }, [searchQuery, typeFilter, strategicContent]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleTypeFilterChange = (event: SelectChangeEvent) => {
    setTypeFilter(event.target.value);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAddContent = () => {
    setCurrentContent(null);
    setOpenDialog(true);
  };

  const handleEditContent = (item: StrategicContentItem) => {
    setCurrentContent(item);
    setOpenDialog(true);
  };

  const handleDeleteContent = (itemId: string) => {
    setStrategicContent(strategicContent.filter(item => item.id !== itemId));
  };

  const handleDuplicateContent = (item: StrategicContentItem) => {
    const newItem = {
      ...item,
      id: `sc${Date.now()}`,
      title: `${item.title} (Copy)`,
      dateCreated: item.dateCreated ?? '',
      lastModified: item.lastModified ?? '',
    };
    setStrategicContent([...strategicContent, newItem]);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentContent(null);
  };

  const handleGenerateContent = () => {
    setGenerating(true);
    // Simulate AI content generation
    setTimeout(() => {
      setGenerating(false);
      // Add new generated content
      const timestamp = Date.now();
      const newContent = {
        id: `sc${timestamp}`,
        title: "AI-Generated Content Strategy",
        type: "framework",
        description: "Automatically generated content strategy based on your brand profile",
        dateCreated: new Date().toISOString().split("T")[0],
        lastModified: new Date().toISOString().split("T")[0],
        content: [
          {
            id: `idea${timestamp}-1`,
            title: "Authentic Storytelling",
            description: "Focus on authentic brand narratives that connect emotionally with your audience.",
            details: "Develop a series of behind-the-scenes content showing your team and processes. Share customer success stories with permission. Create a founders corner for personal insights from leadership."
          },
          {
            id: `idea${timestamp}-2`,
            title: "Educational Content Series",
            description: "Establish authority through educational content that solves audience problems.",
            details: "Create a weekly how-to series addressing common pain points. Develop downloadable guides for complex topics. Host expert interviews or webinars on industry trends."
          },
          {
            id: `idea${timestamp}-3`,
            title: "User-Generated Content Campaign",
            description: "Leverage customer content to build community and showcase real-world usage.",
            details: "Create a branded hashtag for customers to share experiences. Feature customer content weekly with permission. Develop a rewards program for outstanding user content."
          }
        ]
      };
      setStrategicContent([newContent, ...strategicContent]);
    }, 3000);
  };

  if (authLoading || clientLoading || !activeClient) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Strategic Content | AIrWAVE</title>
      </Head>
      <DashboardLayout title="Strategic Content">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
            Strategic Content
          </Typography>
          <Typography variant="body1" color="text.secondary">
            AI-powered strategic content planning and generation
          </Typography>
        </Box>

        {/* AI Generation Card */}
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BotIcon sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  AI Content Generator
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Let our AI analyze your brand profile and generate strategic content recommendations tailored to your audience and goals.
              </Typography>
              {generating && (
                <Box sx={{ width: '100%', mb: 2 }}>
                  <LinearProgress color="inherit" />
                </Box>
              )}
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={generating ? <RefreshIcon /> : <MagicIcon />}
                onClick={handleGenerateContent}
                disabled={generating}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'grey.100',
                  }
                }}
              >
                {generating ? 'Generating...' : 'Generate Content Strategy'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Filters and Actions */}
        <Paper sx={{ p: 2, mb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search strategic content..."
                value={searchQuery}
                onChange={handleSearchChange}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="type-filter-label">Content Type</InputLabel>
                <Select
                  labelId="type-filter-label"
                  id="type-filter"
                  value={typeFilter}
                  label="Content Type"
                  onChange={handleTypeFilterChange}
                >
                  <MenuItem value="All">All Types</MenuItem>
                  <MenuItem value="Campaign">Campaign</MenuItem>
                  <MenuItem value="Analysis">Analysis</MenuItem>
                  <MenuItem value="Framework">Framework</MenuItem>
                  <MenuItem value="Ideas">Ideas</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddContent}
              >
                Create Strategic Content
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="content tabs">
            <Tab label="All Content" />
            <Tab label="Campaigns" />
            <Tab label="Frameworks" />
            <Tab label="Analysis" />
          </Tabs>
        </Box>

        {/* Content Grid */}
        <Grid container spacing={3}>
          {filteredContent.length > 0 ? (
            filteredContent.map((item) => (
              <Grid item key={item.id} xs={12} sm={6} md={4}>
                <StrategicContentCard
                  item={item}
                  onEdit={handleEditContent}
                  onDelete={handleDeleteContent}
                  onDuplicate={handleDuplicateContent}
                />
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No strategic content found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery || typeFilter !== 'All'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first strategic content or use the AI generator to get started'}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddContent}
                  sx={{ mt: 2, mr: 1 }}
                >
                  Create Manually
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MagicIcon />}
                  onClick={handleGenerateContent}
                  disabled={generating}
                  sx={{ mt: 2 }}
                >
                  Generate with AI
                </Button>
              </Paper>
            </Grid>
          )}
        </Grid>

        {/* Content Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {currentContent ? currentContent.title : 'Create New Strategic Content'}
          </DialogTitle>
          <DialogContent>
            {currentContent ? (
              <Box sx={{ pt: 1 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {currentContent.description}
                </Typography>
                <Divider sx={{ my: 2 }} />
                {currentContent.content.map((item) => (
                  <Accordion key={item.id} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1">{item.title}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" paragraph>
                        {item.description}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.details}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            ) : (
              <Box sx={{ pt: 1 }}>
                <TextField
                  autoFocus
                  margin="dense"
                  id="title"
                  label="Content Title"
                  type="text"
                  fullWidth
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                  <InputLabel id="content-type-label">Content Type</InputLabel>
                  <Select
                    labelId="content-type-label"
                    id="content-type"
                    defaultValue="campaign"
                    label="Content Type"
                  >
                    <MenuItem value="campaign">Campaign</MenuItem>
                    <MenuItem value="analysis">Analysis</MenuItem>
                    <MenuItem value="framework">Framework</MenuItem>
                    <MenuItem value="ideas">Ideas</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  margin="dense"
                  id="description"
                  label="Description"
                  type="text"
                  fullWidth
                  multiline
                  rows={2}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Content Items
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2">Item 1</Typography>
                  <TextField
                    margin="dense"
                    label="Title"
                    type="text"
                    fullWidth
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    margin="dense"
                    label="Description"
                    type="text"
                    fullWidth
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    margin="dense"
                    label="Details"
                    type="text"
                    fullWidth
                    multiline
                    rows={2}
                    variant="outlined"
                    size="small"
                  />
                </Paper>
                <Button
                  startIcon={<AddIcon />}
                  variant="outlined"
                  size="small"
                >
                  Add Item
                </Button>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>
              {currentContent ? 'Close' : 'Cancel'}
            </Button>
            {!currentContent && (
              <Button variant="contained" onClick={handleCloseDialog}>
                Create Content
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </>
  );
};

export default StrategicContent;
