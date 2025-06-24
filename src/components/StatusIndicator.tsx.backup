import React from 'react';
import {
  Chip,
  Box,
  Typography,
  LinearProgress} from '@mui/material';
import {
  Check as CheckIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Error as ErrorIcon} from '@mui/icons-material';

export type StatusType = 'empty' | 'in-progress' | 'completed' | 'error' | 'warning';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  variant?: 'chip' | 'text' | 'badge';
  size?: 'small' | 'medium';
  progress?: number; // 0-100 for progress indicator
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  showIcon = true,
  variant = 'chip',
  size = 'small',
  progress}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          label: label || 'Completed',
          color: 'success' as const,
          icon: <CheckIcon />,
          bgColor: '#e8f5e8',
          textColor: '#2e7d32'};
      case 'in-progress':
        return {
          label: label || 'In Progress',
          color: 'primary' as const,
          icon: <RefreshIcon />,
          bgColor: '#e3f2fd',
          textColor: '#1976d2'};
      case 'error':
        return {
          label: label || 'Error',
          color: 'error' as const,
          icon: <ErrorIcon />,
          bgColor: '#ffebee',
          textColor: '#d32f2f'};
      case 'warning':
        return {
          label: label || 'Warning',
          color: 'warning' as const,
          icon: <WarningIcon />,
          bgColor: '#fff8e1',
          textColor: '#f57c00'};
      case 'empty':
      default:
        return {
          label: label || 'Empty',
          color: 'default' as const,
          icon: <CloseIcon />,
          bgColor: '#f5f5f5',
          textColor: '#757575'};
    }
  };

  const config = getStatusConfig();

  // Chip variant
  if (variant === 'chip') {
    const chipProps = {
      label: config.label,
      color: config.color,
      size: size,
      sx: {},
  fontWeight: 500,
        '& .MuiChip-icon': {
          fontSize: size === 'small' ? '16px' : '20px'}},
      ...(showIcon && { icon: config.icon }), // Only include icon prop if showIcon is true
    };

    return <Chip {...chipProps} />;
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: config.bgColor,
          color: config.textColor,
          fontSize: size === 'small' ? '0.75rem' : '0.875rem',
          fontWeight: 500}}
      >
        {showIcon && React.cloneElement(config.icon, { 
          fontSize: size === 'small' ? 'small' : 'medium' 
        })}
        <Typography variant="inherit" component="span">
          {config.label}
        </Typography>
      </Box>
    );
  }

  // Text variant
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {showIcon && React.cloneElement(config.icon, { 
        fontSize: size === 'small' ? 'small' : 'medium',
        sx: { color: config.textColor }
      })}
      <Typography 
        variant={size === 'small' ? 'caption' : 'body2'}
        sx={{ 
          color: config.textColor,
          fontWeight: 500}}
      >
        {config.label}
      </Typography>
      {progress !== undefined && status === 'in-progress' && (
        <Box sx={{ ml: 1, minWidth: 50 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: size === 'small' ? 4 : 6 }}
          />
        </Box>
      )}
    </Box>
  );
};

// Helper component for completion percentage display
interface CompletionStatusProps {
  completed: number;
  total: number;
  showPercentage?: boolean;
  showProgress?: boolean;
  size?: 'small' | 'medium';
}

export const CompletionStatus: React.FC<CompletionStatusProps> = ({
  completed,
  total,
  showPercentage = true,
  showProgress = true,
  size = 'small'}) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const getStatus = (): StatusType => {
    if (percentage === 100) return 'completed';
    if (percentage > 0) return 'in-progress';
    return 'empty';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <StatusIndicator
        status={getStatus()}
        {...(showPercentage && { label: `${percentage}%` })}
        size={size}
        variant="badge"
      />
      
      {showProgress && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={percentage}
            sx={{
              width: 100,
              height: size === 'small' ? 4 : 6,
              borderRadius: 2}}
          />
          <Typography variant="caption" color="text.secondary">
            {completed}/{total}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default React.memo(StatusIndicator);