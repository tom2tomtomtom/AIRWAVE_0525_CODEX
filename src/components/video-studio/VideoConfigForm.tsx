/**
 * VideoConfigForm Component
 * Extracted from video-studio.tsx for better maintainability
 * Medium risk extraction - form with local state and validation logic
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
} from '@mui/material';

interface VideoConfig {
  prompt: string;
  style: string;
  platform?: string;
  resolution: string;
  aspect_ratio: string;
  duration: number;
}

interface VideoConfigFormProps {
  videoConfig: VideoConfig;
  onConfigChange: (config: VideoConfig) => void;
  onNext: () => void;
  onBack: () => void;
  getAspectRatioForPlatform: (platform: string) => string;
}

export const VideoConfigForm: React.FC<VideoConfigFormProps> = ({
  videoConfig,
  onConfigChange,
  onNext,
  onBack,
  getAspectRatioForPlatform,
}) => {
  const handleConfigUpdate = (updates: Partial<VideoConfig>) => {
    onConfigChange({ ...videoConfig, ...updates });
  };

  const handlePlatformChange = (platform: string) => {
    handleConfigUpdate({
      platform,
      aspect_ratio: getAspectRatioForPlatform(platform),
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Configure Your Video
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Set up the basic parameters for your video generation
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Video Prompt"
              placeholder="Describe what you want your video to show. Be specific about scenes, actions, and visual elements..."
              value={videoConfig.prompt}
              onChange={e => handleConfigUpdate({ prompt: e.target.value })}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Video Style</InputLabel>
              <Select
                value={videoConfig.style}
                label="Video Style"
                onChange={e => handleConfigUpdate({ style: e.target.value })}
              >
                <MenuItem value="commercial">Commercial</MenuItem>
                <MenuItem value="cinematic">Cinematic</MenuItem>
                <MenuItem value="documentary">Documentary</MenuItem>
                <MenuItem value="social_media">Social Media</MenuItem>
                <MenuItem value="animation">Animation</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Platform</InputLabel>
              <Select
                value={videoConfig.platform || ''}
                label="Platform"
                onChange={e => handlePlatformChange(e.target.value)}
              >
                <MenuItem value="">General</MenuItem>
                <MenuItem value="youtube">YouTube</MenuItem>
                <MenuItem value="instagram">Instagram</MenuItem>
                <MenuItem value="tiktok">TikTok</MenuItem>
                <MenuItem value="facebook">Facebook</MenuItem>
                <MenuItem value="linkedin">LinkedIn</MenuItem>
                <MenuItem value="twitter">Twitter</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Resolution</InputLabel>
              <Select
                value={videoConfig.resolution}
                label="Resolution"
                onChange={e => handleConfigUpdate({ resolution: e.target.value })}
              >
                <MenuItem value="720p">720p (HD)</MenuItem>
                <MenuItem value="1080p">1080p (Full HD)</MenuItem>
                <MenuItem value="4K">4K (Ultra HD)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Aspect Ratio</InputLabel>
              <Select
                value={videoConfig.aspect_ratio}
                label="Aspect Ratio"
                onChange={e => handleConfigUpdate({ aspect_ratio: e.target.value })}
              >
                <MenuItem value="16:9">16:9 (Landscape)</MenuItem>
                <MenuItem value="9:16">9:16 (Portrait)</MenuItem>
                <MenuItem value="1:1">1:1 (Square)</MenuItem>
                <MenuItem value="4:5">4:5 (Instagram)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Typography gutterBottom>Duration: {videoConfig.duration}s</Typography>
              <Slider
                value={videoConfig.duration}
                onChange={(_, value) => handleConfigUpdate({ duration: value as number })}
                min={5}
                max={60}
                step={5}
                marks={[
                  { value: 5, label: '5s' },
                  { value: 15, label: '15s' },
                  { value: 30, label: '30s' },
                  { value: 60, label: '60s' },
                ]}
              />
            </Box>
          </Grid>
        </Grid>

        <Box mt={3} display="flex" gap={2}>
          <Button variant="contained" onClick={onNext} disabled={!videoConfig.prompt.trim()}>
            Continue to Customization
          </Button>
          <Button variant="outlined" onClick={onBack}>
            Back to Templates
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default VideoConfigForm;
