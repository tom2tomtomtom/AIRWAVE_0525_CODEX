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
  FormHelperText,
} from '@mui/material';
import {
  AutoAwesome,
  Close as CloseIcon,
  Download,
  ContentCopy,
  Info as InfoIcon,
} from '@mui/icons-material';
import axios, { AxiosError } from 'axios';
import { Asset, BrandGuidelines } from '@/types/models';
import { demoAssets } from '@/utils/demoData';

// Define the response type for generated images
interface GeneratedImageResponse {
  success: boolean;
  message?: string;
  asset: Asset;
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
  onImageGenerated?: (asset: Asset) => void;
  brandGuidelines?: BrandGuidelines;
}

export const AIImageGenerator: React.FC<AIImageGeneratorProps> = ({
  clientId,
  onImageGenerated,
  brandGuidelines,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageResponse | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  
  // Generation options
  const [options, setOptions] = useState({
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
    purpose: 'general',
    enhance_prompt: true,
  });

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const hasApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || false;

  const validateInput = (): string[] => {
    const errors: string[] = [];
    
    if (!prompt || prompt.trim().length === 0) {
      errors.push('Please enter a description for your image');
    } else if (prompt.trim().length < 3) {
      errors.push('Description must be at least 3 characters long');
    } else if (prompt.trim().length > 1000) {
      errors.push('Description must be less than 1000 characters');
    }
    
    // Check for inappropriate content
    const bannedWords = ['explicit', 'violence', 'gore']; // Add more as needed
    const lowerPrompt = prompt.toLowerCase();
    if (bannedWords.some(word => lowerPrompt.includes(word))) {
      errors.push('Your prompt contains inappropriate content');
    }
    
    return errors;
  };

  const handleGenerate = async () => {
    // Clear previous errors
    setError(null);
    setValidationError(null);

    // Validate input
    const validationErrors = validateInput();
    if (validationErrors.length > 0) {
      setValidationError(validationErrors.join('. '));
      return;
    }

    setLoading(true);

    try {
      // Demo mode - return a random demo image
      if (isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
        
        const demoImage = demoAssets[Math.floor(Math.random() * 3)]; // Random AI generated asset
        const response: GeneratedImageResponse = {
          success: true,
          asset: {
            ...demoImage,
            name: `AI Generated - ${prompt.substring(0, 50)}...`,
            ai_prompt: prompt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Asset,
          generation_details: {
            original_prompt: prompt,
            enhanced_prompt: isDemoMode ? `[DEMO MODE] Enhanced: ${prompt}` : undefined,
            model: 'dall-e-3',
            settings: {
              size: options.size,
              quality: options.quality,
              style: options.style,
            },
          },
        };
        
        setGeneratedImage(response);
        setShowDialog(true);
        
        if (onImageGenerated) {
          onImageGenerated(response.asset);
        }
        return;
      }

      // Check for API key
      if (!hasApiKey) {
        setError('OpenAI API key is not configured. Please add NEXT_PUBLIC_OPENAI_API_KEY to your environment variables.');
        return;
      }

      // Make actual API call
      const response = await axios.post<GeneratedImageResponse>('/api/dalle', {
        prompt,
        client_id: clientId,
        ...options,
        brand_guidelines: brandGuidelines,
        tags: ['ai-generated', options.purpose],
      });

      if (response.data.success) {
        setGeneratedImage(response.data);
        setShowDialog(true);
        
        if (onImageGenerated) {
          onImageGenerated(response.data.asset);
        }
      } else {
        setError(response.data.message || 'Failed to generate image');
      }
    } catch (err) {
      console.error('Generation error:', err);
      
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<{ message?: string; error?: string }>;
        
        // Specific error messages based on status codes
        if (axiosError.response?.status === 401) {
          setError('Invalid API key. Please check your OpenAI API key configuration.');
        } else if (axiosError.response?.status === 429) {
          setError('Rate limit exceeded. Please try again in a few moments.');
        } else if (axiosError.response?.status === 400) {
          setError(axiosError.response?.data?.message || 'Invalid request. Please check your prompt and try again.');
        } else {
          setError(
            axiosError.response?.data?.message || 
            axiosError.response?.data?.error ||
            'Failed to generate image. Please try again.'
          );
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (generatedImage?.asset?.file_url) {
      const link = document.createElement('a');
      link.href = generatedImage.asset.file_url;
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
          {isDemoMode && (
            <Chip 
              label="DEMO MODE" 
              size="small" 
              color="info" 
              sx={{ ml: 2 }}
            />
          )}
        </Box>

        {isDemoMode && (
          <Alert severity="info" sx={{ mb: 3 }} icon={<InfoIcon />}>
            You're in demo mode. Generated images will be sample images for demonstration purposes.
          </Alert>
        )}

        {!hasApiKey && !isDemoMode && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            OpenAI API key is not configured. Add NEXT_PUBLIC_OPENAI_API_KEY to your .env file to enable image generation.
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Describe the image you want to create"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setValidationError(null); // Clear validation error on change
              }}
              placeholder="A modern office space with natural lighting, minimalist design, and plants..."
              disabled={loading}
              error={!!validationError}
              helperText={validationError || `${prompt.length}/1000 characters`}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Image Size</InputLabel>
              <Select
                value={options.size}
                onChange={(e) => setOptions({ ...options, size: e.target.value })}
                disabled={loading}
              >
                <MenuItem value="1024x1024">Square (1024×1024)</MenuItem>
                <MenuItem value="1792x1024">Landscape (1792×1024)</MenuItem>
                <MenuItem value="1024x1792">Portrait (1024×1792)</MenuItem>
              </Select>
              <FormHelperText>Choose based on your intended use</FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Purpose</InputLabel>
              <Select
                value={options.purpose}
                onChange={(e) => setOptions({ ...options, purpose: e.target.value })}
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
              <FormHelperText>Helps categorize your generated images</FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Quality</InputLabel>
              <Select
                value={options.quality}
                onChange={(e) => setOptions({ ...options, quality: e.target.value })}
                disabled={loading}
              >
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="hd">HD (2x cost)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Style</InputLabel>
              <Select
                value={options.style}
                onChange={(e) => setOptions({ ...options, style: e.target.value })}
                disabled={loading}
              >
                <MenuItem value="vivid">Vivid (More artistic)</MenuItem>
                <MenuItem value="natural">Natural (More realistic)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={options.enhance_prompt}
                  onChange={(e) => setOptions({ ...options, enhance_prompt: e.target.checked })}
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
        <Dialog
          open={showDialog}
          onClose={() => setShowDialog(false)}
          maxWidth="lg"
          fullWidth
        >
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
                  src={generatedImage.asset.file_url}
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
                        onClick={() => {
                          if (generatedImage.generation_details.enhanced_prompt) {
                            copyPrompt(generatedImage.generation_details.enhanced_prompt);
                          }
                        }}
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
                  {isDemoMode && <Chip label="DEMO" size="small" color="info" />}
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

export default AIImageGenerator;
