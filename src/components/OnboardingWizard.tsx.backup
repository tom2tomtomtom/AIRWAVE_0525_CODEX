import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  LinearProgress,
  IconButton,
  Fade} from '@mui/material';
import {
  Close,
  PlayArrow,
  CloudUpload,
  AutoAwesome,
  VideoLibrary,
  TrendingUp,
  CheckCircle,
  ArrowForward,
  Lightbulb,
  Speed,
  Group} from '@mui/icons-material';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  userType?: 'new' | 'returning';
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  open,
  onClose,
  onComplete,
  userType = 'new'
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [showDemo, setShowDemo] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to AIrFLOW',
      description: 'Your AI-powered video creation platform',
      icon: <PlayArrow />,
      content: (
        <Box textAlign="center" py={4}>
          <Box
            sx={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)'  }
                '50%': { transform: 'scale(1.05)'  }
                '100%': { transform: 'scale(1)' }}
            }}
          >
            <PlayArrow sx={{ fontSize: 60, color: 'white' }} />
          </Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Welcome to AIrFLOW! 🚀
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Transform your briefs into stunning videos with AI-powered workflows.
            Let's get you started in just a few steps.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 3 }}>
            {[
              { icon: <Speed />, label: '10x Faster', desc: 'Create videos in minutes'  }
              { icon: <AutoAwesome />, label: 'AI-Powered', desc: 'Smart automation'  }
              { icon: <Group />, label: 'Team Ready', desc: 'Collaborate seamlessly' }
            ].map((feature, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.light', mx: 'auto', mb: 1 }}>
                      {feature.icon}
                    </Avatar>
                    <Typography variant="subtitle2" gutterBottom>
                      {feature.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {feature.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )
    },
    {
      id: 'workflow',
      title: 'The AIrFLOW Workflow',
      description: 'See how easy it is to create amazing content',
      icon: <CloudUpload />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Your content creation journey in 4 simple steps:
          </Typography>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {[
              {
                step: '1',
                title: 'Upload Brief',
                desc: 'Drag & drop your brief document',
                icon: <CloudUpload />,
                color: '#2196F3' }
              {
                step: '2',
                title: 'AI Processing',
                desc: 'AI extracts motivations and generates copy',
                icon: <AutoAwesome />,
                color: '#9C27B0' }
              {
                step: '3',
                title: 'Select & Customize',
                desc: 'Choose templates and assets',
                icon: <VideoLibrary />,
                color: '#FF9800' }
              {
                step: '4',
                title: 'Render & Share',
                desc: 'Generate videos and publish',
                icon: <TrendingUp />,
                color: '#4CAF50'
              }
            ].map((item, index) => (
              <Grid size={{ xs: 12, sm: 6 }} key={index}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: 2,
                    borderColor: 'transparent',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: item.color,
                      transform: 'translateY(-4px)',
                      boxShadow: 3
                    }
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar 
                        sx={{ 
                          bgcolor: item.color, 
                          mr: 2,
                          width: 40,
                          height: 40
                        }}
                      >
                        {item.icon}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {item.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.desc}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          <Box textAlign="center" mt={4}>
            <Button
              variant="outlined"
              onClick={() => setShowDemo(true)}
              startIcon={<PlayArrow />}
            >
              Watch 2-minute Demo
            </Button>
          </Box>
        </Box>
      )
    },
    {
      id: 'features',
      title: 'Key Features',
      description: 'Discover what makes AIrFLOW powerful',
      icon: <Lightbulb />,
      content: (
        <Grid container spacing={3}>
          {[
            {
              title: 'Smart Brief Analysis',
              desc: 'AI reads and understands your brief documents, extracting key insights automatically.',
              icon: <AutoAwesome />,
              benefits: ['PDF & Word support', 'Key insight extraction', 'Smart categorization']
            },
            {
              title: 'Automated Workflows',
              desc: 'Guided step-by-step process from brief to final video with minimal manual work.',
              icon: <Speed />,
              benefits: ['Step-by-step guidance', 'Auto-progression', 'Smart suggestions']
            },
            {
              title: 'Template Library',
              desc: 'Professional video templates optimized for different platforms and use cases.',
              icon: <VideoLibrary />,
              benefits: ['Platform optimized', 'Customizable designs', 'Regular updates']
            }
          ].map((feature, index) => (
            <Grid size={{ xs: 12, md: 4 }} key={index}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Avatar sx={{ bgcolor: 'primary.light', mb: 2 }}>
                    {feature.icon}
                  </Avatar>
                  <Typography variant="h6" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {feature.desc}
                  </Typography>
                  <Box>
                    {feature.benefits.map((benefit, i) => (
                      <Chip
                        key={i}
                        label={benefit}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )
    },
    {
      id: 'ready',
      title: 'Ready to Start',
      description: 'You\'re all set to create amazing content',
      icon: <CheckCircle />,
      content: (
        <Box textAlign="center" py={4}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 3 }} />
          <Typography variant="h4" gutterBottom fontWeight={600}>
            You're All Set! 🎉
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            You now know the basics of AIrFLOW. Ready to create your first video?
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 3, maxWidth: 600, mx: 'auto' }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<CloudUpload />}
                onClick={() => {
                  onComplete();
                  // Navigate to workflow
                }}
              >
                Start with Brief
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<VideoLibrary />}
                onClick={() => {
                  onComplete();
                  // Navigate to templates
                }}
              >
                Browse Templates
              </Button>
            </Grid>
          </Grid>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            You can always access help and tutorials from the navigation menu
          </Typography>
        </Box>
      ),
      action: {},
  label: 'Get Started',
        onClick: onComplete
      }
    }
  ];

  const handleNext = () => {
    setCompleted(prev => new Set(prev).add(activeStep));
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, overflow: 'hidden' }
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" justifyContent="between">
            <Box flex={1}>
              <Typography variant="h5" fontWeight={600}>
                Getting Started
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Step {activeStep + 1} of {steps.length}
              </Typography>
            </Box>
            <IconButton onClick={onClose} sx={{ ml: 2 }} aria-label="Icon button">              <Close />
            </IconButton>
          </Box>
          
          {/* Progress Bar */}
          <Box sx={{ mt: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 8, 
                borderRadius: 1,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 1}
              }} 
            />
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ p: 4, minHeight: 400 }}>
          <Fade in={true} key={activeStep}>
            <Box>
              <Box display="flex" alignItems="center" mb={3}>
                <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                  {steps[activeStep].icon}
                </Avatar>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {steps[activeStep].title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {steps[activeStep].description}
                  </Typography>
                </Box>
              </Box>
              
              {steps[activeStep].content}
            </Box>
          </Fade>
        </Box>

        {/* Footer */}
        <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button onClick={handleSkip} color="inherit">
              Skip Tutorial
            </Button>
            
            <Box display="flex" gap={2}>
              <Button 
                onClick={handleBack} 
                disabled={activeStep === 0}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                endIcon={activeStep === steps.length - 1 ? <CheckCircle /> : <ArrowForward />}
              >
                {activeStep === steps.length - 1 ? 'Get Started' : 'Next'}
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
