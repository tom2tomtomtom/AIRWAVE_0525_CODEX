import React from 'react';
import { Box, Typography, Button, Avatar, Stack, Chip } from '@mui/material';
import {
  CloudUpload,
  VideoLibrary,
  Image,
  Campaign,
  Analytics,
  Group,
  Add,
  PlayArrow,
  AutoAwesome,
  Lightbulb,
  TrendingUp,
  Search} from '@mui/icons-material';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'contained' | 'outlined';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: string[];
  illustration?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  suggestions = [],
  illustration}) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    textAlign="center"
    py={8}
    px={3}
  >
    {illustration || (
      <Avatar
        sx={{
          width: 80,
          height: 80,
          bgcolor: 'primary.light',
          mb: 3 }}
      >
        {icon}
      </Avatar>
    )}

    <Typography variant="h5" gutterBottom fontWeight={500}>
      {title}
    </Typography>

    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>
      {description}
    </Typography>

    {suggestions.length > 0 && (
      <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mb: 4 }}>
        {suggestions.map((suggestion, index) => (
          <Chip
            key={index}
            label={suggestion}
            variant="outlined"
            size="small"
            icon={<Lightbulb />}
          />
        ))}
      </Stack>
    )}

    <Stack direction="row" spacing={2}>
      {primaryAction && (
        <Button
          variant={primaryAction.variant || 'contained'}
          size="large"
          onClick={primaryAction.onClick}
          startIcon={<Add />}
        >
          {primaryAction.label}
        </Button>
      )}

      {secondaryAction && (
        <Button variant="outlined" size="large" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </Button>
      )}
    </Stack>
  </Box>
);

// Predefined empty states for common scenarios
export const EmptyBriefs: React.FC<{ onCreateBrief: () => void; onStartWorkflow: () => void }> = ({
  onCreateBrief,
  onStartWorkflow}) => (
  <EmptyState
    icon={<CloudUpload sx={{ fontSize: 40 }} />}
    title="No briefs yet"
    description="Start by uploading a brief document or creating one from scratch. Our AI will help you transform it into amazing video content."
    primaryAction={{
      label: 'Start Workflow',
      onClick: onStartWorkflow }}
    secondaryAction={{
      label: 'Create Brief',
      onClick: onCreateBrief }}
    suggestions={[
      'Upload PDF or Word docs',
      'AI extracts key information',
      'Guided step-by-step process',
    ]}
  />
);

export const EmptyAssets: React.FC<{
  onUploadAssets: () => void;
  onGenerateAssets: () => void;
}> = ({ onUploadAssets, onGenerateAssets }) => (
  <EmptyState
    icon={<Image sx={{ fontSize: 40 }} />}
    title="No assets in your library"
    description="Upload images, videos, and other media files, or let AI generate custom assets for your campaigns."
    primaryAction={{
      label: 'Upload Assets',
      onClick: onUploadAssets }}
    secondaryAction={{
      label: 'Generate with AI',
      onClick: onGenerateAssets }}
    suggestions={['Drag & drop files', 'AI-generated images', 'Organize with tags']}
  />
);

export const EmptyTemplates: React.FC<{
  onBrowseTemplates: () => void;
  onCreateTemplate: () => void;
}> = ({ onBrowseTemplates, onCreateTemplate }) => (
  <EmptyState
    icon={<VideoLibrary sx={{ fontSize: 40 }} />}
    title="No templates available"
    description="Browse our template gallery or create custom templates for your video content needs."
    primaryAction={{
      label: 'Browse Gallery',
      onClick: onBrowseTemplates }}
    secondaryAction={{
      label: 'Create Template',
      onClick: onCreateTemplate }}
    suggestions={['Pre-built designs', 'Customizable layouts', 'Platform optimized']}
  />
);

export const EmptyCampaigns: React.FC<{ onCreateCampaign: () => void }> = ({
  onCreateCampaign}) => (
  <EmptyState
    icon={<Campaign sx={{ fontSize: 40 }} />}
    title="No campaigns created"
    description="Create your first campaign to organize and manage your video content projects effectively."
    primaryAction={{
      label: 'Create Campaign',
      onClick: onCreateCampaign }}
    suggestions={['Organize projects', 'Track progress', 'Team collaboration']}
  />
);

export const EmptyAnalytics: React.FC<{ onViewDocs: () => void }> = ({ onViewDocs }) => (
  <EmptyState
    icon={<Analytics sx={{ fontSize: 40 }} />}
    title="No analytics data yet"
    description="Once you start creating and publishing content, you'll see detailed performance analytics here."
    secondaryAction={{
      label: 'View Documentation',
      onClick: onViewDocs }}
    suggestions={['Performance metrics', 'Engagement tracking', 'ROI analysis']}
  />
);

export const EmptyClients: React.FC<{ onAddClient: () => void }> = ({ onAddClient }) => (
  <EmptyState
    icon={<Group sx={{ fontSize: 40 }} />}
    title="No clients added"
    description="Add your first client to start organizing projects and managing content for different accounts."
    primaryAction={{
      label: 'Add Client',
      onClick: onAddClient }}
    suggestions={['Organize by client', 'Separate workspaces', 'Client-specific assets']}
  />
);

export const EmptySearch: React.FC<{ query: string; onClearSearch: () => void }> = ({
  query,
  onClearSearch}) => (
  <EmptyState
    icon={<Search sx={{ fontSize: 40 }} />}
    title={`No results for "${query}"`}
    description="Try adjusting your search terms or browse our categories to find what you're looking for."
    secondaryAction={{
      label: 'Clear Search',
      onClick: onClearSearch }}
    suggestions={['Check spelling', 'Use different keywords', 'Browse categories']}
  />
);

// Loading state with skeleton
export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8}>
    <Box
      sx={{
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 3,
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%': { transform: 'scale(1)', opacity: 1  }
          '50%': { transform: 'scale(1.1)', opacity: 0.7  }
          '100%': { transform: 'scale(1)', opacity: 1  }
        }}}
    >
      <AutoAwesome sx={{ color: 'white', fontSize: 30 }} />
    </Box>
    <Typography variant="h6" gutterBottom>
      {message}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      This won't take long...
    </Typography>
  </Box>
);

// Success state
export const SuccessState: React.FC<{
  title: string;
  description: string;
  onContinue: () => void;
  continueLabel?: string;
}> = ({ title, description, onContinue, continueLabel = 'Continue' }) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    textAlign="center"
    py={8}
  >
    <Box
      sx={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 3,
        animation: 'bounce 1s ease-in-out',
        '@keyframes bounce': {
          '0%, 20%, 60%, 100%': { transform: 'translateY(0)'  }
          '40%': { transform: 'translateY(-10px)'  }
          '80%': { transform: 'translateY(-5px)'  }
        }}}
    >
      <TrendingUp sx={{ color: 'white', fontSize: 40 }} />
    </Box>

    <Typography variant="h5" gutterBottom fontWeight={500}>
      {title}
    </Typography>

    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>
      {description}
    </Typography>

    <Button variant="contained" size="large" onClick={onContinue} startIcon={<PlayArrow />}>
      {continueLabel}
    </Button>
  </Box>
);
