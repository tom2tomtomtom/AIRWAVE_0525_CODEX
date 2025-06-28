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
  Paper,
  Divider,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useWorkflow } from '../WorkflowProvider';
import { StepComponentProps } from '@/lib/workflow/workflow-types';

interface CopyGenerationStepProps extends StepComponentProps {}

export const CopyGenerationStep: React.FC<CopyGenerationStepProps> = ({ onNext, onPrevious }) => {
  const { state, actions } = useWorkflow();
  const { briefData: _briefData, motivations, copyVariations, processing, lastError } = state;

  // Get selected motivations
  const selectedMotivations = motivations.filter((m: any) => m.selected);

  // Auto-generate copy when step loads if none exist
  useEffect(() => {
    if (selectedMotivations.length > 0 && copyVariations.length === 0 && !processing) {
      actions.generateCopy();
    }
  }, [selectedMotivations.length, copyVariations.length, processing, actions]);

  // Handle copy selection
  const handleSelectCopy = useCallback(
    (id: string) => {
      actions.selectCopy(id);
    },
    [actions]
  );

  // Handle next step
  const handleNext = useCallback(async () => {
    const selectedCopy = copyVariations.filter((c: any) => c.selected);
    if (selectedCopy.length === 0) {
      actions.setError('Please select at least one copy variation');
      return;
    }

    // Store selected copy variations and proceed
    try {
      await actions.storeCopyVariations(selectedCopy);
      actions.clearError();
      onNext?.();
    } catch (error: any) {
      // Error is already handled in storeCopyVariations
    }
  }, [copyVariations, actions, onNext]);

  // Handle regenerate copy
  const handleRegenerateCopy = useCallback(() => {
    actions.generateCopy();
  }, [actions]);

  // Clear error
  const handleClearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  // Copy to clipboard
  const handleCopyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  }, []);

  // Get selected count
  const selectedCount = copyVariations.filter((c: any) => c.selected).length;

  // Group copy variations by platform
  const copyByPlatform = copyVariations.reduce(
    (acc, copy) => {
      if (!acc[copy.platform]) {
        acc[copy.platform] = [];
      }
      acc[copy.platform]?.push(copy);
      return acc;
    },
    {} as Record<string, typeof copyVariations>
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Copy Generation
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        AI-generated copy variations based on your selected motivations and brief details.
      </Typography>

      {/* Selected Motivations Summary */}
      {selectedMotivations.length > 0 && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            Selected Motivations ({selectedMotivations.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {selectedMotivations.map((motivation: any) => (
              <Chip key={motivation.id} label={motivation.title} color="primary" size="small" />
            ))}
          </Stack>
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
            Generating copy variations...
          </Typography>
        </Box>
      )}

      {/* Selection Summary */}
      {copyVariations.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedCount} of {copyVariations.length} copy variations selected
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

      {/* Copy Variations by Platform */}
      {Object.keys(copyByPlatform).length > 0 && (
        <Box sx={{ mb: 4 }}>
          {Object.entries(copyByPlatform).map(([platform, copies]) => (
            <Box key={platform} sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {platform}
                <Chip label={`${copies.length} variations`} size="small" />
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
                }}
              >
                {copies.map((copy: any) => (
                  <Box key={copy.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: copy.selected ? 2 : 1,
                        borderColor: copy.selected ? 'primary.main' : 'grey.300',
                        bgcolor: copy.selected ? 'primary.50' : 'background.paper',
                        transition: 'all 0.2s ease-in-out',
                        height: '100%',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'translateY(-2px)',
                          boxShadow: 2,
                        },
                      }}
                      onClick={() => handleSelectCopy(copy.id)}
                    >
                      <CardContent
                        sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                          <Checkbox
                            checked={copy.selected}
                            onChange={() => handleSelectCopy(copy.id)}
                            sx={{ p: 0, mr: 1 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                flex: 1,
                                lineHeight: 1.5,
                                mb: 2,
                                minHeight: '60px',
                                display: '-webkit-box',
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {copy.text}
                            </Typography>
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mt: 'auto',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {copy.selected && (
                              <CheckCircleIcon color="primary" sx={{ fontSize: 20 }} />
                            )}
                          </Box>
                          <Button
                            size="small"
                            onClick={e => {
                              e.stopPropagation();
                              handleCopyToClipboard(copy.text);
                            }}
                            startIcon={<ContentCopyIcon />}
                          >
                            Copy
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>

              {platform !== Object.keys(copyByPlatform)[Object.keys(copyByPlatform).length - 1] && (
                <Divider sx={{ mt: 3 }} />
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Empty State */}
      {copyVariations.length === 0 && !processing && selectedMotivations.length > 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', mb: 4 }}>
          <AutoAwesomeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Copy Generated Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click the button below to generate copy variations based on your selected motivations.
          </Typography>
          <Button
            variant="contained"
            onClick={handleRegenerateCopy}
            startIcon={<AutoAwesomeIcon />}
          >
            Generate Copy
          </Button>
        </Paper>
      )}

      {/* No Motivations Selected State */}
      {selectedMotivations.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', mb: 4 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            No motivations selected. Please go back and select at least one motivation.
          </Alert>
        </Paper>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onPrevious} startIcon={<ArrowBackIcon />}>
          Back to Motivations
        </Button>

        <Stack direction="row" spacing={2}>
          {copyVariations.length > 0 && (
            <Button
              variant="outlined"
              onClick={handleRegenerateCopy}
              startIcon={<AutoAwesomeIcon />}
              disabled={processing || selectedMotivations.length === 0}
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
            Continue to Assets ({selectedCount} selected)
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
