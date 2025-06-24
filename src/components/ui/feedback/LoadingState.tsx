import React from 'react';
import {
  Box,
  CircularProgress,
  Skeleton,
  Typography,
  LinearProgress,
  Card,
  CardContent} from '@mui/material';
import { createLoadingProps } from '@/utils/accessibility';

interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'progress' | 'card';
  message?: string;
  size?: 'small' | 'medium' | 'large';
  progress?: number;
  children?: React.ReactNode;
  fullHeight?: boolean;
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'spinner',
  message = 'Loading...',
  size = 'medium',
  progress,
  children,
  fullHeight = false,
  rows = 3}) => {
  const loadingProps = createLoadingProps(true, message);

  const getSizeValue = () => {
    switch (size) {
      case 'small':
        return 24;
      case 'large':
        return 64;
      default:
        return 40;
    }
  };

  const renderSpinner = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: fullHeight ? '200px' : 'auto',
        p: 3 }}
      {...loadingProps}
    >
      <CircularProgress
        size={getSizeValue()}
        thickness={4}
        sx={{
          color: 'primary.main',
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round' }}}
      />
      {message && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center', fontWeight: 500 }}
        >
          {message}
        </Typography>
      )}
      {children}
    </Box>
  );

  const renderSkeleton = () => (
    <Box sx={{ p: 2, width: '100%' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Skeleton
            variant="text"
            height={24}
            width={index === 0 ? '60%' : index === rows - 1 ? '40%' : '80%'}
            sx={{ mb: 1 }}
          />
          {index === 0 && (
            <Skeleton
              variant="rectangular"
              height={120}
              sx={{
                borderRadius: 2,
                mb: 1 }}
            />
          )}
        </Box>
      ))}
    </Box>
  );

  const renderProgress = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        p: 3,
        minHeight: fullHeight ? '200px' : 'auto' }}
      {...loadingProps}
    >
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        {message}
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 300 }}>
        <LinearProgress
          variant={progress !== undefined ? 'determinate' : 'indeterminate'}
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'}}}
        />
      </Box>
      {progress !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {Math.round(progress)}%
        </Typography>
      )}
      {children}
    </Box>
  );

  const renderCard = () => (
    <Card
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider' }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2 }}
          {...loadingProps}
        >
          <CircularProgress
            size={getSizeValue()}
            thickness={4}
            sx={{
              color: 'primary.main',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round' }}}
          />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              {message}
            </Typography>
            {children && (
              <Typography variant="body2" color="text.secondary">
                {children}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  switch (type) {
    case 'skeleton':
      return renderSkeleton();
    case 'progress':
      return renderProgress();
    case 'card':
      return renderCard();
    default:
      return renderSpinner();
  }
};
