import React, { ReactNode } from 'react';
import { Box, Paper, Typography, Stepper, Step, StepLabel } from '@mui/material';
import { useWorkflow } from '../WorkflowProvider';

interface WorkflowStepWrapperProps {
  children: ReactNode;
  title: string;
  description?: string;
  showStepper?: boolean;
}

export const WorkflowStepWrapper: React.FC<WorkflowStepWrapperProps> = ({
  children,
  title,
  description,
  showStepper = true}) => {
  const { state } = useWorkflow();

  const steps = [
    'Upload Brief',
    'Review Content',
    'Generate Motivations',
    'Select Motivations',
    'Generate Copy',
    'Select Copy',
    'Complete',
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {showStepper && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            Workflow Progress
          </Typography>

          <Stepper activeStep={state.currentStep} orientation="horizontal" alternativeLabel>
            {steps.map((label, index) => (
              <Step key={label} completed={index < state.currentStep}>
                <StepLabel>
                  <Typography variant="body2">{label}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}

      <Paper sx={{ p: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body1" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>

        {children}
      </Paper>
    </Box>
  );
};
