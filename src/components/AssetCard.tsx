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
  ThumbUp as ThumbUpIcon,
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
      default:
        return <ImageIcon sx={{ fontSize: 40, color: 'grey.500' }} />;
    }
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(asset);
    }
  };

  const handleMenuClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(asset);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      {asset.type === 'image' && asset.thumbnail_url ? (
        <Box
          component="img"
          src={asset.thumbnail_url || asset.file_url}
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
            sx={{ maxWidth: onDelete ? '80%' : '90%', fontWeight: 500 }}
            title={asset.name}
          >
            {asset.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {asset.ai_generated && (
              <Chip label="AI" size="small" color="primary" sx={{ height: 20 }} />
            )}
            {onDelete && (
              <IconButton
                size="small"
                onClick={handleMenuClick}
                sx={{ ml: 0.5 }}
              >
                <MoreIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Metadata */}
        <Typography variant="caption" color="text.secondary" display="block">
          {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)} • {formatFileSize(asset.file_size)}
        </Typography>

        {asset.dimensions && (
          <Typography variant="caption" color="text.secondary" display="block">
            {asset.dimensions.width} × {asset.dimensions.height}
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

        {/* AI Prompt (if ai generated) */}
        {!compact && asset.ai_prompt && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              mt: 1, 
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {asset.ai_prompt}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(AssetCard);
