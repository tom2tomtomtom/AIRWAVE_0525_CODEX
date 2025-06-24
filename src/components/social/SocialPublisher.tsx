import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress} from '@mui/material';
import {
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
  Visibility as PreviewIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
  Close as CloseIcon} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNotification } from '@/contexts/NotificationContext';

interface Platform {
  id: string;
  name: string;
  displayName: string;
  isConnected: boolean;
  accountName?: string;
  status: 'active' | 'expired' | 'error';
}

interface SocialPublisherProps {
  platforms: Platform[];
  onSuccess: () => void;
  onClose?: () => void;
  clientId: string;
  dialog?: boolean;
  initialContent?: {
    text?: string;
    images?: string[];
    video?: string;
    link?: string;
  };
}

interface PostContent {
  text: string;
  images: File[];
  video?: File;
  link?: string;
}

const SocialPublisher: React.FC<SocialPublisherProps> = ({
  platforms,
  onSuccess,
  onClose,
  clientId,
  dialog = false,
  initialContent}) => {
  const { showNotification } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  const [content, setContent] = useState<PostContent>({
    text: initialContent?.text || '',
    images: [],
    video: undefined,
    link: initialContent?.link || ''});
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    platforms.filter((p: any) => p.status === 'active').map((p: any) => p.name)
  );
  
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);

  const characterLimits: Record<string, number> = {
    twitter: 280,
    facebook: 2000,
    instagram: 2200,
    linkedin: 700,
    youtube: 1000};

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <FacebookIcon sx={{ color: '#1877F2' }} />;
      case 'twitter':
        return <TwitterIcon sx={{ color: '#1DA1F2' }} />;
      case 'linkedin':
        return <LinkedInIcon sx={{ color: '#0A66C2' }} />;
      case 'instagram':
        return <InstagramIcon sx={{ color: '#E4405F' }} />;
      case 'youtube':
        return <YouTubeIcon sx={{ color: '#FF0000' }} />;
      default:
        return <Avatar sx={{ width: 24, height: 24 }}>{platform[0].toUpperCase()}</Avatar>;
    }
  };

  const getCharacterCount = (platform: string) => {
    const limit = characterLimits[platform] || 1000;
    const remaining = limit - content.text.length;
    return { limit, remaining, color: remaining < 20 ? 'error' : remaining < 50 ? 'warning' : 'primary' };
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setContent(prev => ({
      ...prev,
      images: [...prev.images, ...files].slice(0, 4), // Max 4 images
    }));
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setContent(prev => ({ ...prev, video: file }));
    }
  };

  const handleRemoveImage = (index: number) => {
    setContent(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)}));
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter((p: any) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleLinkExtraction = async (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    if (urls && urls.length > 0 && !content.link) {
      const url = urls[0];
      setContent(prev => ({ ...prev, link: url }));
      // Simulate link preview fetch
      setTimeout(() => {
        setLinkPreview({
          url,
          title: 'Example Article Title',
          description: 'This is a preview of the linked content...',
          image: '/placeholder-link.jpg'});
      }, 1000);
    }
  };

  const handlePublish = async () => {
    if (!content.text.trim() && content.images.length === 0 && !content.video) {
      showNotification('Please add some content to publish', 'warning');
      return;
    }
    
    if (selectedPlatforms.length === 0) {
      showNotification('Please select at least one platform', 'warning');
      return;
    }

    try {
      setPublishing(true);
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('platforms', JSON.stringify(selectedPlatforms));
      formData.append('content', JSON.stringify({
        text: content.text,
        link: content.link}));

      if (isScheduled && scheduledAt) {
        formData.append('scheduledAt', scheduledAt.toISOString());
      }

      // Add images
      content.images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });

      // Add video
      if (content.video) {
        formData.append('video', content.video);
      }

      const response = await fetch('/api/social/publish', {
        method: 'POST',
        headers: {},
        'Authorization': `Bearer ${localStorage.getItem('token')
      }`,
          'x-client-id': clientId},
        body: formData});

      const result = await response.json();

      if (response.ok) {
        const successful = result.results?.filter((r: any) => r.success).length || 0;
        const failed = result.results?.filter((r: any) => !r.success).length || 0;

        if (successful > 0) {
          showNotification(
            isScheduled
              ? `Post scheduled for ${successful} platform${successful > 1 ? 's' : ''}!`
              : `Post published to ${successful} platform${successful > 1 ? 's' : ''}!`,
            'success'
          );
        }

        if (failed > 0) {
          showNotification(
            `Failed to publish to ${failed} platform${failed > 1 ? 's' : ''}`,
            'warning'
          );
        }

        // Reset form
        setContent({ text: '', images: [], video: undefined, link: '' });
        setSelectedPlatforms(platforms.filter((p: any) => p.status === 'active').map((p: any) => p.name));
        setScheduledAt(null);
        setIsScheduled(false);
        setLinkPreview(null);
        onSuccess();
      } else {
        throw new Error(result.error || 'Failed to publish');
      }
    } catch (error: any) {
      console.error('Error publishing:', error);
      showNotification(
        error instanceof Error ? error.message : 'Failed to publish post',
        'error'
      );
    } finally {
      setPublishing(false);
    }
  };

  const renderContent = () => (
    <Box sx={{ p: dialog ? 0 : 3 }}>
      {/* Platform Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Platforms
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          {platforms.map((platform: any) => (
            <Chip
              key={platform.name}
              icon={getPlatformIcon(platform.name)}
              label={platform.displayName}
              onClick={() => handlePlatformToggle(platform.name)}
              color={selectedPlatforms.includes(platform.name) ? 'primary' : 'default'}
              variant={selectedPlatforms.includes(platform.name) ? 'filled' : 'outlined'}
              disabled={platform.status !== 'active'}
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
      </Box>

      {/* Content Input */}
      <Box sx={{ mb: 3 }}>
        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder="What's on your mind?"
          value={content.text}
          onChange={(e) => {
            setContent(prev => ({ ...prev, text: e.target.value }));
            handleLinkExtraction(e.target.value);
          }}
          variant="outlined"
          sx={{ mb: 2 }}
        />
        
        {/* Character counts for selected platforms */}
        {selectedPlatforms.length > 0 && (
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {selectedPlatforms.map((platform: any) => {
              const { limit, remaining, color } = getCharacterCount(platform);
              return (
    <div>Content</div>
  );
                <Chip
                  key={platform}
                  label={`${platform}: ${remaining}/${limit}`}
                  size="small"
                  color={color as any}
                  variant="outlined"
                />
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Media Upload */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Add Media
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ImageIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={content.images.length >= 4}
          >
            Images ({content.images.length}/4)
          </Button>
          <Button
            variant="outlined"
            startIcon={<VideoIcon />}
            onClick={() => videoInputRef.current?.click()}
            disabled={!!content.video}
          >
            {content.video ? 'Video Added' : 'Video'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<LinkIcon />}
            onClick={() => {
              const url = prompt('Enter URL:');
              if (url) {
                setContent(prev => ({ ...prev, link: url }));
                handleLinkExtraction(url);
              }
            }}
          >
            Link
          </Button>
        </Stack>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleVideoUpload}
        />
      </Box>

      {/* Simplified Media Preview */}
      {(content.images.length > 0 || content.video || linkPreview) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Preview
          </Typography>
          
          {content.images.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {content.images.length} image(s) selected
            </Typography>
          )}
          
          {content.video && (
            <Typography variant="body2" color="text.secondary">
              Video selected
            </Typography>
          )}
          
          {linkPreview && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2">{linkPreview.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {linkPreview.description}
                </Typography>
                <Typography variant="caption" color="primary">
                  {linkPreview.url}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Scheduling */}
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
            />
          }
          label="Schedule for later"
        />
        
        {isScheduled && (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Schedule Date & Time"
              value={scheduledAt}
              onChange={setScheduledAt}
              minDateTime={new Date()}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
        )}
      </Box>

      {publishing && <LinearProgress sx={{ mb: 2 }} />}

      {/* Actions */}
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        {dialog && (
          <Button onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<PreviewIcon />}
          onClick={() => setShowPreview(true)}
          disabled={!content.text.trim() && content.images.length === 0 && !content.video}
        >
          Preview
        </Button>
        <Button
          variant="contained"
          startIcon={isScheduled ? <ScheduleIcon /> : <SendIcon />}
          onClick={handlePublish}
          disabled={publishing || selectedPlatforms.length === 0}
        >
          {publishing ? 'Publishing...' : isScheduled ? 'Schedule Post' : 'Publish Now'}
        </Button>
      </Stack>
    </Box>
  );

  if (dialog) {
    return (
    <div>Content</div>
  );
      <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Create New Post
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {renderContent()}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div>Content</div>
  );
    <Paper elevation={0}>
      {renderContent()}
    </Paper>
  );
};

export default SocialPublisher;