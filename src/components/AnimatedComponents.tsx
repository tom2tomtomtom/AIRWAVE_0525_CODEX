import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Fab,
  Chip,
  Avatar,
  Typography,
  Slide,
  Zoom,
  styled,
  keyframes} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Add,
  Check,
  CloudUpload,
  PlayArrow,
  Pause} from '@mui/icons-material';

// Keyframe animations
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const bounce = keyframes`
  0%, 20%, 60%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  80% { transform: translateY(-5px); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
`;

const slideInUp = keyframes`
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const fadeInScale = keyframes`
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

// Styled components with animations
const AnimatedCard = styled(Card)(({ theme }) => ({
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: theme.shadows[8],
    '& .card-overlay': {
      opacity: 1 }},
  '&:active': {
    transform: 'translateY(-4px)' }}));

const PulseButton = styled(Button)({
  '&.pulse': {
    animation: `${pulse} 2s infinite` }});

const BounceIcon = styled(Box)({
  '&.bounce': {
    animation: `${bounce} 1s ease-in-out` }});

const ShimmerBox = styled(Box)({
  background: `
    linear-gradient(90deg, 
      #f0f0f0 25%, 
      #e0e0e0 50%, 
      #f0f0f0 75%
    )`,
  backgroundSize: '200px 100%',
  animation: `${shimmer} 1.5s infinite` });

// Animated Button with state changes
export const AnimatedActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  success?: boolean;
  error?: boolean;
}> = ({ children, onClick, loading, success, error }) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    onClick();
    setTimeout(() => setClicked(false), 200);
  };

  return (
    <Button
      variant="contained"
      onClick={handleClick}
      disabled={loading}
      sx={{
        transition: 'all 0.3s ease',
        transform: clicked ? 'scale(0.95)' : 'scale(1)',
        backgroundColor: success ? 'success.main' : error ? 'error.main' : 'primary.main',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3 },
        '&:active': {
          transform: 'scale(0.95)' }}}
    >
      {loading ? (
        <Box
          sx={{
            width: 20,
            height: 20,
            border: '2px solid',
            borderColor: 'currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' } }}}
        />
      ) : success ? (
        <Zoom in={success}>
          <Check />
        </Zoom>
      ) : (
        children
      )}
    </Button>
  );
};

// Animated Like Button
export const AnimatedLikeButton: React.FC<{
  liked: boolean;
  onToggle: () => void;
}> = ({ liked, onToggle }) => {
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    setAnimating(true);
    onToggle();
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <IconButton
      onClick={handleClick}
      sx={{
        color: liked ? 'error.main' : 'text.secondary',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'scale(1.1)',
          backgroundColor: liked ? 'error.light' : 'action.hover' }}}
      aria-label="Icon button"
    >
      {' '}
      <Box
        sx={{
          transform: animating ? 'scale(1.3)' : 'scale(1)',
          transition: 'transform 0.3s ease' }}
      >
        {liked ? <Favorite /> : <FavoriteBorder />}
      </Box>
    </IconButton>
  );
};

// Animated Upload Zone
export const AnimatedUploadZone: React.FC<{
  isDragActive: boolean;
  onDrop: () => void;
}> = ({ isDragActive, onDrop }) => (
  <Box
    onClick={onDrop}
    sx={{
      border: '2px dashed',
      borderColor: isDragActive ? 'primary.main' : 'divider',
      borderRadius: 2,
      p: 4,
      textAlign: 'center',
      cursor: 'pointer',
      backgroundColor: isDragActive ? 'primary.light' : 'background.paper',
      transition: 'all 0.3s ease',
      transform: isDragActive ? 'scale(1.02)' : 'scale(1)',
      '&:hover': {
        borderColor: 'primary.main',
        backgroundColor: 'action.hover',
        transform: 'scale(1.01)' }}}
  >
    <BounceIcon className={isDragActive ? 'bounce' : ''}>
      <CloudUpload
        sx={{
          fontSize: 48,
          color: isDragActive ? 'primary.main' : 'text.secondary',
          transition: 'color 0.3s ease' }}
      />
    </BounceIcon>
    <Typography variant="h6" gutterBottom>
      {isDragActive ? 'Drop files here' : 'Drag & drop files'}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      or click to browse
    </Typography>
  </Box>
);

// Animated Progress Card
export const AnimatedProgressCard: React.FC<{
  title: string;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'error';
}> = ({ title, progress, status }) => (
  <AnimatedCard>
    <CardContent>
      <Box display="flex" alignItems="center" gap={2}>
        <Avatar
          sx={{
            bgcolor:
              status === 'completed'
                ? 'success.main'
                : status === 'error'
                  ? 'error.main'
                  : status === 'active'
                    ? 'primary.main'
                    : 'grey.300',
            transition: 'all 0.3s ease' }}
        >
          {status === 'completed' ? <Check /> : status === 'active' ? <PlayArrow /> : <Pause />}
        </Avatar>
        <Box flex={1}>
          <Typography variant="h6">{title}</Typography>
          <Box
            sx={{
              width: '100%',
              height: 8,
              bgcolor: 'grey.200',
              borderRadius: 1,
              overflow: 'hidden',
              mt: 1 }}
          >
            <Box
              sx={{
                width: `${progress}%`,
                height: '100%',
                bgcolor: status === 'error' ? 'error.main' : 'primary.main',
                transition: 'width 0.5s ease',
                borderRadius: 1 }}
            />
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {progress}%
        </Typography>
      </Box>
    </CardContent>
  </AnimatedCard>
);

// Animated Notification Toast
export const AnimatedToast: React.FC<{
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}> = ({ open, message, severity, onClose }) => {
  const getColor = () => {
    switch (severity) {
      case 'success':
        return 'success.main';
      case 'error':
        return 'error.main';
      case 'warning':
        return 'warning.main';
      default:
        return 'info.main';
    }
  };

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
          animation: open ? `${slideInUp} 0.3s ease-out` : 'none' }}
      >
        <Card
          sx={{
            bgcolor: getColor(),
            color: 'white',
            minWidth: 300,
            boxShadow: 3 }}
        >
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography flex={1}>{message}</Typography>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'inherit' }}
              aria-label="Icon button"
            >
              {' '}
              <Add sx={{ transform: 'rotate(45deg)' }} />
            </IconButton>
          </CardContent>
        </Card>
      </Box>
    </Slide>
  );
};

// Animated Floating Action Button
export const AnimatedFAB: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
}> = ({ icon, onClick, tooltip }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Fab
      color="primary"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'scale(1.1) translateY(-2px)' : 'scale(1)',
        boxShadow: hovered ? 6 : 3,
        '&:active': {
          transform: 'scale(0.95)' }}}
    >
      <Box
        sx={{
          transition: 'transform 0.3s ease',
          transform: hovered ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        {icon}
      </Box>
    </Fab>
  );
};

// Animated Status Chip
export const AnimatedStatusChip: React.FC<{
  status: 'pending' | 'processing' | 'completed' | 'error';
  label: string;
}> = ({ status, label }) => {
  const getProps = () => {
    switch (status) {
      case 'processing':
        return {
          color: 'primary' as const,
          sx: { animation: `${pulse} 2s infinite` } };
      case 'completed':
        return {
          color: 'success' as const,
          sx: { animation: `${bounce} 1s ease-in-out` } };
      case 'error':
        return {
          color: 'error' as const,
          sx: { animation: `${shake} 0.5s ease-in-out` } };
      default:
        return { color: 'default' as const };
    }
  };

  return <Chip label={label} size="small" {...getProps()} />;
};

// Loading Skeleton with shimmer effect
export const ShimmerSkeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
}> = ({ width = '100%', height = 20, variant = 'rectangular' }) => (
  <ShimmerBox
    sx={{
      width,
      height,
      borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? 1 : 2 }}
  />
);
