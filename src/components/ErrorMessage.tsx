import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface ErrorDetails {
  message: string;
  code?: string;
  details?: string;
  stack?: string;
}

interface ErrorMessageProps {
  error: ErrorDetails | string | Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  severity?: 'error' | 'warning' | 'info';
  title?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = true,
  severity = 'error',
  title = 'Error',
}) => {
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  // Normalize error into ErrorDetails format
  const errorDetails: ErrorDetails = React.useMemo(() => {
    if (typeof error === 'string') {
      return { message: error };
    } else if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    } else {
      return error;
    }
  }, [error]);

  const hasDetails = showDetails && (errorDetails.details || errorDetails.stack || errorDetails.code);

  return (
    <Alert
      severity={severity}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {hasDetails && (
            <IconButton
              size="small"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              aria-label="toggle error details"
            >
              {detailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
          {onRetry && (
            <Button
              size="small"
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
          {onDismiss && (
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={onDismiss}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      }
      sx={{ mb: 2 }}
    >
      <AlertTitle>{title}</AlertTitle>
      <Typography variant="body2">
        {errorDetails.message}
        {errorDetails.code && ` (Code: ${errorDetails.code})`}
      </Typography>
      
      {hasDetails && (
        <Collapse in={detailsExpanded}>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            {errorDetails.details && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Details:
                </Typography>
                <Typography variant="body2" component="pre" sx={{ 
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}>
                  {errorDetails.details}
                </Typography>
              </Box>
            )}
            
            {errorDetails.stack && process.env.NODE_ENV === 'development' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Stack Trace:
                </Typography>
                <Typography variant="body2" component="pre" sx={{ 
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                }}>
                  {errorDetails.stack}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Alert>
  );
};

export default ErrorMessage;