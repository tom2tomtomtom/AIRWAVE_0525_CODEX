import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Stack} from '@mui/material';
import {
  Visibility as PreviewIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  Comment as CommentIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  FullscreenExit as ExitFullscreenIcon,
  Fullscreen as FullscreenIcon} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import ApprovalWorkflow from '@/components/ApprovalWorkflow';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';

interface PreviewItem {
  id: string;
  type: 'motivation' | 'content_variation' | 'execution' | 'campaign' | 'video' | 'copy_asset';
  title: string;
  content: any;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'published';
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  client: {
    id: string;
    name: string;
    logo?: string;
  };
  approval_status?: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  metadata?: any;
}

interface ApprovalDecision {
  action: 'approve' | 'reject' | 'request_changes';
  comments: string;
  changes_requested?: Array<{
    field: string;
    reason: string;
  }>;
}

const PreviewPage: React.FC = () => {
  const router = useRouter();
  const { activeClient } = useClient();
  const { showNotification } = useNotification();

  // URL parameters
  const { item_id, item_type } = router.query;

  // State management
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision>({
    action: 'approve',
    comments: '',
    changes_requested: []});
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Fetch preview item
  const fetchPreviewItem = async () => {
    if (!item_id || !item_type) return;

    setLoading(true);
    setError(null);

    try {
      // Determine the API endpoint based on item type
      const apiEndpoints: Record<string, string> = {
        motivation: `/api/motivations/${item_id}`,
        content_variation: `/api/copy-assets/${item_id}`,
        execution: `/api/executions/${item_id}`,
        campaign: `/api/campaigns/${item_id}`,
        video: `/api/video/generations/${item_id}`,
        copy_asset: `/api/copy-assets/${item_id}`};

      const endpoint = apiEndpoints[item_type as string];
      if (!endpoint) {
        throw new Error(`Unsupported item type: ${item_type}`);
      }

      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.success || result.data) {
        const data = result.data || result;

        // Transform the data into our PreviewItem format
        const transformedItem: PreviewItem = {
          id: data.id,
          type: item_type as PreviewItem['type'],
          title: data.title || data.name || `${item_type} ${data.id}`,
          content: data,
          status: data.status || 'draft',
          created_at: data.created_at,
          updated_at: data.updated_at,
          created_by: {
            id: data.created_by || data.user_id || 'unknown',
            name: data.profiles?.full_name || data.creator?.name || 'Unknown User',
            avatar_url: data.profiles?.avatar_url || data.creator?.avatar_url },
          client: {
            id: data.client_id || activeClient?.id || 'unknown',
            name: data.clients?.name || activeClient?.name || 'Unknown Client',
            logo: data.clients?.logo || activeClient?.logo },
          metadata: data.metadata || {} };

        setPreviewItem(transformedItem);
      } else {
        throw new Error(result.error || 'Failed to fetch preview item');
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load preview item');
    } finally {
      setLoading(false);
    }
  };

  // Handle approval decision
  const handleApprovalSubmit = async () => {
    if (!previewItem) return;

    setSubmittingApproval(true);
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
      
      },
        body: JSON.stringify({
          item_type: previewItem.type,
          item_id: previewItem.id,
          approval_type: 'content',
          priority: 'normal',
          notes: approvalDecision.comments,
          metadata: {
        decision: approvalDecision.action,
            changes_requested: approvalDecision.changes_requested
      }})});

      const result = await response.json();

      if (result.success || result.data) {
        showNotification(`Approval ${approvalDecision.action} submitted successfully`, 'success');
        setApprovalDialogOpen(false);
        fetchPreviewItem(); // Refresh the item
      } else {
        throw new Error(result.error || 'Failed to submit approval');
      }
    } catch (err: any) {
      showNotification('Failed to submit approval decision', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Load preview item on mount or when parameters change
  useEffect(() => {
    fetchPreviewItem();
  }, [item_id, item_type]);

  // Render content based on item type
  const renderPreviewContent = () => {
    if (!previewItem) return null;

    const { content, type } = previewItem;

    switch (type) {
      case 'motivation':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {content.title}
              </Typography>
              <Typography variant="body1" paragraph>
                {content.description}
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <Chip label={content.category} size="small" />
                <Chip label={`Score: ${content.relevance_score}/10`} size="small" variant="outlined" />
              </Box>
              {content.target_emotions && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Target Emotions:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {content.target_emotions.map((emotion: string, index: number) => (
                      <Chip key={index} label={emotion} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        );

      case 'content_variation':
      case 'copy_asset':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {content.title || content.type}
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                  {content.content}
                </Typography>
              </Paper>
              <Box display="flex" gap={1}>
                {content.platform && <Chip label={content.platform} size="small" />}
                {content.type && <Chip label={content.type} size="small" variant="outlined" />}
                {content.character_count && (
                  <Chip label={`${content.character_count} chars`} size="small" variant="outlined" />
                )}
              </Box>
            </CardContent>
          </Card>
        );

      case 'video':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Video Generation
              </Typography>
              {content.output_url ? (
                <Box>
                  <video
                    controls
                    style={{ width: '100%', maxHeight: '400px' }}
                    src={content.output_url}
                  />
                  <Box mt={2} display="flex" gap={1}>
                    <Chip label={content.status} size="small" />
                    {content.duration && <Chip label={`${content.duration}s`} size="small" variant="outlined" />}
                  </Box>
                </Box>
              ) : (
                <Alert severity="info">
                  Video is still being generated. Status: {content.status}
                </Alert>
              )}
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {previewItem.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Preview not available for this content type.
              </Typography>
            </CardContent>
          </Card>
        );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending_approval':
        return 'warning';
      case 'published':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <>
       <Head>
        <title>Content Preview | AIRFLOW</title>
      </Head>
      <DashboardLayout title="Content Preview">
        {loading && (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && !previewItem && (
          <Alert severity="info" sx={{ mb: 3 }}>
            No preview item specified. Please provide item_id and item_type parameters.
          </Alert>
        )}

        {previewItem && (
          <Box>
            {/* Header */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
                  {previewItem.title}
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Chip
                    label={previewItem.status}
                    color={getStatusColor(previewItem.status) as any}
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary">
                    {previewItem.type} • Created {new Date(previewItem.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Refresh">
                  <IconButton onClick={fetchPreviewItem}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                  <IconButton onClick={() => setFullscreen(!fullscreen)}>
                    {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                  </IconButton>
                </Tooltip>
                <Button
                  variant="outlined"
                  startIcon={<ShareIcon />}
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    showNotification('Preview link copied to clipboard', 'success');
                  }}
                >
                  Share
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CommentIcon />}
                  onClick={() => setApprovalDialogOpen(true)}
                >
                  Review & Approve
                </Button>
              </Stack>
            </Box>

            <Grid container spacing={3}>
              {/* Main Preview Content */}
              <Grid size={{ xs: 12, md: fullscreen ? 12 : 8 }}>
                <Paper sx={{ p: 3 }}>
                  <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                    <Tab label="Preview" icon={<PreviewIcon />} />
                    <Tab label="Details" icon={<EditIcon />} />
                    <Tab label="History" icon={<HistoryIcon />} />
                  </Tabs>

                  <Box sx={{ mt: 3 }}>
                    {activeTab === 0 && renderPreviewContent()}

                    {activeTab === 1 && (
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Item Details
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Type
                              </Typography>
                              <Typography variant="body1">
                                {previewItem.type}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Status
                              </Typography>
                              <Typography variant="body1">
                                {previewItem.status}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Created By
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar
                                  {...(previewItem.created_by.avatar_url && { src: previewItem.created_by.avatar_url })}
                                  sx={{ width: 24, height: 24 }}
                                >
                                  <PersonIcon />
                                </Avatar>
                                <Typography variant="body1">
                                  {previewItem.created_by.name}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Client
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar
                                  {...(previewItem.client.logo && { src: previewItem.client.logo })}
                                  sx={{ width: 24, height: 24 }}
                                >
                                  <BusinessIcon />
                                </Avatar>
                                <Typography variant="body1">
                                  {previewItem.client.name}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Last Updated
                              </Typography>
                              <Typography variant="body1">
                                {new Date(previewItem.updated_at).toLocaleString()}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}

                    {activeTab === 2 && (
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Version History
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Version history will be displayed here when available.
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Sidebar - Approval Workflow */}
              {!fullscreen && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <ApprovalWorkflow
                    itemType={previewItem.type}
                    itemId={previewItem.id}
                    clientId={previewItem.client.id}
                    showHeader={true}
                    showActions={true}
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* Approval Decision Dialog */}
        <Dialog
          open={approvalDialogOpen}
          onClose={() => setApprovalDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Review & Approve Content</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Decision</InputLabel>
              <Select
                value={approvalDecision.action}
                label="Decision"
                onChange={(e) => setApprovalDecision({
                  ...approvalDecision,
                  action: e.target.value as ApprovalDecision['action']})}
              >
                <MenuItem value="approve">Approve</MenuItem>
                <MenuItem value="request_changes">Request Changes</MenuItem>
                <MenuItem value="reject">Reject</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comments"
              placeholder="Add your review comments..."
              value={approvalDecision.comments}
              onChange={(e) => setApprovalDecision({
                ...approvalDecision,
                comments: e.target.value})}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleApprovalSubmit}
              disabled={submittingApproval}
              startIcon={submittingApproval ? <CircularProgress size={20} /> : undefined}
            >
              {submittingApproval ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogActions>
        </Dialog>
      </DashboardLayout>
    </>
  );
};

export default PreviewPage;
