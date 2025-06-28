import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Stack,
  Paper,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useWorkflow } from '../WorkflowProvider';
import { StepComponentProps } from '@/lib/workflow/workflow-types';

interface RenderStepProps extends StepComponentProps {}

interface RenderJob {
  id: string;
  motivation: string;
  platform: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  progress: number;
  videoUrl?: string;
  error?: string;
  estimatedTime?: number;
}

export const RenderStep: React.FC<RenderStepProps> = ({ onPrevious, onComplete }) => {
  const { state, actions } = useWorkflow();
  const { briefData, motivations, copyVariations, selectedAssets, selectedTemplate, lastError } =
    state;

  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  // Get selected data for rendering
  const selectedMotivations = motivations.filter((m: any) => m.selected);
  const selectedCopy = copyVariations.filter((c: any) => c.selected);

  // Initialize render jobs
  useEffect(() => {
    if (renderJobs.length === 0 && selectedMotivations.length > 0) {
      const jobs: RenderJob[] = selectedMotivations.map((motivation, index) => ({
        id: `render-${index + 1}`,
        motivation: motivation.title,
        platform: selectedCopy[index % selectedCopy.length]?.platform || 'General',
        status: 'pending',
        progress: 0,
        estimatedTime: Math.floor(Math.random() * 60) + 30, // 30-90 seconds
      }));
      setRenderJobs(jobs);
    }
  }, [selectedMotivations, selectedCopy, renderJobs.length]);

  // Start rendering process
  const handleStartRendering = useCallback(async () => {
    if (!selectedTemplate) {
      actions.setError('No template selected for rendering');
      return;
    }

    setIsRendering(true);
    actions.clearError();

    // Simulate rendering process
    for (let i = 0; i < renderJobs.length; i++) {
      const job = renderJobs[i];

      // Update job status to rendering
      setRenderJobs(prev =>
        prev.map((j: any) => (j.id === job?.id ? { ...j, status: 'rendering' as const } : j))
      );

      // Simulate rendering progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));

        setRenderJobs(prev => prev.map((j: any) => (j.id === job?.id ? { ...j, progress } : j)));

        // Update overall progress
        const completedJobs = i;
        const currentJobProgress = progress / 100;
        const totalProgress = ((completedJobs + currentJobProgress) / renderJobs.length) * 100;
        setOverallProgress(totalProgress);
      }

      // Complete the job
      const success = Math.random() > 0.1; // 90% success rate
      setRenderJobs(prev =>
        prev.map((j: any) =>
          j.id === job.id
            ? {
                ...j,
                status: success ? ('completed' as const) : ('failed' as const),
                videoUrl: success ? `https://example.com/video-${job.id}.mp4` : undefined,
                error: success ? undefined : 'Rendering failed due to template incompatibility',
              }
            : j
        )
      );
    }

    setIsRendering(false);
    setOverallProgress(100);
  }, [renderJobs, selectedTemplate, actions]);

  // Retry failed job
  const handleRetryJob = useCallback(async (jobId: string) => {
    setRenderJobs(prev =>
      prev.map((j: any) =>
        j.id === jobId ? { ...j, status: 'rendering' as const, progress: 0, error: undefined } : j
      )
    );

    // Simulate retry
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setRenderJobs(prev => prev.map((j: any) => (j.id === jobId ? { ...j, progress } : j)));
    }

    // Complete retry
    const success = Math.random() > 0.3; // 70% success rate on retry
    setRenderJobs(prev =>
      prev.map((j: any) =>
        j.id === jobId
          ? {
              ...j,
              status: success ? ('completed' as const) : ('failed' as const),
              videoUrl: success ? `https://example.com/video-${jobId}-retry.mp4` : undefined,
              error: success ? undefined : 'Retry failed - please check template settings',
            }
          : j
      )
    );
  }, []);

  // Handle download
  const handleDownload = useCallback((job: RenderJob) => {
    if (job.videoUrl) {
      // In real implementation, this would trigger a download
      window.open(job.videoUrl, '_blank');
    }
  }, []);

  // Handle share
  const handleShare = useCallback((job: RenderJob) => {
    if (job.videoUrl) {
      // In real implementation, this would open a share dialog
      navigator.clipboard.writeText(job.videoUrl);
      // Could show a toast notification
    }
  }, []);

  // Handle workflow completion
  const handleComplete = useCallback(() => {
    const completedJobs = renderJobs.filter((job: any) => job.status === 'completed');
    onComplete?.({
      briefData,
      selectedMotivations,
      selectedCopy,
      selectedAssets,
      selectedTemplate,
      renderedVideos: completedJobs,
    });
  }, [
    renderJobs,
    briefData,
    selectedMotivations,
    selectedCopy,
    selectedAssets,
    selectedTemplate,
    onComplete,
  ]);

  // Clear error
  const handleClearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  // Get render statistics
  const getRenderStats = () => {
    const completed = renderJobs.filter((job: any) => job.status === 'completed').length;
    const failed = renderJobs.filter((job: any) => job.status === 'failed').length;
    const pending = renderJobs.filter((job: any) => job.status === 'pending').length;
    const rendering = renderJobs.filter((job: any) => job.status === 'rendering').length;

    return { completed, failed, pending, rendering, total: renderJobs.length };
  };

  const stats = getRenderStats();

  // Get status icon
  const getStatusIcon = (status: RenderJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'rendering':
        return <PendingIcon color="primary" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Video Rendering
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Generate your campaign videos using the selected template, motivations, copy, and assets.
      </Typography>

      {/* Error Alert */}
      {lastError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={handleClearError}>
          {lastError}
        </Alert>
      )}

      {/* Render Statistics */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Rendering Progress
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
            mb: 3,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="success.main">
              {stats.completed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completed
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="primary.main">
              {stats.rendering}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rendering
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="grey.500">
              {stats.pending}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pending
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="error.main">
              {stats.failed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Failed
            </Typography>
          </Box>
        </Box>

        {/* Overall Progress */}
        {isRendering && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Overall Progress: {Math.round(overallProgress)}%
            </Typography>
            <LinearProgress variant="determinate" value={overallProgress} />
          </Box>
        )}

        {/* Template Info */}
        {selectedTemplate && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Template:</strong> {selectedTemplate.name}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Start Rendering Button */}
      {!isRendering && stats.completed === 0 && stats.rendering === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', mb: 4 }}>
          <PlayArrowIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Ready to Render Videos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start the rendering process to generate {renderJobs.length} videos based on your
            campaign matrix.
          </Typography>
          <Button
            variant="contained"
            onClick={handleStartRendering}
            startIcon={<PlayArrowIcon />}
            size="large"
            disabled={!selectedTemplate}
          >
            Start Rendering ({renderJobs.length} videos)
          </Button>
        </Paper>
      )}

      {/* Render Jobs List */}
      {renderJobs.length > 0 && (
        <Paper sx={{ mb: 4 }}>
          <List>
            {renderJobs.map((job, index) => (
              <ListItem
                key={job.id}
                divider={index < renderJobs.length - 1}
                sx={{
                  bgcolor:
                    job.status === 'completed'
                      ? 'success.50'
                      : job.status === 'failed'
                        ? 'error.50'
                        : 'inherit',
                }}
              >
                <ListItemIcon>{getStatusIcon(job.status)}</ListItemIcon>

                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">{job.motivation}</Typography>
                      <Chip label={job.platform} size="small" />
                    </Box>
                  }
                  secondary={
                    <Box>
                      {job.status === 'rendering' && (
                        <LinearProgress
                          variant="determinate"
                          value={job.progress}
                          sx={{ mt: 1, mb: 1 }}
                        />
                      )}
                      {job.error && (
                        <Typography variant="body2" color="error">
                          {job.error}
                        </Typography>
                      )}
                      {job.status === 'completed' && job.videoUrl && (
                        <Typography variant="body2" color="success.main">
                          Video ready for download
                        </Typography>
                      )}
                    </Box>
                  }
                />

                <Stack direction="row" spacing={1}>
                  {job.status === 'completed' && job.videoUrl && (
                    <>
                      <Tooltip title="Download">
                        <IconButton onClick={() => handleDownload(job)}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Share">
                        <IconButton onClick={() => handleShare(job)}>
                          <ShareIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {job.status === 'failed' && (
                    <Tooltip title="Retry">
                      <IconButton onClick={() => handleRetryJob(job.id)}>
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onPrevious} startIcon={<ArrowBackIcon />}>
          Back to Matrix
        </Button>

        {stats.completed > 0 && (
          <Button variant="contained" onClick={handleComplete} color="success">
            Complete Workflow ({stats.completed} videos ready)
          </Button>
        )}
      </Box>
    </Box>
  );
};
