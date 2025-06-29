/**
 * VideoStudioStepper Component
 * Extracted from video-studio.tsx for better maintainability
 * Low risk extraction - simple presentation component for step tracking
 */

import React from 'react';
import { Paper, Stepper, Step, StepLabel } from '@mui/material';

interface VideoStudioStepperProps {
  activeStep: number;
  steps: string[];
}

export const VideoStudioStepper: React.FC<VideoStudioStepperProps> = ({ activeStep, steps }) => {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stepper activeStep={activeStep} orientation="horizontal">
        {steps.map((label, _index) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Paper>
  );
};

export default VideoStudioStepper;
