import React from 'react';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  LinearProgress,
  Skeleton,
} from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  variant?: 'circular' | 'linear' | 'skeleton';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'medium',
  fullScreen = false,
  variant = 'circular',
}) => {
  const sizes = {
    small: 30,
    medium: 40,
    large: 60,
  };

  if (variant === 'skeleton') {
    return (
      <Box sx={{ width: '100%' }}>
        <Skeleton variant="text" sx={{ fontSize: '1rem' }} />
        <Skeleton variant="rectangular" height={60} />
        <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
      </Box>
    );
  }

  if (variant === 'linear') {
    return (
      <Box sx={{ width: '100%' }}>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          align="center"
          sx={{ mb: 1 }}
        >
          {message}
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 3,
        minHeight: fullScreen ? '100vh' : '200px',
      }}
    >
      <CircularProgress size={sizes[size]} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          zIndex: 9999,
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
};

// Asset Grid Loading Skeleton
export const AssetGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 3,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index}>
          <Skeleton variant="rectangular" height={200} />
          <Box sx={{ pt: 0.5 }}>
            <Skeleton />
            <Skeleton width="60%" />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// Table Loading Skeleton
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, p: 2, borderBottom: 1, borderColor: 'divider' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height={30} />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box 
          key={rowIndex} 
          sx={{ display: 'flex', gap: 2, p: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} width={`${100 / columns}%`} height={20} />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default LoadingSpinner;
