import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
  Alert,
  Stack,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Tabs,
  Tab,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as RequestChangesIcon,
  MoreVert as MoreIcon,
  Schedule as PendingIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Comment as CommentIcon,
  History as HistoryIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
  Notifications as NotificationIcon,
} from '@mui/icons-material';
import { useNotification } from '@/contexts/NotificationContext';
import { useClient } from '@/contexts/ClientContext';

interface Approval {
  id: string;
  item_type: 'motivation' | 'content_variation' | 'execution' | 'campaign';
  item_id: string;
  approval_type: 'content' | 'legal' | 'brand' | 'final';
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  created_at: string;
  updated_at: string;
  decision_data?: any;
  notes?: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
  clients?: {
    name: string;
  };
  item_details?: any;
}

interface ApprovalWorkflowProps {
  maxHeight?: number;
  showHeader?: boolean;
  clientId?: string;
  itemType?: string;
  itemId?: string;
  showActions?: boolean;
}

interface BulkSelection {
  [key: string]: boolean;
}

const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  maxHeight = 600,
  showHeader = true,
  clientId,
  itemType,
  itemId,
  showActions = true,
}) => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState('pending');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<BulkSelection>({});
  const [decisionData, setDecisionData] = useState({
    action: 'approve' as 'approve' | 'reject' | 'request_changes',
    comments: '',
    changes_requested: [] as any[],
    conditions: [] as string[],
  });

  // Fetch approvals
  const fetchApprovals = async () => {
    const targetClientId = clientId || activeClient?.id;
    if (!targetClientId) return;

    try {
      const params = new URLSearchParams({
        limit: '50',
        sort_by: 'created_at',
        sort_order: 'desc',
        ...(tabValue !== 'all' && { status: tabValue }),
        ...(targetClientId && { client_id: targetClientId }),
        ...(itemType && { item_type: itemType }),
        ...(itemId && { item_id: itemId }),
      });

      const response = await fetch(`/api/approvals?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setApprovals(data.data || []);
      }
    } catch (error) {
    const message = getErrorMessage(error);
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle approval decision
  const handleApprovalDecision = async () => {
    if (!selectedApproval) return;

    try {
      const response = await fetch(`/api/approvals/${selectedApproval.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(decisionData),
      });

      if (response.ok) {
        showNotification(`Approval ${decisionData.action}d successfully`, 'success');
        setDecisionDialogOpen(false);
        fetchApprovals();
        resetDecisionData();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to process approval', 'error');
      }
    } catch (error) {
    const message = getErrorMessage(error);
      showNotification('Error processing approval', 'error');
    }
  };

  // Handle bulk approval
  const handleBulkApproval = async () => {
    const selectedIds = Object.keys(bulkSelection).filter(id => bulkSelection[id]);
    if (selectedIds.length === 0) return;

    try {
      const response = await fetch('/api/approvals/bulk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          approval_ids: selectedIds,
          ...decisionData,
        }),
      });

      if (response.ok) {
        showNotification(`${selectedIds.length} approvals processed successfully`, 'success');
        setBulkDialogOpen(false);
        setBulkSelection({});
        fetchApprovals();
        resetDecisionData();
      } else {
        const error = await response.json();
        showNotification(error.error || 'Failed to process bulk approvals', 'error');
      }
    } catch (error) {
    const message = getErrorMessage(error);
      showNotification('Error processing bulk approvals', 'error');
    }
  };

  const resetDecisionData = () => {
    setDecisionData({
      action: 'approve',
      comments: '',
      changes_requested: [],
      conditions: [],
    });
  };

  // Get approval status display
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return { color: 'success', icon: <ApproveIcon />, label: 'Approved' };
      case 'rejected':
        return { color: 'error', icon: <RejectIcon />, label: 'Rejected' };
      case 'changes_requested':
        return { color: 'warning', icon: <RequestChangesIcon />, label: 'Changes Requested' };
      default:
        return { color: 'info', icon: <PendingIcon />, label: 'Pending' };
    }
  };

  // Get approval type display
  const getTypeDisplay = (type: string) => {
    const displays = {
      content: { color: '#2196f3', label: 'Content Review' },
      legal: { color: '#ff9800', label: 'Legal Review' },
      brand: { color: '#9c27b0', label: 'Brand Review' },
      final: { color: '#4caf50', label: 'Final Approval' },
    };
    return displays[type as keyof typeof displays] || { color: '#666', label: type };
  };

  // Get priority display
  const getPriorityDisplay = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { color: 'error', label: 'Urgent' };
      case 'high':
        return { color: 'warning', label: 'High' };
      case 'normal':
        return { color: 'info', label: 'Normal' };
      default:
        return { color: 'default', label: 'Low' };
    }
  };

  // Check if overdue
  const isOverdue = (approval: Approval) => {
    return approval.due_date && new Date(approval.due_date) < new Date() && approval.status === 'pending';
  };

  // Time calculations
  const getTimeDisplay = (approval: Approval) => {
    const now = new Date();
    const created = new Date(approval.created_at);
    const diffHours = Math.round((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, approval: Approval) => {
    setMenuAnchor(event.currentTarget);
    setSelectedApproval(approval);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedApproval(null);
  };

  const handleDecisionClick = (action: 'approve' | 'reject' | 'request_changes') => {
    setDecisionData({ ...decisionData, action });
    setDecisionDialogOpen(true);
    handleMenuClose();
  };

  // Bulk selection handlers
  const handleBulkToggle = (approvalId: string) => {
    setBulkSelection(prev => ({
      ...prev,
      [approvalId]: !prev[approvalId],
    }));
  };

  const handleSelectAll = () => {
    const pendingApprovals = approvals.filter(a => a.status === 'pending');
    const allSelected = pendingApprovals.every(a => bulkSelection[a.id]);
    
    if (allSelected) {
      setBulkSelection({});
    } else {
      const newSelection: BulkSelection = {};
      pendingApprovals.forEach(a => {
        newSelection[a.id] = true;
      });
      setBulkSelection(newSelection);
    }
  };

  // Effects
  useEffect(() => {
    fetchApprovals();
  }, [activeClient, tabValue, clientId, itemType, itemId]);

  const filteredApprovals = tabValue === 'all' ? approvals : approvals.filter(a => a.status === tabValue);
  const selectedCount = Object.values(bulkSelection).filter(Boolean).length;
  const overdueCount = approvals.filter(isOverdue).length;

  if (!activeClient && !clientId) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" align="center">
            Select a client to view approvals
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {showHeader && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Approval Workflow
            {overdueCount > 0 && (
              <Chip 
                size="small" 
                color="error" 
                icon={<WarningIcon />}
                label={`${overdueCount} overdue`} 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          <Stack direction="row" spacing={1}>
            {selectedCount > 0 && (
              <Button
                startIcon={<GroupIcon />}
                onClick={() => setBulkDialogOpen(true)}
                variant="contained"
                size="small"
              >
                Bulk Action ({selectedCount})
              </Button>
            )}
            <Button
              startIcon={<NotificationIcon />}
              onClick={fetchApprovals}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
          </Stack>
        </Box>
      )}

      {/* Status Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab label="Pending" value="pending" />
          <Tab label="Approved" value="approved" />
          <Tab label="Changes" value="changes_requested" />
          <Tab label="Rejected" value="rejected" />
          <Tab label="All" value="all" />
        </Tabs>
      </Paper>

      {/* Bulk Selection Controls */}
      {tabValue === 'pending' && filteredApprovals.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={filteredApprovals.length > 0 && filteredApprovals.every(a => bulkSelection[a.id])}
                indeterminate={selectedCount > 0 && selectedCount < filteredApprovals.length}
                onChange={handleSelectAll}
              />
            }
            label="Select All"
          />
          {selectedCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {selectedCount} selected
            </Typography>
          )}
        </Box>
      )}

      {/* Approvals List */}
      <Card>
        <Box sx={{ maxHeight, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography>Loading approvals...</Typography>
            </Box>
          ) : filteredApprovals.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No approvals found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tabValue === 'pending' ? 'No pending approvals' : `No ${tabValue} approvals`}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredApprovals.map((approval, index) => {
                const statusDisplay = getStatusDisplay(approval.status);
                const typeDisplay = getTypeDisplay(approval.approval_type);
                const priorityDisplay = getPriorityDisplay(approval.priority);
                const overdue = isOverdue(approval);
                
                return (
                  <React.Fragment key={approval.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      secondaryAction={
                        <Stack direction="row" spacing={1}>
                          {showActions && approval.status === 'pending' && (
                            <>
                              <Tooltip title="Approve">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    setSelectedApproval(approval);
                                    handleDecisionClick('approve');
                                  }}
                                >
                                  <ApproveIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Request Changes">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => {
                                    setSelectedApproval(approval);
                                    handleDecisionClick('request_changes');
                                  }}
                                >
                                  <RequestChangesIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setSelectedApproval(approval);
                                    handleDecisionClick('reject');
                                  }}
                                >
                                  <RejectIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          <IconButton
                            size="small"
                            onClick={(e: React.ClickEvent<HTMLElement>) => handleMenuOpen(e, approval)}
                          >
                            <MoreIcon />
                          </IconButton>
                        </Stack>
                      }
                    >
                      {tabValue === 'pending' && (
                        <ListItemIcon>
                          <Checkbox
                            checked={!!bulkSelection[approval.id]}
                            onChange={() => handleBulkToggle(approval.id)}
                          />
                        </ListItemIcon>
                      )}
                      
                      <ListItemAvatar>
                        <Badge
                          color={statusDisplay.color as any}
                          variant="dot"
                          invisible={approval.status === 'pending'}
                        >
                          <Avatar sx={{ bgcolor: typeDisplay.color, width: 32, height: 32 }}>
                            <Typography variant="caption" sx={{ color: 'white' }}>
                              {approval.approval_type.charAt(0).toUpperCase()}
                            </Typography>
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2">
                              {typeDisplay.label}
                            </Typography>
                            <Chip
                              size="small"
                              label={statusDisplay.label}
                              color={statusDisplay.color as any}
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={priorityDisplay.label}
                              color={priorityDisplay.color as any}
                              variant="outlined"
                            />
                            {overdue && (
                              <Chip
                                size="small"
                                label="Overdue"
                                color="error"
                                icon={<WarningIcon />}
                              />
                            )}
                          </Stack>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {approval.item_type} • {getTimeDisplay(approval)} • 
                              {approval.profiles?.full_name || 'Unknown User'}
                            </Typography>
                            {approval.notes && (
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {approval.notes}
                              </Typography>
                            )}
                            {approval.decision_data?.comments && (
                              <Alert severity="info" sx={{ mt: 0.5, py: 0 }}>
                                <Typography variant="caption">
                                  {approval.decision_data.comments}
                                </Typography>
                              </Alert>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Box>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {selectedApproval?.status === 'pending' && showActions && (
          [
            <MenuItem key="approve" onClick={() => handleDecisionClick('approve')}>
              <ListItemIcon><ApproveIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText>Approve</ListItemText>
            </MenuItem>,
            <MenuItem key="changes" onClick={() => handleDecisionClick('request_changes')}>
              <ListItemIcon><RequestChangesIcon fontSize="small" color="warning" /></ListItemIcon>
              <ListItemText>Request Changes</ListItemText>
            </MenuItem>,
            <MenuItem key="reject" onClick={() => handleDecisionClick('reject')}>
              <ListItemIcon><RejectIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Reject</ListItemText>
            </MenuItem>,
            <Divider key="divider" />
          ]
        )}
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>
          <ListItemText>View History</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><CommentIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Add Comment</ListItemText>
        </MenuItem>
      </Menu>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onClose={() => setDecisionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {decisionData.action === 'approve' ? 'Approve' : 
           decisionData.action === 'reject' ? 'Reject' : 'Request Changes'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedApproval?.item_type} approval for {selectedApproval?.clients?.name}
          </Typography>
          
          <TextField
            fullWidth
            label="Comments"
            value={decisionData.comments}
            onChange={(e: React.ChangeEvent<HTMLElement>) => setDecisionData({ ...decisionData, comments: e.target.value })}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          
          {decisionData.action === 'request_changes' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Specify what changes are needed to help the creator improve the content.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecisionDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleApprovalDecision}
            color={decisionData.action === 'approve' ? 'success' : 
                   decisionData.action === 'reject' ? 'error' : 'warning'}
          >
            {decisionData.action === 'approve' ? 'Approve' : 
             decisionData.action === 'reject' ? 'Reject' : 'Request Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Approval Action</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Apply action to {selectedCount} selected approvals
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Action</InputLabel>
            <Select
              value={decisionData.action}
              label="Action"
              onChange={(e: React.ChangeEvent<HTMLElement>) => setDecisionData({ ...decisionData, action: e.target.value as any })}
            >
              <MenuItem value="approve">Approve All</MenuItem>
              <MenuItem value="reject">Reject All</MenuItem>
              <MenuItem value="request_changes">Request Changes</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            label="Comments"
            value={decisionData.comments}
            onChange={(e: React.ChangeEvent<HTMLElement>) => setDecisionData({ ...decisionData, comments: e.target.value })}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkApproval}>
            Apply to {selectedCount} Items
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApprovalWorkflow;