import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Stack,
  Tooltip} from '@mui/material';
import {
  Webhook as WebhookIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreIcon} from '@mui/icons-material';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  client_id: string;
  description?: string;
  active: boolean;
  secret?: string;
  retry_policy: {
    max_attempts: number;
    backoff_strategy: 'linear' | 'exponential';
    initial_delay_ms: number;
  };
  headers?: Record<string, string>;
  timeout_ms: number;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    slug: string;
  };
  profiles?: {
    full_name: string;
  };
}

// interface _WebhookDelivery {
//   id: string;
//   webhook_id: string;
//   event_type: string;
//   payload: any;
//   response_status: number;
//   response_body: string;
//   success: boolean;
//   delivered_at: string;
// }

interface WebhookStatistics {
  total: number;
  active: number;
  inactive: number;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  success_rate: number;
  event_distribution: Record<string, number>;
}

const WebhookManager: React.FC = () => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [_selectedWebhook, _setSelectedWebhook] = useState<Webhook | null>(null);
  const [_statistics, _setStatistics] = useState<WebhookStatistics | null>(null);
  const [_availableEvents, _setAvailableEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [_dialogOpen, _setDialogOpen] = useState(false);
  const [_detailsDialogOpen, _setDetailsDialogOpen] = useState(false);
  const [_deleteDialogOpen, _setDeleteDialogOpen] = useState(false);
  const [_testDialogOpen, _setTestDialogOpen] = useState(false);
  const [_menuAnchor, _setMenuAnchor] = useState<null | HTMLElement>(null);
  const [_webhookDetails, _setWebhookDetails] = useState<any>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    description: '',
    active: true,
    timeout_ms: 10000,
    retry_policy: {
      max_attempts: 3,
      backoff_strategy: 'exponential' as 'linear' | 'exponential',
      initial_delay_ms: 1000
    },
    headers: {} as Record<string, string>,
  });
  const [testData, setTestData] = useState({
    event_type: '',
    test_data: '{}' });
  // Fetch webhooks
  const fetchWebhooks = async () => {
    if (!activeClient) return;
    try {
      setLoading(true);
      const response = await fetch('/api/webhooks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.data || []);
        setStatistics(data.statistics);
        setAvailableEvents(data.events || []);
      }
    } catch (error: any) {
      const message = getErrorMessage(error);
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching webhooks:', error);
      }
      showNotification('Failed to load webhooks', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchWebhooks();
  }, [activeClient]);

  if (!activeClient) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" align="center">
            Select a client to manage webhooks
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Webhook Management
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchWebhooks}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            Add Webhook
          </Button>
        </Stack>
      </Box>

      {/* Webhooks Table */}
      <Card>
        {loading ? (
          <LinearProgress />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Events</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Box sx={{ py: 4 }}>
                        <WebhookIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No webhooks configured
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Add a webhook to receive real-time notifications
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map((webhook: any) => (
                    <TableRow key={webhook.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {webhook.name}
                          </Typography>
                          {webhook.description && (
                            <Typography variant="caption" color="text.secondary">
                              {webhook.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={webhook.url}>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {webhook.url}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {webhook.events.slice(0, 3).map((event: any) => (
                            <Chip
                              key={event}
                              label={event}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                          {webhook.events.length > 3 && (
                            <Chip
                              label={`+${webhook.events.length - 3}`}
                              size="small"
                              variant="outlined"
                              color="secondary"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={webhook.active ? 'Active' : 'Inactive'}
                          color={webhook.active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" aria-label="Edit webhook">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <IconButton size="small" aria-label="More options">
                            <MoreIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
};

export default WebhookManager;