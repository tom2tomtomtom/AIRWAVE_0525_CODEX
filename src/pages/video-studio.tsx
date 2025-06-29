import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import TemplateSelector from '@/components/video-studio/TemplateSelector';
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
  Chip,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Slider,
  Avatar,
  Divider,
} from '@mui/material';
import {
  VideoLibrary,
  Settings,
  ExpandMore,
  Refresh,
  Download,
  Share,
  Edit,
  CheckCircle,
  Schedule,
  Error as ErrorIcon,
  AutoAwesome,
  Palette,
  MusicNote,
} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';

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

interface VideoJob {
  id: string;
  generation_id: string;
  variation_index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  render_job_id?: string;
  estimated_completion?: string;
  output_url?: string;
  thumbnail_url?: string;
  created_at: string;
  error_message?: string;
}

interface VideoConfig {
  prompt: string;
  style: string;
  duration: number;
  resolution: string;
  platform?: string;
  aspect_ratio: string;
  template_id?: string;
}

interface ContentElements {
  text_overlays: Array<{
    text: string;
    position: 'top' | 'center' | 'bottom';
    style?: string;
    duration?: number;
  }>;
  background_music: boolean;
  voice_over?: {
    text: string;
    voice: string;
    language: string;
  };
  brand_elements?: {
    logo_url?: string;
    color_scheme?: string[];
    font_family?: string;
  };
}

const VideoStudioPage: React.FC = () => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();

  // State management
  const [activeStep, setActiveStep] = useState(0);
  const [_loading, _setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  // Configuration state
  const [videoConfig, setVideoConfig] = useState<VideoConfig>({
    prompt: '',
    style: 'commercial',
    duration: 15,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });

  const [contentElements, setContentElements] = useState<ContentElements>({
    text_overlays: [],
    background_music: true,
    ...(activeClient && {
      brand_elements: {
        logo_url: activeClient.logo,
        color_scheme: [activeClient.primaryColor, activeClient.secondaryColor],
      },
    }),
  });

  const [generationSettings, setGenerationSettings] = useState({
    variations_count: 1,
    include_captions: false,
    auto_optimize_for_platform: true,
    save_to_assets: true,
  });

  // Mock templates data
  const mockTemplates: VideoTemplate[] = [
    {
      id: 'template-1',
      name: 'Social Media Promo',
      description: 'Perfect for social media campaigns with dynamic text and animations',
      thumbnail: 'https://via.placeholder.com/300x169/4f46e5/ffffff?text=Social+Promo',
      duration: 15,
      aspect_ratio: '16:9',
      platform: ['instagram', 'facebook', 'youtube'],
      category: 'Social Media',
      tags: ['promo', 'social', 'dynamic'],
    },
    {
      id: 'template-2',
      name: 'Product Showcase',
      description: 'Showcase your products with elegant transitions and branding',
      thumbnail: 'https://via.placeholder.com/300x169/e91e63/ffffff?text=Product+Showcase',
      duration: 20,
      aspect_ratio: '16:9',
      platform: ['youtube', 'linkedin', 'facebook'],
      category: 'Product',
      tags: ['product', 'showcase', 'elegant'],
    },
    {
      id: 'template-3',
      name: 'TikTok Vertical',
      description: 'Vertical format optimized for TikTok and Instagram Stories',
      thumbnail: 'https://via.placeholder.com/169x300/ff9800/ffffff?text=TikTok+Vertical',
      duration: 10,
      aspect_ratio: '9:16',
      platform: ['tiktok', 'instagram'],
      category: 'Vertical',
      tags: ['vertical', 'tiktok', 'stories'],
    },
    {
      id: 'template-4',
      name: 'Corporate Presentation',
      description: 'Professional template for corporate communications',
      thumbnail: 'https://via.placeholder.com/300x169/2196f3/ffffff?text=Corporate',
      duration: 30,
      aspect_ratio: '16:9',
      platform: ['linkedin', 'youtube'],
      category: 'Corporate',
      tags: ['corporate', 'professional', 'presentation'],
    },
  ];

  useEffect(() => {
    setTemplates(mockTemplates);
  }, []);

  // Update brand elements when client changes
  useEffect(() => {
    if (activeClient) {
      setContentElements(prev => ({
        ...prev,
        brand_elements: {
          logo_url: activeClient.logo,
          color_scheme: [activeClient.primaryColor, activeClient.secondaryColor],
        },
      }));
    }
  }, [activeClient]);

  // Generate video
  const handleGenerateVideo = async () => {
    if (!activeClient) {
      showNotification('Please select a client first', 'error');
      return;
    }

    if (!videoConfig.prompt.trim()) {
      showNotification('Please provide a video prompt', 'error');
      return;
    }

    setGenerating(true);
    try {
      const requestData = {
        type: 'standalone',
        template_id: selectedTemplate?.id,
        video_config: videoConfig,
        content_elements: contentElements,
        generation_settings: generationSettings,
      };

      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.data) {
        const newJobs: VideoJob[] = result.data.jobs.map((job: any) => ({
          id: job.job_id,
          generation_id: result.data.generation_id,
          variation_index: job.variation_index || 1,
          status: job.status,
          progress: 0,
          render_job_id: job.render_job_id,
          estimated_completion: job.estimated_completion,
          created_at: new Date().toISOString(),
        }));

        setVideoJobs(prev => [...prev, ...newJobs]);
        setActiveStep(3); // Move to monitoring step
        showNotification(`Started generation of ${newJobs.length} video(s)`, 'success');
      } else {
        throw new Error(result.error || 'Failed to start video generation');
      }
    } catch (error: any) {
      showNotification('Failed to generate video. Please try again.', 'error');
      console.error('Video generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  // Refresh job status
  const refreshJobStatus = async () => {
    if (videoJobs.length === 0) return;

    try {
      const activeJobs = videoJobs.filter(
        (job: any) => job.status === 'pending' || job.status === 'processing'
      );

      for (const job of activeJobs) {
        const response = await fetch(`/api/video/status?job_id=${job.id}`);
        const result = await response.json();

        if (result.success) {
          setVideoJobs(prev =>
            prev.map((j: any) => (j.id === job.id ? { ...j, ...result.job } : j))
          );
        }
      }
    } catch (error: any) {
      console.error('Error refreshing job status:', error);
    }
  };

  // Auto-refresh job status
  useEffect(() => {
    const interval = setInterval(() => {
      refreshJobStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [videoJobs]);

  const steps = ['Select Template', 'Configure Video', 'Customize Content', 'Generate & Monitor'];

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
    <>
      <Head>
        <title>Video Studio | AIRFLOW</title>
      </Head>
      <DashboardLayout title="Video Studio">
        <Box sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <VideoLibrary sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
              AI Video Studio
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Create professional videos using AI-powered templates and customization
          </Typography>
        </Box>

        {!activeClient && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Please select a client to begin video creation.
          </Alert>
        )}

        {activeClient && (
          <Grid container spacing={3}>
            {/* Progress Stepper */}
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Stepper activeStep={activeStep} orientation="horizontal">
                  {steps.map((label, _index) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Paper>
            </Grid>

            {/* Main Content */}
            <Grid size={{ xs: 12, md: 8 }}>
              {/* Step 0: Template Selection */}
              {activeStep === 0 && (
                <TemplateSelector
                  templates={templates}
                  selectedTemplate={selectedTemplate}
                  onTemplateSelect={setSelectedTemplate}
                  onContinue={() => setActiveStep(1)}
                />
              )}

              {/* Step 1: Configure Video */}
              {activeStep === 1 && (
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
                          onChange={e => setVideoConfig({ ...videoConfig, prompt: e.target.value })}
                          required
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <FormControl fullWidth>
                          <InputLabel>Video Style</InputLabel>
                          <Select
                            value={videoConfig.style}
                            label="Video Style"
                            onChange={e =>
                              setVideoConfig({ ...videoConfig, style: e.target.value })
                            }
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
                            onChange={e => {
                              const platform = e.target.value;
                              setVideoConfig({
                                ...videoConfig,
                                platform,
                                aspect_ratio: getAspectRatioForPlatform(platform),
                              });
                            }}
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
                            onChange={e =>
                              setVideoConfig({ ...videoConfig, resolution: e.target.value })
                            }
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
                            onChange={e =>
                              setVideoConfig({ ...videoConfig, aspect_ratio: e.target.value })
                            }
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
                            onChange={(_, value) =>
                              setVideoConfig({ ...videoConfig, duration: value as number })
                            }
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
                      <Button
                        variant="contained"
                        onClick={() => setActiveStep(2)}
                        disabled={!videoConfig.prompt.trim()}
                      >
                        Continue to Customization
                      </Button>
                      <Button variant="outlined" onClick={() => setActiveStep(0)}>
                        Back to Templates
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Customize Content */}
              {activeStep === 2 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Customize Content Elements
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Add text overlays, voice-over, and brand elements to your video
                    </Typography>

                    <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                      <Tab label="Text Overlays" icon={<Edit />} />
                      <Tab label="Audio" icon={<MusicNote />} />
                      <Tab label="Branding" icon={<Palette />} />
                      <Tab label="Settings" icon={<Settings />} />
                    </Tabs>

                    <Box sx={{ mt: 3 }}>
                      {/* Text Overlays Tab */}
                      {activeTab === 0 && (
                        <Box>
                          <Typography variant="subtitle1" gutterBottom>
                            Text Overlays
                          </Typography>

                          {contentElements.text_overlays.length === 0 ? (
                            <Paper sx={{ p: 3, textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary" paragraph>
                                No text overlays added yet
                              </Typography>
                              <Button
                                variant="outlined"
                                onClick={() => {
                                  setContentElements({
                                    ...contentElements,
                                    text_overlays: [
                                      ...contentElements.text_overlays,
                                      {
                                        text: '',
                                        position: 'center',
                                      },
                                    ],
                                  });
                                }}
                              >
                                Add Text Overlay
                              </Button>
                            </Paper>
                          ) : (
                            <Box>
                              {contentElements.text_overlays.map((overlay, index) => (
                                <Accordion key={index}>
                                  <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Typography>
                                      Text Overlay {index + 1}: {overlay.text || 'Untitled'}
                                    </Typography>
                                  </AccordionSummary>
                                  <AccordionDetails>
                                    <Grid container spacing={2}>
                                      <Grid size={{ xs: 12, md: 8 }}>
                                        <TextField
                                          fullWidth
                                          label="Text"
                                          value={overlay.text}
                                          onChange={e => {
                                            const updatedOverlays = [
                                              ...contentElements.text_overlays,
                                            ];
                                            updatedOverlays[index] = {
                                              ...overlay,
                                              text: e.target.value,
                                            };
                                            setContentElements({
                                              ...contentElements,
                                              text_overlays: updatedOverlays,
                                            });
                                          }}
                                        />
                                      </Grid>
                                      <Grid size={{ xs: 12, md: 4 }}>
                                        <FormControl fullWidth>
                                          <InputLabel>Position</InputLabel>
                                          <Select
                                            value={overlay.position}
                                            label="Position"
                                            onChange={e => {
                                              const updatedOverlays = [
                                                ...contentElements.text_overlays,
                                              ];
                                              updatedOverlays[index] = {
                                                ...overlay,
                                                position: e.target.value as
                                                  | 'top'
                                                  | 'center'
                                                  | 'bottom',
                                              };
                                              setContentElements({
                                                ...contentElements,
                                                text_overlays: updatedOverlays,
                                              });
                                            }}
                                          >
                                            <MenuItem value="top">Top</MenuItem>
                                            <MenuItem value="center">Center</MenuItem>
                                            <MenuItem value="bottom">Bottom</MenuItem>
                                          </Select>
                                        </FormControl>
                                      </Grid>
                                      <Grid size={{ xs: 12 }}>
                                        <Button
                                          color="error"
                                          onClick={() => {
                                            const updatedOverlays =
                                              contentElements.text_overlays.filter(
                                                (_, i) => i !== index
                                              );
                                            setContentElements({
                                              ...contentElements,
                                              text_overlays: updatedOverlays,
                                            });
                                          }}
                                        >
                                          Remove Overlay
                                        </Button>
                                      </Grid>
                                    </Grid>
                                  </AccordionDetails>
                                </Accordion>
                              ))}
                              <Button
                                variant="outlined"
                                sx={{ mt: 2 }}
                                onClick={() => {
                                  setContentElements({
                                    ...contentElements,
                                    text_overlays: [
                                      ...contentElements.text_overlays,
                                      {
                                        text: '',
                                        position: 'center',
                                      },
                                    ],
                                  });
                                }}
                              >
                                Add Another Overlay
                              </Button>
                            </Box>
                          )}
                        </Box>
                      )}

                      {/* Audio Tab */}
                      {activeTab === 1 && (
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={contentElements.background_music}
                                  onChange={e =>
                                    setContentElements({
                                      ...contentElements,
                                      background_music: e.target.checked,
                                    })
                                  }
                                />
                              }
                              label="Include Background Music"
                            />
                          </Grid>

                          <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={!!contentElements.voice_over}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setContentElements({
                                        ...contentElements,
                                        voice_over: {
                                          text: videoConfig.prompt,
                                          voice: 'neural',
                                          language: 'en',
                                        },
                                      });
                                    } else {
                                      const { voice_over, ...elementsWithoutVoiceOver } =
                                        contentElements;
                                      setContentElements(elementsWithoutVoiceOver);
                                    }
                                  }}
                                />
                              }
                              label="Include Voice Over"
                            />
                          </Grid>

                          {contentElements.voice_over && (
                            <>
                              <Grid size={{ xs: 12 }}>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={3}
                                  label="Voice Over Text"
                                  value={contentElements.voice_over.text}
                                  onChange={e =>
                                    setContentElements({
                                      ...contentElements,
                                      voice_over: {
                                        ...contentElements.voice_over!,
                                        text: e.target.value,
                                      },
                                    })
                                  }
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl fullWidth>
                                  <InputLabel>Voice</InputLabel>
                                  <Select
                                    value={contentElements.voice_over.voice}
                                    label="Voice"
                                    onChange={e =>
                                      setContentElements({
                                        ...contentElements,
                                        voice_over: {
                                          ...contentElements.voice_over!,
                                          voice: e.target.value,
                                        },
                                      })
                                    }
                                  >
                                    <MenuItem value="neural">Neural (Default)</MenuItem>
                                    <MenuItem value="male">Male</MenuItem>
                                    <MenuItem value="female">Female</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl fullWidth>
                                  <InputLabel>Language</InputLabel>
                                  <Select
                                    value={contentElements.voice_over.language}
                                    label="Language"
                                    onChange={e =>
                                      setContentElements({
                                        ...contentElements,
                                        voice_over: {
                                          ...contentElements.voice_over!,
                                          language: e.target.value,
                                        },
                                      })
                                    }
                                  >
                                    <MenuItem value="en">English</MenuItem>
                                    <MenuItem value="es">Spanish</MenuItem>
                                    <MenuItem value="fr">French</MenuItem>
                                    <MenuItem value="de">German</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            </>
                          )}
                        </Grid>
                      )}

                      {/* Branding Tab */}
                      {activeTab === 2 && (
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle1" gutterBottom>
                              Brand Elements
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                              Customize how your brand appears in the video
                            </Typography>
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                              fullWidth
                              label="Logo URL"
                              value={contentElements.brand_elements?.logo_url || ''}
                              onChange={e =>
                                setContentElements({
                                  ...contentElements,
                                  brand_elements: {
                                    ...contentElements.brand_elements,
                                    logo_url: e.target.value,
                                  },
                                })
                              }
                              placeholder="https://example.com/logo.png"
                            />
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                              fullWidth
                              label="Font Family"
                              value={contentElements.brand_elements?.font_family || ''}
                              onChange={e =>
                                setContentElements({
                                  ...contentElements,
                                  brand_elements: {
                                    ...contentElements.brand_elements,
                                    font_family: e.target.value,
                                  },
                                })
                              }
                              placeholder="Arial, Helvetica, sans-serif"
                            />
                          </Grid>

                          {activeClient && (
                            <Grid size={{ xs: 12 }}>
                              <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="body2">Brand Colors:</Typography>
                                <Box
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    bgcolor: activeClient.primaryColor,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                  }}
                                />
                                <Box
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    bgcolor: activeClient.secondaryColor,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                  }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  (From client settings)
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      )}

                      {/* Settings Tab */}
                      {activeTab === 3 && (
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle1" gutterBottom>
                              Generation Settings
                            </Typography>
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <Box>
                              <Typography gutterBottom>
                                Variations: {generationSettings.variations_count}
                              </Typography>
                              <Slider
                                value={generationSettings.variations_count}
                                onChange={(_, value) =>
                                  setGenerationSettings({
                                    ...generationSettings,
                                    variations_count: value as number,
                                  })
                                }
                                min={1}
                                max={5}
                                step={1}
                                marks={[
                                  { value: 1, label: '1' },
                                  { value: 3, label: '3' },
                                  { value: 5, label: '5' },
                                ]}
                              />
                            </Box>
                          </Grid>

                          <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={generationSettings.include_captions}
                                  onChange={e =>
                                    setGenerationSettings({
                                      ...generationSettings,
                                      include_captions: e.target.checked,
                                    })
                                  }
                                />
                              }
                              label="Include Captions"
                            />
                          </Grid>

                          <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={generationSettings.auto_optimize_for_platform}
                                  onChange={e =>
                                    setGenerationSettings({
                                      ...generationSettings,
                                      auto_optimize_for_platform: e.target.checked,
                                    })
                                  }
                                />
                              }
                              label="Auto-optimize for Platform"
                            />
                          </Grid>

                          <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={generationSettings.save_to_assets}
                                  onChange={e =>
                                    setGenerationSettings({
                                      ...generationSettings,
                                      save_to_assets: e.target.checked,
                                    })
                                  }
                                />
                              }
                              label="Save to Assets Library"
                            />
                          </Grid>
                        </Grid>
                      )}
                    </Box>

                    <Box mt={3} display="flex" gap={2}>
                      <Button
                        variant="contained"
                        onClick={handleGenerateVideo}
                        disabled={generating}
                        startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesome />}
                      >
                        {generating ? 'Generating...' : 'Generate Video'}
                      </Button>
                      <Button variant="outlined" onClick={() => setActiveStep(1)}>
                        Back to Configuration
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Generate & Monitor */}
              {activeStep === 3 && (
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                      <Typography variant="h6">Video Generation Progress</Typography>
                      <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={refreshJobStatus}
                        disabled={generating}
                      >
                        Refresh Status
                      </Button>
                    </Box>

                    {videoJobs.length === 0 ? (
                      <Alert severity="info">
                        No video generation jobs yet. Go back to configure and generate your first
                        video.
                      </Alert>
                    ) : (
                      <List>
                        {videoJobs.map((job: any) => (
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
                                    <LinearProgress
                                      variant="determinate"
                                      value={job.progress}
                                      sx={{ mt: 1 }}
                                    />
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
                              <Chip
                                size="small"
                                label={job.status}
                                color={getStatusColor(job.status) as any}
                              />
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
                      <Button variant="outlined" onClick={() => setActiveStep(0)}>
                        Create Another Video
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Grid>

            {/* Sidebar */}
            <Grid size={{ xs: 12, md: 4 }}>
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
                          src={activeClient.logo}
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
                    <Typography variant="body2">
                      Aspect Ratio: {videoConfig.aspect_ratio}
                    </Typography>
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
            </Grid>
          </Grid>
        )}
      </DashboardLayout>
    </>
  );
};

// Helper function to get aspect ratio for platform
const getAspectRatioForPlatform = (platform: string): string => {
  const platformRatios: Record<string, string> = {
    youtube: '16:9',
    instagram: '1:1',
    tiktok: '9:16',
    facebook: '16:9',
    linkedin: '16:9',
    twitter: '16:9',
  };
  return platformRatios[platform] || '16:9';
};

export default VideoStudioPage;
