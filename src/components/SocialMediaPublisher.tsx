import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon} from '@mui/material';
import {
  Facebook,
  Twitter,
  LinkedIn,
  Instagram,
  Send,
  Schedule,
  Check,
  Error,
  Link as LinkIcon} from '@mui/icons-material';

interface Platform {
  id: string;
  name: string;
  displayName: string;
  isConnected: boolean;
  accountName?: string;
  status: 'active' | 'expired' | 'error';
}

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

const platformIcons: Record<string, React.ReactElement> = {
  facebook: <Facebook />,
  twitter: <Twitter />,
  linkedin: <LinkedIn />,
  instagram: <Instagram />};

export default function SocialMediaPublisher() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/social/platforms');
      const data = await response.json();

      if (data.success) {
        setPlatforms(data.platforms);
        // Auto-select connected platforms
        setSelectedPlatforms(data?.platforms?.filter((p: Platform) => p.isConnected).map((p: Platform) => p.id));
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to load platforms');
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter((id: any) => id !== platformId)
        : [...prev, platformId]
    );
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      setResults([]);

      const response = await fetch('/api/social/publish', {
        method: 'POST',
        headers: {},
        'Content-Type': 'application/json'
      
      },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          content: {},
  text: content,
            link: link || undefined}})});

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        // Clear form if all successful
        if (data?.summary?.failed === 0) {
          setContent('');
          setLink('');
        }
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to publish content');
    } finally {
      setPublishing(false);
    }
  };

  const connectPlatform = async (platform: string) => {
    try {
      const response = await fetch(`/api/social/auth/${platform}`);
      const data = await response.json();

      if (data.success) {
        // Open OAuth popup
        window.open(data.authUrl, 'oauth', 'width=600,height=600');
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to connect platform');
    }
  };

  if (loading) {
    return (
    <div>Content</div>
  );
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>Content</div>
  );
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Social Media Publisher
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Platform Selection */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Select Platforms
        </Typography>
        <Box display="flex" flexDirection="column" gap={1}>
          {platforms.map((platform: any) => (
            <Box key={platform.id} display="flex" alignItems="center" justifyContent="space-between">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedPlatforms.includes(platform.id)}
                    onChange={() => handlePlatformToggle(platform.id)}
                    disabled={!platform.isConnected}
                  />
                }
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    {platformIcons[platform.id]}
                    <Typography>{platform.displayName}</Typography>
                    {platform.isConnected ? (
                      <Chip label="Connected" color="success" size="small" />
                    ) : (
                      <Chip label="Not Connected" color="error" size="small" />
                    )}
                  </Box>
                }
              />
              {!platform.isConnected && (
                <Button
                  size="small"
                  onClick={() => connectPlatform(platform.id)}
                  variant="outlined"
                >
                  Connect
                </Button>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Content Input */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Content
        </Typography>
        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          placeholder="Add a link (optional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          InputProps={{
            startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} />}}
        />
      </Box>

      {/* Publish Button */}
      <Box display="flex" gap={2} mb={3}>
        <Button
          variant="contained"
          startIcon={publishing ? <CircularProgress size={20} /> : <Send />}
          onClick={handlePublish}
          disabled={publishing || selectedPlatforms.length === 0 || !content.trim()}
        >
          {publishing ? 'Publishing...' : 'Publish Now'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<Schedule />}
          disabled
        >
          Schedule (Coming Soon)
        </Button>
      </Box>

      {/* Results */}
      {results.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Publish Results
          </Typography>
          <List>
            {results.map((result, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {result.success ? (
                    <Check color="success" />
                  ) : (
                    <Error color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`${platforms.find((p: any) => p.id === result.platform)?.displayName || result.platform}`}
                  secondary={
                    result.success
                      ? `Successfully published${result.postId ? ` (ID: ${result.postId})` : ''}`
                      : result.error
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
}