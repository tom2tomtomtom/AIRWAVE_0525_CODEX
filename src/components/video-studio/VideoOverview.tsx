/**
 * VideoOverview Component
 * Extracted from video-studio.tsx for better maintainability
 * Low risk extraction - display-only component with minimal dependencies
 */

import React from 'react';
import { Box, Typography, Card, CardContent, Avatar, Divider } from '@mui/material';

interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  preview?: string;
  duration: number;
  aspect_ratio: string;
  platform: string[];
  category: string;
  tags: string[];
}

interface VideoConfig {
  prompt: string;
  style: string;
  duration: number;
  resolution: string;
  aspect_ratio: string;
}

interface VideoJob {
  id: string;
  generation_id: string;
  variation_index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  output_url?: string;
  error_message?: string;
}

interface ActiveClient {
  id: string;
  name: string;
  logo?: string;
  primaryColor?: string;
}

interface VideoOverviewProps {
  activeClient?: ActiveClient | null;
  selectedTemplate?: VideoTemplate | null;
  videoConfig: VideoConfig;
  videoJobs: VideoJob[];
}

export const VideoOverview: React.FC<VideoOverviewProps> = ({
  activeClient,
  selectedTemplate,
  videoConfig,
  videoJobs,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Video Overview
        </Typography>

        {activeClient && (
          <Box mb={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Client
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar
                {...(activeClient.logo ? { src: activeClient.logo } : {})}
                sx={{ width: 24, height: 24, bgcolor: activeClient.primaryColor }}
              >
                {activeClient.name.charAt(0)}
              </Avatar>
              <Typography variant="body1">{activeClient.name}</Typography>
            </Box>
          </Box>
        )}

        {selectedTemplate && (
          <Box mb={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Template
            </Typography>
            <Typography variant="body1">{selectedTemplate.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedTemplate.category} • {selectedTemplate.duration}s
            </Typography>
          </Box>
        )}

        {videoConfig.prompt && (
          <Box mb={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Prompt
            </Typography>
            <Typography variant="body2">
              {videoConfig.prompt.substring(0, 100)}
              {videoConfig.prompt.length > 100 ? '...' : ''}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box mb={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Configuration
          </Typography>
          <Typography variant="body2">Style: {videoConfig.style}</Typography>
          <Typography variant="body2">Duration: {videoConfig.duration}s</Typography>
          <Typography variant="body2">Resolution: {videoConfig.resolution}</Typography>
          <Typography variant="body2">Aspect Ratio: {videoConfig.aspect_ratio}</Typography>
        </Box>

        {videoJobs.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Generation Status
            </Typography>
            <Typography variant="h4" color="primary.main">
              {videoJobs.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Videos in queue
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoOverview;
