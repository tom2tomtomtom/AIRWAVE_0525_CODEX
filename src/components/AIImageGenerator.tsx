import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import Image from 'next/image';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: Date;
  saved: boolean;
}

const AIImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState('1024x1024');
  const [selectedStyle, setSelectedStyle] = useState('realistic');
  const [imageCount, setImageCount] = useState(1);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/dalle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          size: selectedSize,
          style: selectedStyle,
          n: imageCount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      const newImages = data.images.map((imageData: { url: string }) => ({
        id: `img-${Date.now()}-${Math.random()}`,
        url: imageData.url,
        prompt,
        createdAt: new Date(),
        saved: false,
      }));

      setGeneratedImages([...newImages, ...generatedImages]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = async (image: GeneratedImage) => {
    try {
      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: image.url,
          type: 'ai-generated',
          metadata: {
            prompt: image.prompt,
            generatedAt: image.createdAt,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save image');
      }

      setGeneratedImages(
        generatedImages.map(img =>
          img.id === image.id ? { ...img, saved: true } : img
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save image');
    }
  };

  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `ai-generated-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDeleteImage = (imageId: string) => {
    setGeneratedImages(generatedImages.filter(img => img.id !== imageId));
  };

  const styles = [
    { value: 'realistic', label: 'Realistic' },
    { value: 'artistic', label: 'Artistic' },
    { value: 'cartoon', label: 'Cartoon' },
    { value: 'abstract', label: 'Abstract' },
    { value: '3d', label: '3D Render' },
  ];

  const sizes = [
    { value: '1024x1024', label: 'Square (1024x1024)' },
    { value: '1792x1024', label: 'Landscape (1792x1024)' },
    { value: '1024x1792', label: 'Portrait (1024x1792)' },
  ];

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI Image Generator
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Enter your prompt"
              placeholder="Describe the image you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Style"
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              disabled={isGenerating}
              SelectProps={{ native: true }}
            >
              {styles.map(style => (
                <option key={style.value} value={style.value}>
                  {style.label}
                </option>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Size"
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              disabled={isGenerating}
              SelectProps={{ native: true }}
            >
              {sizes.map(size => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              type="number"
              fullWidth
              label="Number of Images"
              value={imageCount}
              onChange={(e) => setImageCount(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))}
              disabled={isGenerating}
              inputProps={{ min: 1, max: 4 }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              startIcon={isGenerating ? <CircularProgress size={20} /> : <RefreshIcon />}
            >
              {isGenerating ? 'Generating...' : 'Generate Images'}
            </Button>
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Paper>

      {generatedImages.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Generated Images
          </Typography>
          
          <Grid container spacing={2}>
            {generatedImages.map(image => (
              <Grid item xs={12} sm={6} md={4} key={image.id}>
                <Card>
                  <CardMedia
                    component="div"
                    sx={{ position: 'relative', paddingTop: '100%' }}
                  >
                    <Image
                      src={image.url}
                      alt={image.prompt}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </CardMedia>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {image.prompt}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Generated {image.createdAt.toLocaleString()}
                    </Typography>
                    {image.saved && (
                      <Chip
                        label="Saved"
                        color="success"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </CardContent>
                  <CardActions>
                    <IconButton
                      size="small"
                      onClick={() => handleSaveImage(image)}
                      disabled={image.saved}
                      title="Save to assets"
                    >
                      <SaveIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(image)}
                      title="Download"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleCopyPrompt(image.prompt)}
                      title="Copy prompt"
                    >
                      <CopyIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteImage(image.id)}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default AIImageGenerator;