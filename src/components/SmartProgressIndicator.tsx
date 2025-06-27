import React, { useState, useEffect } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  AutoAwesome,
  ExpandMore,
  ExpandLess,
  CloudUpload,
  Psychology,
  ContentCopy,
  Image,
  VideoLibrary,
  GridView,
  Send,
} from '@mui/icons-material';

interface ProgressStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  estimatedTime: number; // in seconds
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface SmartProgressIndicatorProps {
  steps: ProgressStep[];
  currentStep: number;
  onStepComplete?: (stepId: string) => void;
  showDetails?: boolean;
  variant?: 'compact' | 'detailed';
}

export const SmartProgressIndicator: React.FC<SmartProgressIndicatorProps> = ({
  steps,
  currentStep,
  onStepComplete,
  showDetails = false,
  variant = 'detailed',
}) => {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showSteps, setShowSteps] = useState(showDetails);
  const [stepProgress, setStepProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    // Calculate overall progress
    const completedSteps = steps.filter((step: any) => step.status === 'completed').length;
    const totalSteps = steps.length;
    const baseProgress = (completedSteps / totalSteps) * 100;

    // Add current step progress
    const currentStepObj = steps[currentStep];
    if (currentStepObj && currentStepObj.status === 'active') {
      const currentStepProgress = stepProgress[currentStepObj.id] || 0;
      const stepWeight = 100 / totalSteps;
      setProgress(baseProgress + (currentStepProgress * stepWeight) / 100);
    } else {
      setProgress(baseProgress);
    }
  }, [steps, currentStep, stepProgress]);

  useEffect(() => {
    // Calculate time remaining
    const remainingSteps = steps.slice(currentStep);
    const totalTime = remainingSteps.reduce((sum, step) => sum + step.estimatedTime, 0);
    setTimeRemaining(totalTime);
  }, [steps, currentStep]);

  useEffect(() => {
    // Simulate step progress for active step
    const currentStepObj = steps[currentStep];
    if (currentStepObj && currentStepObj.status === 'active') {
      const interval = setInterval(() => {
        setStepProgress(prev => {
          const current = prev[currentStepObj.id] || 0;
          if (current >= 100) {
            clearInterval(interval);
            onStepComplete?.(currentStepObj.id);
            return prev;
          }
          return {
            ...prev,
            [currentStepObj.id]: Math.min(current + 100 / currentStepObj.estimatedTime, 100),
          };
        });
      }, 1000);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [currentStep, steps, onStepComplete]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${Math.round(remainingSeconds)}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'active':
        return 'primary';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (variant === 'compact') {
    return (
      <Box>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="body2" fontWeight={500}>
            {steps[currentStep]?.label || 'Processing...'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(timeRemaining)} remaining
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 1,
            '& .MuiLinearProgress-bar': {
              borderRadius: 1 },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {Math.round(progress)}% complete
        </Typography>
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <AutoAwesome color="primary" />
            <Typography variant="h6">AI Processing</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip label={`${Math.round(progress)}%`} color="primary" size="small" />
            <Typography variant="caption" color="text.secondary">
              {formatTime(timeRemaining)} left
            </Typography>
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box mb={3}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 12,
              borderRadius: 2,
              '& .MuiLinearProgress-bar': {
                borderRadius: 2 },
            }}
          />
        </Box>

        {/* Current Step Info */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar sx={{ bgcolor: 'primary.light' }}>{steps[currentStep]?.icon}</Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={500}>
              {steps[currentStep]?.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {steps[currentStep]?.description}
            </Typography>
          </Box>
        </Box>

        {/* Toggle Steps Detail */}
        <Box display="flex" alignItems="center" justifyContent="center">
          <IconButton
            onClick={() => setShowSteps(!showSteps)}
            aria-label="Icon button"
            size="small"
          >
            {showSteps ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            {showSteps ? 'Hide' : 'Show'} detailed steps
          </Typography>
        </Box>

        {/* Detailed Steps */}
        <Collapse in={showSteps}>
          <List dense>
            {steps.map((step, _index) => (
              <ListItem key={step.id}>
                <ListItemIcon>
                  {step.status === 'completed' ? (
                    <CheckCircle color="success" />
                  ) : step.status === 'active' ? (
                    <Box position="relative">
                      <Avatar sx={{ bgcolor: 'primary.light', width: 32, height: 32 }}>
                        {step.icon}
                      </Avatar>
                      {stepProgress[step.id] && (
                        <Box
                          position="absolute"
                          top={0}
                          left={0}
                          right={0}
                          bottom={0}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Typography variant="caption" fontWeight={600}>
                            {Math.round(stepProgress[step.id])}%
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Avatar sx={{ bgcolor: 'grey.300', width: 32, height: 32 }}>{step.icon}</Avatar>
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={step.label}
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                      {step.status === 'active' && (
                        <LinearProgress
                          variant="determinate"
                          value={stepProgress[step.id] || 0}
                          sx={{ mt: 0.5, height: 4, borderRadius: 1 }}
                        />
                      )}
                    </Box>
                  }
                />
                <Chip
                  label={step.status === 'active' ? formatTime(step.estimatedTime) : step.status}
                  size="small"
                  color={getStatusColor(step.status) as any}
                  variant={step.status === 'pending' ? 'outlined' : 'filled'}
                />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );
};

// Predefined workflow steps
export const briefWorkflowSteps: ProgressStep[] = [
  {
    id: 'upload',
    label: 'Processing Brief',
    description: 'Analyzing document and extracting key information',
    icon: <CloudUpload />,
    estimatedTime: 15,
    status: 'pending' },
  {
    id: 'motivations',
    label: 'Generating Motivations',
    description: 'AI creating strategic motivations from brief content',
    icon: <Psychology />,
    estimatedTime: 25,
    status: 'pending' },
  {
    id: 'copy',
    label: 'Creating Copy',
    description: 'Generating platform-specific copy variations',
    icon: <ContentCopy />,
    estimatedTime: 20,
    status: 'pending' },
  {
    id: 'assets',
    label: 'Preparing Assets',
    description: 'Organizing and optimizing visual assets',
    icon: <Image />,
    estimatedTime: 10,
    status: 'pending' },
  {
    id: 'template',
    label: 'Configuring Template',
    description: 'Setting up video template with content',
    icon: <VideoLibrary />,
    estimatedTime: 15,
    status: 'pending' },
  {
    id: 'matrix',
    label: 'Building Matrix',
    description: 'Creating content matrix for all variations',
    icon: <GridView />,
    estimatedTime: 10,
    status: 'pending' },
  {
    id: 'render',
    label: 'Ready to Render',
    description: 'Preparing final configuration for video generation',
    icon: <Send />,
    estimatedTime: 5,
    status: 'pending' },
];
