import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardMedia,
  Button,
  TextField,
  CircularProgress,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Grid,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';

interface GeneratedVideo {
  id: string;
  url: string;
  thumbnail: string;
  prompt: string;
  duration: string;
  resolution: string;
  dateCreated: string;
  status: 'completed' | 'processing' | 'failed';
  favorite: boolean;
}

interface LazyVideoGenerationSectionProps {
  videoPrompt: string;
  setVideoPrompt: (prompt: string) => void;
  videoDuration: number;
  setVideoDuration: (duration: number) => void;
  videoStyle: string;
  setVideoStyle: (style: string) => void;
  videoResolution: string;
  setVideoResolution: (resolution: string) => void;
  isGeneratingVideo: boolean;
  generatedVideos: GeneratedVideo[];
  handleGenerateVideo: () => void;
  handleToggleVideoFavorite: (id: string) => void;
}

const LazyVideoGenerationSection: React.FC<LazyVideoGenerationSectionProps> = ({
  videoPrompt,
  setVideoPrompt,
  videoDuration,
  setVideoDuration,
  videoStyle,
  setVideoStyle,
  videoResolution,
  setVideoResolution,
  isGeneratingVideo,
  generatedVideos,
  handleGenerateVideo,
  handleToggleVideoFavorite,
}) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Generate Videos
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Create compelling video content for your campaigns.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Video Settings
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Prompt
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                placeholder="Describe the video you want to generate..."
                value={videoPrompt}
                onChange={e => setVideoPrompt(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Be specific about actions, setting, mood, and style.
              </Typography>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" gutterBottom>
                  Duration: {videoDuration} seconds
                </Typography>
                <Slider
                  value={videoDuration}
                  onChange={(_, newValue) => setVideoDuration(newValue as number)}
                  min={15}
                  max={120}
                  step={15}
                  marks={[
                    { value: 15, label: '15s' },
                    { value: 30, label: '30s' },
                    { value: 60, label: '60s' },
                    { value: 120, label: '2m' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Style</InputLabel>
                  <Select
                    value={videoStyle}
                    label="Style"
                    onChange={e => setVideoStyle(e.target.value)}
                  >
                    <MenuItem value="cinematic">Cinematic</MenuItem>
                    <MenuItem value="documentary">Documentary</MenuItem>
                    <MenuItem value="commercial">Commercial</MenuItem>
                    <MenuItem value="social">Social Media</MenuItem>
                    <MenuItem value="animated">Animated</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Resolution</InputLabel>
                  <Select
                    value={videoResolution}
                    label="Resolution"
                    onChange={e => setVideoResolution(e.target.value)}
                  >
                    <MenuItem value="720p">720p (HD)</MenuItem>
                    <MenuItem value="1080p">1080p (Full HD)</MenuItem>
                    <MenuItem value="4k">4K (Ultra HD)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Button
              variant="contained"
              startIcon={isGeneratingVideo ? <CircularProgress size={20} /> : <VideocamIcon />}
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo || !videoPrompt.trim()}
              fullWidth
              size="large"
            >
              {isGeneratingVideo ? 'Generating...' : 'Generate Video'}
            </Button>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Box>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
            >
              <Typography variant="h6">Generated Videos ({generatedVideos.length})</Typography>
              <Stack direction="row" spacing={1}>
                <Chip label="All" size="small" color="primary" />
                <Chip label="Favorites" size="small" variant="outlined" />
                <Chip label="Recent" size="small" variant="outlined" />
              </Stack>
            </Box>

            <Grid container spacing={3}>
              {generatedVideos.map((video: any) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={video.id}>
                  <Card>
                    <Grid container>
                      <Grid size={{ xs: 12 }}>
                        <CardMedia
                          component="img"
                          height="140"
                          image={video.thumbnail}
                          alt={video.prompt}
                          sx={{ position: 'relative' }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: 1,
                            px: 1,
                            py: 0.5,
                          }}
                        >
                          <Typography variant="caption" color="white">
                            {video.duration}
                          </Typography>
                        </Box>
                        {video.status === 'processing' && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            <CircularProgress color="primary" />
                          </Box>
                        )}
                        {video.status === 'completed' && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              opacity: 0.8,
                            }}
                          >
                            <IconButton
                              size="large"
                              sx={{
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                },
                              }}
                            >
                              <PlayArrowIcon />
                            </IconButton>
                          </Box>
                        )}
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <CardContent sx={{ pb: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              mb: 1,
                            }}
                          >
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Chip
                                label={video.status}
                                size="small"
                                color={
                                  video.status === 'completed'
                                    ? 'success'
                                    : video.status === 'processing'
                                      ? 'info'
                                      : 'error'
                                }
                              />
                              <Chip label={video.resolution} size="small" variant="outlined" />
                            </Stack>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleVideoFavorite(video.id)}
                              color={video.favorite ? 'warning' : 'default'}
                            >
                              {video.favorite ? (
                                <StarIcon fontSize="small" />
                              ) : (
                                <StarBorderIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {video.prompt}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {video.status === 'completed' && (
                              <>
                                <Tooltip title="Download">
                                  <IconButton size="small">
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton size="small">
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {video.status === 'processing' && (
                              <Tooltip title="Cancel">
                                <IconButton size="small">
                                  <StopIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {video.status === 'failed' && (
                              <Tooltip title="Retry">
                                <IconButton size="small">
                                  <RefreshIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Save to assets">
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={video.status !== 'completed'}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </CardContent>
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LazyVideoGenerationSection;
