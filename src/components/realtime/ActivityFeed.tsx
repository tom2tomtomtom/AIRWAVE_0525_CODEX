import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Divider,
  Stack,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Tooltip,
  Badge,
  LinearProgress} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Campaign as CampaignIcon,
  Approval as ApprovalIcon,
  VideoLibrary as VideoIcon,
  Timeline as TimelineIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon} from '@mui/icons-material';
import { useRealtime } from '@/hooks/useRealtime';
import { useClient } from '@/contexts/ClientContext';
import { formatDistanceToNow } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface ActivityFeedProps {
  title?: string;
  showControls?: boolean;
  maxHeight?: number;
  compact?: boolean;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  title = 'Live Activity',
  showControls = true,
  maxHeight = 500,
  compact = false}) => {
  const { activeClient } = useClient();
  const [activeTab, setActiveTab] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showDetails, setShowDetails] = useState(!compact);

  const { events, loading, error, connectionStatus, refresh, startPolling, stopPolling } =
    useRealtime({
      pollInterval: isPaused ? 0 : 3000,
      enableNotifications: false });

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
    if (isPaused) {
      startPolling();
    } else {
      stopPolling();
    }
  };

  const getEventIcon = (event: any) => {
    switch (event.type) {
      case 'execution_status_change':
        return event.data.status === 'completed' ? (
          <CheckIcon color="success" />
        ) : event.data.status === 'failed' ? (
          <ErrorIcon color="error" />
        ) : (
          <PendingIcon color="warning" />
        );
      case 'approval_decision':
        return <ApprovalIcon color="primary" />;
      case 'campaign_update':
        return <CampaignIcon color="info" />;
      case 'video_generation':
        return <VideoIcon color="secondary" />;
      default:
        return <TimelineIcon />;
    }
  };

  const getEventColor = (event: any) => {
    switch (event.type) {
      case 'execution_status_change':
        return event.data.status === 'completed'
          ? 'success'
          : event.data.status === 'failed'
            ? 'error'
            : 'warning';
      case 'approval_decision':
        return event.data.decision === 'approved'
          ? 'success'
          : event.data.decision === 'rejected'
            ? 'error'
            : 'info';
      case 'campaign_update':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatEventMessage = (event: any) => {
    switch (event.type) {
      case 'execution_status_change':
        const execution = event.context?.execution;
        const campaignName = execution?.matrices?.campaigns?.name || 'Unknown Campaign';
        return `${campaignName} execution ${event.data.status} on ${execution?.platform || 'unknown platform'}`;

      case 'approval_decision':
        const approval = event.context?.approval;
        return `${approval?.approval_type || 'Approval'} ${event.data.decision} for ${approval?.item_type || 'item'}`;

      case 'campaign_update':
        return `Campaign "${event.data.campaign_name}" was updated`;

      case 'video_generation':
        return `Video generation ${event.data.status} for ${event.data.asset_name || 'asset'}`;

      default:
        return event.data.message || 'Activity update';
    }
  };

  const getEventSecondaryText = (event: any) => {
    const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });
    const details = [];

    if (event.context?.execution?.matrices?.name) {
      details.push(`Matrix: ${event.context.execution.matrices.name}`);
    }

    if (event.data.user_name) {
      details.push(`By: ${event.data.user_name}`);
    }

    return `${timeAgo}${details.length > 0 ? ` • ${details.join(' • ')}` : ''}`;
  };

  // Filter events by type
  const allEvents = events;
  const executionEvents = events.filter((e: any) => e.type === 'execution_status_change');
  const approvalEvents = events.filter((e: any) => e.type === 'approval_decision');
  const campaignEvents = events.filter((e: any) => e.type === 'campaign_update');

  const renderEventList = (eventList: any[]) => (
    <List sx={{ maxHeight: maxHeight - 100, overflow: 'auto', py: 0 }}>
      {eventList.length === 0 ? (
        <ListItem>
          <ListItemText
            primary="No activity"
            secondary="No recent activity to display"
            sx={{ textAlign: 'center' }}
          />
        </ListItem>
      ) : (
        eventList.map((event, index) => (
          <React.Fragment key={`${event.id}-${index}`}>
            <ListItem
              sx={{
                py: compact ? 0.5 : 1,
                '&:hover': { backgroundColor: 'action.hover'  }
              }}
            >
              <ListItemIcon sx={{ minWidth: compact ? 32 : 56 }}>
                {getEventIcon(event)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant={compact ? 'body2' : 'subtitle2'} sx={{ flexGrow: 1 }}>
                      {formatEventMessage(event)}
                    </Typography>
                    <Chip
                      label={event.type.replace('_', ' ')}
                      size="small"
                      variant="outlined"
                      color={getEventColor(event) as any}
                    />
                  </Box>
                }
                secondary={showDetails ? getEventSecondaryText(event) : null}
              />
              {event.data.progress !== undefined && (
                <Box sx={{ width: 100, ml: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={event.data.progress}
                    color={getEventColor(event) as any}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {event.data.progress}%
                  </Typography>
                </Box>
              )}
            </ListItem>
            {index < eventList.length - 1 && <Divider />}
          </React.Fragment>
        ))
      )}
    </List>
  );

  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge
              color={connectionStatus === 'connected' ? 'success' : 'error'}
              variant="dot"
              sx={{
                '& .MuiBadge-badge': {
                  animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none' }}}
            >
              <TimelineIcon />
            </Badge>
            {title}
          </Typography>

          {showControls && (
            <Stack direction="row" spacing={1}>
              <Tooltip title={showDetails ? 'Hide details' : 'Show details'}>
                <IconButton
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                  aria-label="Icon button"
                >
                  {showDetails ? <HideIcon /> : <ViewIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={isPaused ? 'Resume updates' : 'Pause updates'}>
                <IconButton
                  size="small"
                  onClick={handlePauseToggle}
                  color={isPaused ? 'warning' : 'default'}
                  aria-label="Icon button"
                >
                  {' '}
                  {isPaused ? <PlayIcon /> : <PauseIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton
                  size="small"
                  onClick={refresh}
                  disabled={loading}
                  aria-label="Icon button"
                >
                  {' '}
                  {loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!activeClient && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Select a client to view activity feed
          </Alert>
        )}

        {activeClient && (
          <>
       <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label={`All (${allEvents.length})`} sx={{ minHeight: compact ? 40 : 48 }} />
              <Tab
                label={`Executions (${executionEvents.length})`}
                sx={{ minHeight: compact ? 40 : 48 }}
              />
              <Tab
                label={`Approvals (${approvalEvents.length})`}
                sx={{ minHeight: compact ? 40 : 48 }}
              />
              <Tab
                label={`Campaigns (${campaignEvents.length})`}
                sx={{ minHeight: compact ? 40 : 48 }}
              />
            </Tabs>

            <TabPanel value={activeTab} index={0}>
              {renderEventList(allEvents)}
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              {renderEventList(executionEvents)}
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              {renderEventList(approvalEvents)}
            </TabPanel>
            <TabPanel value={activeTab} index={3}>
              {renderEventList(campaignEvents)}
            </TabPanel>
          </>
        )}

        {isPaused && (
          <Box sx={{ mt: 2, p: 1, backgroundColor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="caption" color="warning.dark">
              Activity feed is paused. Click play to resume real-time updates.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
