import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Image as ImageIcon,
  Videocam as VideoIcon,
  Audiotrack as AudiotrackIcon,
  Description as DocumentIcon,
  TextFields as TextIcon,
  Star as StarIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { Asset } from '@/types/models';

interface AssetCardProps {
  asset: Asset;
  onSelect?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  showPerformance?: boolean;
  compact?: boolean;
  maxTags?: number;
}

const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  onSelect,
  onDelete,
  showPerformance = false,
  compact = false,
  maxTags = 2,
}) => {
  const getTypeIcon = () => {
    switch (asset.type) {
      case 'image':
        return <ImageIcon sx={{ fontSize: 40, color: 'grey.500' }} />;
      case 'video':
        return <VideoIcon sx={{ fontSize: 40, color: 'grey.500' }} />;
      case 'audio':
        return <AudiotrackIcon sx={{ fontSize: 40, color: 'grey.500' }} />;
      case 'document':
        return <DocumentIcon sx={{ fontSize: 40, color: 'grey.500' }} />;
      case 'copy':
        return <TextIcon sx={{ fontSize: 40, color: 'grey.500' }} />;
      default:
        return <DocumentIcon sx={{ fontSize: 40, color: 'grey.500' }} />;
    }
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(asset);
    }
  };

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(asset);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: onSelect ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onSelect ? {
          borderColor: 'primary.main',
          boxShadow: '0 0 0 1px rgba(25, 118, 210, 0.5)',
          transform: 'translateY(-2px)',
        } : {},
      }}
      onClick={handleCardClick}
    >
      {/* Media Preview */}
      {asset.type === 'image' && (asset.url || asset.thumbnail) ? (
        <Box
          component="img"
          src={asset.thumbnail || asset.url}
          alt={asset.name}
          sx={{
            width: '100%',
            height: compact ? 100 : 140,
            objectFit: 'cover',
          }}
          onError={(e) => {
            // Fallback to icon if image fails to load
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: compact ? 80 : 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.100',
          }}
        >
          {getTypeIcon()}
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header with name and menu */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography 
            variant={compact ? "body2" : "subtitle2"} 
            noWrap 
            sx={{ maxWidth: '80%', fontWeight: 500 }}
            title={asset.name}
          >
            {asset.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {asset.metadata?.aiGenerated && (
              <Chip label="AI" size="small" color="primary" sx={{ height: 20 }} />
            )}
            {onDelete && (
              <IconButton
                size="small"
                onClick={handleDeleteClick}
                sx={{ ml: 0.5 }}
              >
                <MoreIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Metadata */}
        <Typography variant="caption" color="text.secondary" display="block">
          {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}
          {asset.metadata?.fileSize && ` • ${asset.metadata.fileSize}`}
        </Typography>

        {asset.metadata?.dimensions && (
          <Typography variant="caption" color="text.secondary" display="block">
            {asset.metadata.dimensions}
          </Typography>
        )}

        {asset.metadata?.duration && (
          <Typography variant="caption" color="text.secondary" display="block">
            Duration: {asset.metadata.duration}
          </Typography>
        )}

        {/* AI Generated prompt */}
        {asset.metadata?.aiGenerated && asset.metadata?.aiPrompt && !compact && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontStyle: 'italic',
            }}
          >
            "{asset.metadata.aiPrompt}"
          </Typography>
        )}

        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {asset.tags.slice(0, maxTags).map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
            {asset.tags.length > maxTags && (
              <Chip
                label={`+${asset.tags.length - maxTags}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
        )}

        {/* Status */}
        {asset.status !== 'active' && (
          <Chip
            label={asset.status}
            size="small"
            color={asset.status === 'archived' ? 'default' : 'error'}
            sx={{ mt: 1 }}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(AssetCard);
