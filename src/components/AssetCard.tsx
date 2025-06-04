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

export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  url: string;
  description: string;
  tags: string[];
  categories: string[];
  dateAdded: string;
  dateModified: string;
  isFavorite: boolean;
  metadata: {
    fileSize: string;
    dimensions?: string;
    duration?: string;
    format: string;
    creator: string;
    source: string;
    license: string;
    usageRights: string;
    expirationDate?: string;
  };
  performance?: {
    views: number;
    engagement: number;
    conversion: number;
    score: number;
  };
}

interface AssetCardProps {
  asset: Asset;
  onClick?: (asset: Asset) => void;
  onMenuClick?: (asset: Asset, event: React.MouseEvent) => void;
  showPerformance?: boolean;
  compact?: boolean;
  maxTags?: number;
}

const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  onClick,
  onMenuClick,
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
    if (onClick) {
      onClick(asset);
    }
  };

  const handleMenuClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onMenuClick) {
      onMenuClick(asset, event);
    }
  };

  return (
    <Card
      className="floating-card"
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: (theme) => 
          theme.palette.mode === 'light'
            ? 'rgba(255, 255, 255, 0.8)'
            : 'rgba(15, 22, 41, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid',
        borderColor: (theme) => 
          theme.palette.mode === 'light'
            ? 'rgba(124, 58, 237, 0.1)'
            : 'rgba(167, 139, 250, 0.15)',
        boxShadow: (theme) => 
          theme.palette.mode === 'light'
            ? '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)'
            : '0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.25)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: (theme) => 
            theme.palette.mode === 'light'
              ? '0 12px 48px rgba(124, 58, 237, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05)'
              : '0 12px 48px rgba(167, 139, 250, 0.25), 0 4px 12px rgba(0, 0, 0, 0.3)',
        } : {},
      }}
      onClick={handleCardClick}
    >
      {/* Media Preview */}
      {asset.type === 'image' ? (
        <Box
          component="img"
          src={asset.url}
          alt={asset.name}
          sx={{
            width: '100%',
            height: compact ? 100 : 140,
            objectFit: 'cover',
          }}
          onError={(e: React.ErrorEvent<HTMLElement>) => {
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
            sx={{ maxWidth: onMenuClick ? '80%' : '90%', fontWeight: 500 }}
            title={asset.name}
          >
            {asset.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {asset.isFavorite && (
              <ThumbUpIcon fontSize="small" color="primary" />
            )}
            {onMenuClick && (
              <IconButton
                size="small"
                onClick={handleMenuClick}
                sx={{ ml: 0.5 }} aria-label="Icon button">                <MoreIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Metadata */}
        <Typography variant="caption" color="text.secondary" display="block">
          {asset.type.charAt(0).toUpperCase() + asset.type.slice(1)} • {asset.metadata.fileSize}
        </Typography>

        {asset.metadata.dimensions && (
          <Typography variant="caption" color="text.secondary" display="block">
            {asset.metadata.dimensions}
          </Typography>
        )}

        {asset.metadata.duration && (
          <Typography variant="caption" color="text.secondary" display="block">
            Duration: {asset.metadata.duration}
          </Typography>
        )}

        {/* Performance metrics */}
        {showPerformance && asset.performance && (
          <Box sx={{ mt: 1, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {asset.performance.views} views • {asset.performance.engagement}% engagement
            </Typography>
            <Typography variant="caption" color="primary.main" display="block">
              Score: {asset.performance.score}/100
            </Typography>
          </Box>
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

        {/* Description (if not compact) */}
        {!compact && asset.description && (
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
            {asset.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(AssetCard);