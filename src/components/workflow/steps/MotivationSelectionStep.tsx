import React, { useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  LinearProgress,
  Alert,
  Stack,
  Paper} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon} from '@mui/icons-material';
import { useWorkflow } from '../WorkflowProvider';
import { StepComponentProps } from '@/lib/workflow/workflow-types';

interface MotivationSelectionStepProps extends StepComponentProps {}

export const MotivationSelectionStep: React.FC<MotivationSelectionStepProps> = ({
  onNext,
  onPrevious}) => {
  const { state, actions } = useWorkflow();
  const { briefData, motivations, processing, lastError } = state;

  // Auto-generate motivations when step loads if none exist
  useEffect(() => {
    if (briefData && motivations.length === 0 && !processing) {
      actions.generateMotivations();
    }
  }, [briefData, motivations.length, processing, actions]);

  // Handle motivation selection
  const handleSelectMotivation = useCallback(
    (id: string) => {
      actions.selectMotivation(id);
    },
    [actions]
  );

  // Handle next step
  const handleNext = useCallback(() => {
    const selectedCount = motivations.filter((m: any) => m.selected).length;
    if (selectedCount < 1) {
      actions.setError('Please select at least 1 motivation to continue');
      return;
    }

    actions.clearError();
    onNext?.();
  }, [motivations, actions, onNext]);

  // Handle regenerate motivations
  const handleRegenerateMotivations = useCallback(() => {
    actions.generateMotivations();
  }, [actions]);

  // Clear error
  const handleClearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  // Get selected count
  const selectedCount = motivations.filter((m: any) => m.selected).length;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Strategic Motivations
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        AI-generated motivations based on your brief. Select the ones that best align with your
        campaign goals.
      </Typography>

      {/* Brief Summary */}
      {briefData && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            Brief Summary
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Title:</strong> {briefData.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Industry:</strong> {briefData.industry || 'Not specified'}
            </Typography>
            <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Objective:</strong>{' '}
                {typeof briefData.objective === 'string'
                  ? briefData.objective
                  : String(briefData.objective || '')}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Error Alert */}
      {lastError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={handleClearError}>
          {lastError}
        </Alert>
      )}

      {/* Processing Indicator */}
      {processing && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Generating strategic motivations...
          </Typography>
        </Box>
      )}

      {/* Selection Summary */}
      {motivations.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedCount} of {motivations.length} motivations selected
            {selectedCount > 0 && (
              <Chip
                label={`${selectedCount} selected`}
                color="primary"
                size="small"
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
        </Box>
      )}

      {/* Motivations Grid */}
      {motivations.length > 0 && (
        <Box
          sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mb: 4 }}
        >
          {motivations.map((motivation: any) => (
            <Box key={motivation.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: motivation.selected ? 2 : 1,
                  borderColor: motivation.selected ? 'primary.main' : 'grey.300',
                  bgcolor: motivation.selected ? 'primary.50' : 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                    boxShadow: 2 }}}
                onClick={() => handleSelectMotivation(motivation.id)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <Checkbox
                      checked={motivation.selected}
                      onChange={() => handleSelectMotivation(motivation.id)}
                      sx={{ p: 0, mr: 2 }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {motivation.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {motivation.description}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={`Score: ${motivation.score}/10`}
                          size="small"
                          color={
                            motivation.score >= 8
                              ? 'success'
                              : motivation.score >= 6
                                ? 'warning'
                                : 'default'
                          }
                        />
                        {motivation.selected && (
                          <CheckCircleIcon color="primary" sx={{ fontSize: 20 }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      )}

      {/* Empty State */}
      {motivations.length === 0 && !processing && (
        <Paper sx={{ p: 4, textAlign: 'center', mb: 4 }}>
          <AutoAwesomeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Motivations Generated Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click the button below to generate strategic motivations based on your brief.
          </Typography>
          <Button
            variant="contained"
            onClick={handleRegenerateMotivations}
            startIcon={<AutoAwesomeIcon />}
            disabled={!briefData}
          >
            Generate Motivations
          </Button>
        </Paper>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onPrevious} startIcon={<ArrowBackIcon />}>
          Back to Brief
        </Button>

        <Stack direction="row" spacing={2}>
          {motivations.length > 0 && (
            <Button
              variant="outlined"
              onClick={handleRegenerateMotivations}
              startIcon={<AutoAwesomeIcon />}
              disabled={processing}
            >
              Regenerate
            </Button>
          )}

          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={<ArrowForwardIcon />}
            disabled={selectedCount === 0 || processing}
          >
            Generate Copy ({selectedCount} selected)
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
