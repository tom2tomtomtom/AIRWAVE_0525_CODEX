import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import { AutoAwesome, Close as CloseIcon, Download, ContentCopy } from '@mui/icons-material';
import axios from 'axios';

interface GeneratedImage {
  asset: { url: string };
  generation_details: {
    original_prompt: string;
    enhanced_prompt?: string;
    revised_prompt?: string;
    model: string;
    settings: {
      size: string;
      quality: string;
      style: string;
    };
  };
}

interface AIImageGeneratorProps {
  clientId: string;
  onImageGenerated?: (asset: GeneratedImage) => void;
  brandGuidelines?: Record<string, unknown>;
}

export const AIImageGenerator: React.FC<AIImageGeneratorProps> = ({
  clientId,
  onImageGenerated,
  brandGuidelines,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // Generation options
  const [options, setOptions] = useState({
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
    purpose: 'general',
    enhance_prompt: true,
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/dalle', {
        prompt,
        client_id: clientId,
        ...options,
        brand_guidelines: brandGuidelines,
        tags: ['ai-generated', options.purpose],
      });
      const data = response.data as { success: boolean; message?: string } & GeneratedImage;

      if (data.success) {
        setGeneratedImage(data as GeneratedImage);
        setShowDialog(true);

        if (onImageGenerated) {
          onImageGenerated(data);
        }
      } else {
        setError(data.message ?? null);
      }
    } catch (err: unknown) {
      console.error('Generation error:', err);
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (generatedImage?.asset?.url) {
      const link = document.createElement('a');
      link.href = generatedImage.asset.url;
      link.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={3}>
          <AutoAwesome sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h5">AI Image Generator (DALL-E 3)</Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Describe the image you want to create"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="A modern office space with natural lighting, minimalist design, and plants..."
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Image Size</InputLabel>
              <Select
                value={options.size}
                onChange={e => setOptions({ ...options, size: e.target.value })}
                disabled={loading}
              >
                <MenuItem value="1024x1024">Square (1024×1024)</MenuItem>
                <MenuItem value="1792x1024">Landscape (1792×1024)</MenuItem>
                <MenuItem value="1024x1792">Portrait (1024×1792)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Purpose</InputLabel>
              <Select
                value={options.purpose}
                onChange={e => setOptions({ ...options, purpose: e.target.value })}
                disabled={loading}
              >
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="hero">Hero Image</MenuItem>
                <MenuItem value="background">Background</MenuItem>
                <MenuItem value="product">Product Shot</MenuItem>
                <MenuItem value="social">Social Media</MenuItem>
                <MenuItem value="banner">Banner</MenuItem>
                <MenuItem value="icon">Icon/Logo</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Quality</InputLabel>
              <Select
                value={options.quality}
                onChange={e => setOptions({ ...options, quality: e.target.value })}
                disabled={loading}
              >
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="hd">HD (costs 2x)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Style</InputLabel>
              <Select
                value={options.style}
                onChange={e => setOptions({ ...options, style: e.target.value })}
                disabled={loading}
              >
                <MenuItem value="vivid">Vivid</MenuItem>
                <MenuItem value="natural">Natural</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={options.enhance_prompt}
                  onChange={e => setOptions({ ...options, enhance_prompt: e.target.checked })}
                  disabled={loading}
                />
              }
              label="AI Enhance Prompt"
            />
          </Grid>

          {error && (
            <Grid item xs={12}>
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </Grid>
          )}

          <Grid item xs={12}>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesome />}
              fullWidth
            >
              {loading ? 'Generating...' : 'Generate Image'}
            </Button>
          </Grid>
        </Grid>

        {/* Result Dialog */}
        <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Generated Image</Typography>
              <IconButton onClick={() => setShowDialog(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {generatedImage && (
              <Box>
                <Box
                  component="img"
                  src={generatedImage.asset.url}
                  alt="Generated image"
                  sx={{
                    width: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: 2,
                    mb: 2,
                  }}
                />

                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Original Prompt:
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {generatedImage.generation_details.original_prompt}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => copyPrompt(generatedImage.generation_details.original_prompt)}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {generatedImage.generation_details.enhanced_prompt && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Enhanced Prompt:
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {generatedImage.generation_details.enhanced_prompt}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() =>
                          copyPrompt(generatedImage.generation_details.enhanced_prompt || '')
                        }
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                )}

                {generatedImage.generation_details.revised_prompt && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      DALL-E Revised Prompt:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {generatedImage.generation_details.revised_prompt}
                    </Typography>
                  </Box>
                )}

                <Box display="flex" gap={1} mt={2}>
                  <Chip label={generatedImage.generation_details.model} size="small" />
                  <Chip label={generatedImage.generation_details.settings.size} size="small" />
                  <Chip label={generatedImage.generation_details.settings.quality} size="small" />
                  <Chip label={generatedImage.generation_details.settings.style} size="small" />
                </Box>

                <Box display="flex" gap={2} mt={3}>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={handleDownload}
                    fullWidth
                  >
                    Download Image
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setShowDialog(false);
                      setPrompt('');
                    }}
                    fullWidth
                  >
                    Generate Another
                  </Button>
                </Box>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
