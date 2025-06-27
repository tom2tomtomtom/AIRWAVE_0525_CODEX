import React, { useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  useTheme,
  useMediaQuery,
  Slide,
  Zoom,
  Chip,
  Avatar} from '@mui/material';
import {
  Close,
  ArrowBack,
  ArrowForward,
  CloudUpload,
  AutoAwesome,
  ContentCopy,
  Image,
  VideoLibrary,
  Send,
  SwipeLeft,
  SwipeRight} from '@mui/icons-material';
import { useSwipeable } from 'react-swipeable';

interface MobileWorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  canSkip?: boolean;
}

interface MobileOptimizedWorkflowProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

export const MobileOptimizedWorkflow: React.FC<MobileOptimizedWorkflowProps> = ({
  open,
  onClose,
  onComplete}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeStep, setActiveStep] = useState(0);
  const [workflowData, setWorkflowData] = useState<any>({});
  const [showGestures, setShowGestures] = useState(true);
  // const containerRef = useRef<HTMLDivElement>(null); // TODO: Use for scroll/swipe gestures

  const steps: MobileWorkflowStep[] = [
    {
      id: 'upload',
      title: 'Upload Brief',
      description: 'Tap to upload or drag & drop your document',
      icon: <CloudUpload />,
      component: <MobileUploadStep onUpload={(data) => setWorkflowData({...workflowData, brief: data})} />
    },
    {
      id: 'motivations',
      title: 'Select Motivations',
      description: 'Tap to select strategic motivations',
      icon: <AutoAwesome />,
      component: <MobileMotivationsStep onSelect={(data) => setWorkflowData({...workflowData, motivations: data})} />
    },
    {
      id: 'copy',
      title: 'Choose Copy',
      description: 'Swipe through copy variations',
      icon: <ContentCopy />,
      component: <MobileCopyStep onSelect={(data) => setWorkflowData({...workflowData, copy: data})} />
    },
    {
      id: 'assets',
      title: 'Pick Assets',
      description: 'Select or generate visual assets',
      icon: <Image />,
      component: <MobileAssetsStep onSelect={(data) => setWorkflowData({...workflowData, assets: data})} />,
      canSkip: true },
    {
      id: 'template',
      title: 'Choose Template',
      description: 'Pick your video template',
      icon: <VideoLibrary />,
      component: <MobileTemplateStep onSelect={(data) => setWorkflowData({...workflowData, template: data})} />
    },
    {
      id: 'complete',
      title: 'Ready to Render',
      description: 'Review and start rendering',
      icon: <Send />,
      component: <MobileCompleteStep data={workflowData} onComplete={onComplete} />
    }
  ];

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handleBack(),
    trackMouse: false,
    trackTouch: true,
    delta: 50});

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSkip = () => {
    if (steps[activeStep].canSkip) {
      handleNext();
    }
  };

  const progress = ((activeStep + 1) / steps.length) * 100;

  // Hide gesture hints after first interaction
  React.useEffect(() => {
    const timer = setTimeout(() => setShowGestures(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!isMobile) {
    // Return desktop version for non-mobile devices
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: 'background.default'
        }
      }}
    >
      <DialogContent sx={{ p: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: 1}}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <IconButton onClick={onClose} edge="start" aria-label="close">
              <Close />
            </IconButton>
            <Typography variant="h6" flex={1} textAlign="center">
              {steps[activeStep].title}
            </Typography>
            <Box width={40} /> {/* Spacer for centering */}
          </Box>

          {/* Progress */}
          <Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3}
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Step {activeStep + 1} of {steps.length}
            </Typography>
          </Box>
        </Box>

        {/* Content Area */}
        <Box
          {...swipeHandlers}
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative'}}
        >
          <Slide
            direction="left"
            in={true}
            key={activeStep}
          >
            <Box sx={{ height: '100%', p: 2 }}>
              {/* Step Description */}
              <Box textAlign="center" mb={3}>
                <Avatar
                  sx={{
                    bgcolor: 'primary.light',
                    width: 60,
                    height: 60,
                    mx: 'auto',
                    mb: 2}}
                >
                  {steps[activeStep].icon}
                </Avatar>
                <Typography variant="body1" color="text.secondary">
                  {steps[activeStep].description}
                </Typography>
              </Box>

              {/* Step Content */}
              <Box sx={{ height: 'calc(100% - 120px)', overflow: 'auto' }}>
                {steps[activeStep].component}
              </Box>
            </Box>
          </Slide>

          {/* Gesture Hints */}
          {showGestures && (
            <Zoom in={showGestures}>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 80,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  bgcolor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  animation: 'pulse 2s infinite'}}
              >
                <SwipeLeft />
                <Typography variant="caption">Swipe to navigate</Typography>
                <SwipeRight />
              </Box>
            </Zoom>
          )}
        </Box>

        {/* Bottom Navigation */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'}}
        >
          <Button
            onClick={handleBack}
            disabled={activeStep === 0}
            startIcon={<ArrowBack />}
            size="large"
          >
            Back
          </Button>

          {steps[activeStep].canSkip && (
            <Button onClick={handleSkip} color="inherit">
              Skip
            </Button>
          )}

          <Button
            onClick={handleNext}
            disabled={activeStep === steps.length - 1}
            endIcon={<ArrowForward />}
            variant="contained"
            size="large"
          >
            {activeStep === steps.length - 1 ? 'Complete' : 'Next'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// Mobile-optimized step components
const MobileUploadStep: React.FC<{ onUpload: (data: any) => void }> = ({ onUpload }) => (
  <Box textAlign="center" py={4}>
    <Box
      sx={{
        border: '2px dashed',
        borderColor: 'primary.main',
        borderRadius: 3,
        p: 4,
        mb: 3,
        bgcolor: 'primary.light',
        cursor: 'pointer',
        '&:active': {
          transform: 'scale(0.98)' },
        transition: 'transform 0.1s ease' }}
      onClick={() => onUpload({ fileName: 'sample-brief.pdf' })}
    >
      <CloudUpload sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Tap to Upload
      </Typography>
      <Typography variant="body2" color="text.secondary">
        PDF, Word, or Text files
      </Typography>
    </Box>
    
    <Typography variant="caption" color="text.secondary">
      Or use the camera to scan documents
    </Typography>
  </Box>
);

const MobileMotivationsStep: React.FC<{ onSelect: (data: any) => void }> = ({ onSelect }) => {
  const [selected, setSelected] = useState<string[]>([]);
  
  const motivations = [
    { id: '1', title: 'Emotional Connection', score: 92 },
    { id: '2', title: 'Social Proof', score: 88 },
    { id: '3', title: 'Innovation Focus', score: 85 },
  ];

  const handleToggle = (id: string) => {
    const newSelected = selected.includes(id)
      ? selected.filter((s: any) => s !== id)
      : [...selected, id];
    setSelected(newSelected);
    onSelect(newSelected);
  };

  return (
    <Box>
      {motivations.map((motivation: any) => (
        <Card
          key={motivation.id}
          sx={{
            mb: 2,
            border: 2,
            borderColor: selected.includes(motivation.id) ? 'primary.main' : 'transparent',
            cursor: 'pointer',
            '&:active': {
              transform: 'scale(0.98)' },
            transition: 'all 0.2s ease'
          }}
          onClick={() => handleToggle(motivation.id)}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" flex={1}>
                {motivation.title}
              </Typography>
              <Chip
                label={`${motivation.score}%`}
                color="primary"
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

const MobileCopyStep: React.FC<{ onSelect: (data: any) => void }> = ({ onSelect: _onSelect }) => (
  <Box>
    <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
      Swipe left/right to browse copy variations
    </Typography>
    {/* Copy variations would be implemented here */}
    <Card>
      <CardContent>
        <Typography variant="body1">
          Transform your business with innovative solutions that put customers first.
        </Typography>
        <Chip label="LinkedIn" size="small" sx={{ mt: 1 }} />
      </CardContent>
    </Card>
  </Box>
);

const MobileAssetsStep: React.FC<{ onSelect: (data: any) => void }> = ({ onSelect: _onSelect }) => (
  <Box textAlign="center">
    <Typography variant="body2" color="text.secondary" mb={3}>
      Choose existing assets or generate new ones
    </Typography>
    <Button variant="contained" fullWidth size="large" sx={{ mb: 2 }}>
      Use Existing Assets
    </Button>
    <Button variant="outlined" fullWidth size="large">
      Generate with AI
    </Button>
  </Box>
);

const MobileTemplateStep: React.FC<{ onSelect: (data: any) => void }> = ({ onSelect }) => (
  <Box>
    {['Modern Slideshow', 'Dynamic Promo', 'Social Story'].map((template, index) => (
      <Card key={index} sx={{ mb: 2, cursor: 'pointer' }} onClick={() => onSelect(template)}>
        <CardContent>
          <Typography variant="h6">{template}</Typography>
          <Typography variant="body2" color="text.secondary">
            Perfect for social media campaigns
          </Typography>
        </CardContent>
      </Card>
    ))}
  </Box>
);

const MobileCompleteStep: React.FC<{ data: any; onComplete: (data: any) => void }> = ({ data, onComplete }) => (
  <Box textAlign="center" py={4}>
    <Send sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
    <Typography variant="h5" gutterBottom>
      Ready to Render!
    </Typography>
    <Typography variant="body2" color="text.secondary" mb={4}>
      Your content is configured and ready for video generation
    </Typography>
    <Button
      variant="contained"
      size="large"
      fullWidth
      onClick={() => onComplete(data)}
    >
      Start Rendering
    </Button>
  </Box>
);
