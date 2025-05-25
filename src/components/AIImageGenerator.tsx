import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Paper,
  CircularProgress,
  IconButton,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { AutoAwesome, Close, Download } from '@mui/icons-material';
import axios from 'axios';
import { useClient } from '@/contexts/ClientContext';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage, { getUserFriendlyErrorMessage } from './ErrorMessage';

interface AIImageGeneratorProps {
  clientId: string;
  onImageGenerated?: (asset: any) => void;
  onClose?: () => void;
}

const AIImageGenerator: React.FC<AIImageGeneratorProps> = ({
  clientId,
  onImageGenerated,
  onClose,
}) => {
  const { activeClient } = useClient();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<any>(null);
  
  // DALL-E 3 Settings
  const [size, setSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [style, setStyle] = useState<'vivid' | 'natural'>('vivid');
  const [purpose, setPurpose] = useState<string>('social');
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const response = await axios.post('/api/dalle', {
        prompt,
        client_id: clientId,
        model: 'dall-e-3',
        size,
        quality,
        style,
        n: 1,
        purpose,
        tags,
        enhance_prompt: enhancePrompt,
        brand_guidelines: activeClient?.brandGuidelines,
      }, {
        headers: {
          'x-user-id': 'current-user', // In real app, get from auth
          'x-demo-mode': process.env.NEXT_PUBLIC_DEMO_MODE || 'false',
        },
      });

      if (response.data.success) {
        setGeneratedImage(response.data.asset);
        if (onImageGenerated) {
          onImageGenerated(response.data.asset);
        }
      } else {
        setError(response.data.message || 'Failed to generate image');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(getUserFriendlyErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleDownload = () => {
    if (generatedImage?.url) {
      window.open(generatedImage.url, '_blank');
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" display="flex" alignItems="center" gap={1}>
          <AutoAwesome color="primary" />
          AI Image Generator (DALL-E 3)
        </Typography>
        {onClose && (
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        )}
      </Box>

      {error && (
        <ErrorMessage
          title="Generation Failed"
          message={error}
          variant="inline"
          onRetry={() => setError(null)}
        />
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Box>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Describe your image"
              placeholder="A modern office space with natural lighting, minimalist design..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              sx={{ mb: 2 }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Size</InputLabel>
                  <Select value={size} onChange={(e) => setSize(e.target.value as any)}>
                    <MenuItem value="1024x1024">Square (1024x1024)</MenuItem>
                    <MenuItem value="1792x1024">Landscape (1792x1024)</MenuItem>
                    <MenuItem value="1024x1792">Portrait (1024x1792)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Purpose</InputLabel>
                  <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    <MenuItem value="hero">Hero Image</MenuItem>
                    <MenuItem value="background">Background</MenuItem>
                    <MenuItem value="product">Product</MenuItem>
                    <MenuItem value="social">Social Media</MenuItem>
                    <MenuItem value="banner">Banner</MenuItem>
                    <MenuItem value="icon">Icon</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Quality</InputLabel>
                  <Select value={quality} onChange={(e) => setQuality(e.target.value as any)}>
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="hd">HD (2x cost)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Style</InputLabel>
                  <Select value={style} onChange={(e) => setStyle(e.target.value as any)}>
                    <MenuItem value="vivid">Vivid</MenuItem>
                    <MenuItem value="natural">Natural</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enhancePrompt}
                      onChange={(e) => setEnhancePrompt(e.target.checked)}
                    />
                  }
                  label="Enhance prompt with AI"
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={1} alignItems="center">
                  <TextField
                    size="small"
                    placeholder="Add tags..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="small" onClick={handleAddTag}>Add</Button>
                </Box>
                <Box mt={1} display="flex" flexWrap="wrap" gap={0.5}>
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onDelete={() => handleRemoveTag(tag)}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              startIcon={isGenerating ? <CircularProgress size={20} /> : <AutoAwesome />}
              sx={{ mt: 3 }}
            >
              {isGenerating ? 'Generating...' : 'Generate Image'}
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box
            sx={{
              height: 400,
              bgcolor: 'grey.100',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isGenerating ? (
              <LoadingSpinner message="Creating your image..." />
            ) : generatedImage ? (
              <>
                <img
                  src={generatedImage.url}
                  alt={generatedImage.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
                <IconButton
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'background.paper',
                  }}
                  onClick={handleDownload}
                >
                  <Download />
                </IconButton>
              </>
            ) : (
              <Box textAlign="center" color="text.secondary">
                <AutoAwesome sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">
                  Your generated image will appear here
                </Typography>
              </Box>
            )}
          </Box>

          {generatedImage && (
            <Box mt={2}>
              <Alert severity="success">
                Image generated successfully! It has been saved to your asset library.
              </Alert>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Revised prompt: {generatedImage.metadata?.revised_prompt}
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
};

export { AIImageGenerator };
export default AIImageGenerator;
