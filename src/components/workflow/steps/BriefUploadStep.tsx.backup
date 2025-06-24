import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  TextField,
  Alert,
  LinearProgress,
  Paper} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  Clear as ClearIcon} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useWorkflow } from '../WorkflowProvider';
import { BriefData, StepComponentProps } from '@/lib/workflow/workflow-types';
import { withErrorBoundary } from '../ErrorBoundary';

interface BriefUploadStepProps extends StepComponentProps {}

const BriefUploadStepComponent: React.FC<BriefUploadStepProps> = ({
  onNext}) => {
  const { state, actions } = useWorkflow();
  const {
    briefData,
    originalBriefData,
    processing,
    uploadedFile,
    showBriefReview,
    briefConfirmed,
    lastError} = state;

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      actions.uploadBrief(file);
    }
  }, [actions]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {},
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']},
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // Handle field changes in brief review
  const handleFieldChange = useCallback((field: keyof BriefData, value: any) => {
    if (briefData) {
      const updatedBrief = { ...briefData, [field]: value };
      actions.confirmBrief(updatedBrief);
    }
  }, [briefData, actions]);

  // Handle brief confirmation
  const handleConfirmBrief = useCallback(() => {
    if (briefData) {
      actions.confirmBrief(briefData);
      onNext?.();
    }
  }, [briefData, actions, onNext]);

  // Handle reset to original
  const handleResetBrief = useCallback(() => {
    actions.resetBrief();
  }, [actions]);

  // Clear error
  const handleClearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  // Render file upload area
  const renderFileUpload = () => (
    <Card
      {...getRootProps()}
      sx={{
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        border: '2px dashed',
        borderColor: isDragActive ? 'primary.main' : 'grey.300',
        bgcolor: isDragActive ? 'action.hover' : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover'}}}
    >
      <input {...getInputProps()} />
      <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        {isDragActive ? 'Drop your brief here' : 'Upload Your Brief'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag and drop your brief file here, or click to select
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Supported formats: PDF, DOC, DOCX, TXT (max 10MB)
      </Typography>
      {uploadedFile && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="primary">
            <CheckCircleIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            {uploadedFile.name}
          </Typography>
        </Box>
      )}
    </Card>
  );

  // Render brief review form
  const renderBriefReview = () => {
    if (!briefData) return null;

    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Review & Edit Parsed Brief
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please review the parsed content and make any necessary edits before proceeding.
        </Typography>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField
            fullWidth
            label="Title"
            variant="outlined"
            value={briefData.title || ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Campaign title"
          />

          <TextField
            fullWidth
            label="Industry"
            variant="outlined"
            value={briefData.industry || ''}
            onChange={(e) => handleFieldChange('industry', e.target.value)}
            placeholder="e.g., Technology, Healthcare, Retail"
          />

          <TextField
            fullWidth
            label="Product/Service"
            variant="outlined"
            value={briefData.product || briefData.service || ''}
            onChange={(e) => handleFieldChange('product', e.target.value)}
            placeholder="Describe your product or service"
          />

          <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
            <TextField
              fullWidth
              label="Objective"
              multiline
              rows={4}
              variant="outlined"
              value={typeof briefData.objective === 'string' ? briefData.objective : String(briefData.objective || '')}
              onChange={(e) => handleFieldChange('objective', e.target.value)}
              placeholder="Describe the main objective of your campaign..."
            />
          </Box>

          <TextField
            fullWidth
            label="Target Audience"
            multiline
            rows={4}
            variant="outlined"
            value={typeof briefData.targetAudience === 'string' ? briefData.targetAudience : String(briefData.targetAudience || '')}
            onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
            placeholder="Describe your target audience in detail..."
          />

          <TextField
            fullWidth
            label="Value Proposition"
            multiline
            rows={4}
            variant="outlined"
            value={typeof briefData.valueProposition === 'string' ? briefData.valueProposition || '' : String(briefData.valueProposition || '')}
            onChange={(e) => handleFieldChange('valueProposition', e.target.value)}
            placeholder="What unique value does your product/service offer?"
          />

          <TextField
            fullWidth
            label="Budget"
            variant="outlined"
            value={briefData.budget || ''}
            onChange={(e) => handleFieldChange('budget', e.target.value)}
            placeholder="e.g., $50,000 or TBD"
          />

          <TextField
            fullWidth
            label="Timeline"
            variant="outlined"
            value={briefData.timeline || ''}
            onChange={(e) => handleFieldChange('timeline', e.target.value)}
            placeholder="e.g., 3 months or Q1 2024"
          />
        </Box>

        <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={handleResetBrief}
            startIcon={<ClearIcon />}
          >
            Reset to Original
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmBrief}
            startIcon={<ArrowForwardIcon />}
          >
            Confirm & Generate Motivations
          </Button>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Upload Your Brief
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Start by uploading your campaign brief. Our AI will parse the content and extract key information.
      </Typography>

      {/* Error Alert */}
      {lastError && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          onClose={handleClearError}
        >
          {lastError}
        </Alert>
      )}

      {/* Processing Indicator */}
      {processing && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Processing your brief...
          </Typography>
        </Box>
      )}

      {/* File Upload or Brief Review */}
      {showBriefReview ? renderBriefReview() : renderFileUpload()}

      {/* Success Message */}
      {briefConfirmed && (
        <Alert severity="success" sx={{ mt: 3 }}>
          Brief confirmed! Ready to generate motivations.
        </Alert>
      )}
    </Box>
  );
};

// Export with error boundary
export const BriefUploadStep = withErrorBoundary(BriefUploadStepComponent, 'BriefUploadStep');
