import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  Collapse,
  IconButton} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon} from '@mui/icons-material';
import { ActionButton } from '../buttons/ActionButton';

interface ErrorStateProps {
  type?: 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  details?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  retryText?: string;
  icon?: React.ReactNode;
  variant?: 'inline' | 'card' | 'alert';
  collapsible?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'error',
  title,
  message,
  details,
  showRetry = false,
  onRetry,
  retryText = 'Try Again',
  icon,
  variant = 'card',
  collapsible = false}) => {
  const [expanded, setExpanded] = React.useState(false);

  const getIcon = () => {
    if (icon) return icon;

    switch (type) {
      case 'warning':
        return <WarningIcon sx={{ fontSize: 40 }} />;
      case 'info':
        return <InfoIcon sx={{ fontSize: 40 }} />;
      default:
        return <ErrorIcon sx={{ fontSize: 40 }} />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'warning':
        return 'warning.main';
      case 'info':
        return 'info.main';
      default:
        return 'error.main';
    }
  };

  const getSeverity = () => {
    switch (type) {
      case 'warning':
        return 'warning' as const;
      case 'info':
        return 'info' as const;
      default:
        return 'error' as const;
    }
  };

  const renderContent = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 2,
        p: variant === 'inline' ? 2 : 3 }}
    >
      <Box sx={{ color: getColor() }}>{getIcon()}</Box>

      <Box>
        {title && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 1,
              color: 'text.primary' }}
          >
            {title}
          </Typography>
        )}

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: details || showRetry ? 2 : 0 }}
        >
          {message}
        </Typography>

        {details && (
          <Box>
            {collapsible ? (
              <>
       <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    mb: 1 }}
                  onClick={() => setExpanded(!expanded)}
                >
                  <Typography variant="body2" color="text.secondary">
                    {expanded ? 'Hide' : 'Show'} Details
                  </Typography>
                  <IconButton size="small">
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>

                <Collapse in={expanded}>
                  <Box
                    sx={{
                      mt: 1,
                      p: 2,
                      backgroundColor: 'action.hover',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider' }}
                  >
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word' }}
                    >
                      {details}
                    </Typography>
                  </Box>
                </Collapse>
              </>
            ) : (
              <Box
                sx={{
                  mt: 1,
                  p: 2,
                  backgroundColor: 'action.hover',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider' }}
              >
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word' }}
                >
                  {details}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {showRetry && onRetry && (
        <ActionButton variant="outline" onClick={onRetry} startIcon={<RefreshIcon />} size="medium">
          {retryText}
        </ActionButton>
      )}
    </Box>
  );

  const renderAlert = () => (
    <Alert
      severity={getSeverity()}
      action={
        showRetry && onRetry ? (
          <IconButton color="inherit" size="small" onClick={onRetry} aria-label={retryText}>
            <RefreshIcon />
          </IconButton>
        ) : undefined
      }
      sx={{
        borderRadius: 2,
        '& .MuiAlert-message': {
          width: '100%' }}}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      <Typography variant="body2" sx={{ mb: details ? 1 : 0 }}>
        {message}
      </Typography>

      {details && (
        <Box>
          {collapsible ? (
            <>
       <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  mt: 1 }}
                onClick={() => setExpanded(!expanded)}
              >
                <Typography variant="body2">{expanded ? 'Hide' : 'Show'} Details</Typography>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>

              <Collapse in={expanded}>
                <Box sx={{ mt: 1 }}>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word' }}
                  >
                    {details}
                  </Typography>
                </Box>
              </Collapse>
            </>
          ) : (
            <Typography
              variant="body2"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                mt: 1,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word' }}
            >
              {details}
            </Typography>
          )}
        </Box>
      )}
    </Alert>
  );

  switch (variant) {
    case 'alert':
      return renderAlert();
    case 'card':
      return (
        <Card
          elevation={0}
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider' }}
        >
          <CardContent sx={{ p: 0 }}>{renderContent()}</CardContent>
        </Card>
      );
    default:
      return renderContent();
  }
};
