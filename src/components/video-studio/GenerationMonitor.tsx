/**
 * GenerationMonitor Component
 * Extracted from video-studio.tsx for better maintainability
 * Medium risk extraction - job monitoring with status logic and API calls
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Refresh,
  Download,
  Share,
  CheckCircle,
  Schedule,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface VideoJob {
  id: string;
  generation_id: string;
  variation_index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  output_url?: string;
  error_message?: string;
  estimated_completion?: string;
}

interface GenerationMonitorProps {
  videoJobs: VideoJob[];
  generating: boolean;
  onRefresh: () => void;
  onCreateAnother: () => void;
}

export const GenerationMonitor: React.FC<GenerationMonitorProps> = ({
  videoJobs,
  generating,
  onRefresh,
  onCreateAnother,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'processing':
        return <CircularProgress size={20} />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <Schedule color="action" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'primary';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography variant="h6">Video Generation Progress</Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRefresh}
            disabled={generating}
          >
            Refresh Status
          </Button>
        </Box>

        {videoJobs.length === 0 ? (
          <Alert severity="info">
            No video generation jobs yet. Go back to configure and generate your first video.
          </Alert>
        ) : (
          <List>
            {videoJobs.map((job: VideoJob) => (
              <ListItem key={job.id} divider>
                <ListItemIcon>{getStatusIcon(job.status)}</ListItemIcon>
                <ListItemText
                  primary={`Video ${job.variation_index} (${job.generation_id})`}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        Status: {job.status} • Progress: {job.progress}%
                      </Typography>
                      {job.status === 'processing' && (
                        <LinearProgress variant="determinate" value={job.progress} sx={{ mt: 1 }} />
                      )}
                      {job.estimated_completion && (
                        <Typography variant="caption" color="text.secondary">
                          ETA: {new Date(job.estimated_completion).toLocaleTimeString()}
                        </Typography>
                      )}
                      {job.error_message && (
                        <Typography variant="caption" color="error">
                          Error: {job.error_message}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <Box display="flex" gap={1}>
                  <Chip size="small" label={job.status} color={getStatusColor(job.status) as any} />
                  {job.output_url && (
                    <>
                      <Tooltip title="Download">
                        <IconButton size="small" href={job.output_url} target="_blank">
                          <Download />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Share">
                        <IconButton size="small">
                          <Share />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
        )}

        <Box mt={3}>
          <Button variant="outlined" onClick={onCreateAnother}>
            Create Another Video
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default GenerationMonitor;
