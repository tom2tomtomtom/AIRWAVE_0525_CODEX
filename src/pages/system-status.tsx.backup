import React from 'react';
import { useEffect, useState } from 'react';
import { Box, Container, Typography, Paper, Alert, CircularProgress, Chip, List, ListItem, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';

interface SystemStatus {
  status: 'ready' | 'incomplete';
  timestamp: string;
  environment: Record<string, string>;
  supabase: {},
  status: string;
    url: string;
  };
  configuration: {},
  isDemoMode: boolean;
    isConfigured: boolean;
    missingRequired: string[] | null;
  };
  deployment: {},
  platform: string;
    region: string;
  };
  recommendations: {},
  message: string;
    steps: string[];
  } | null;
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/system/status')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch system status');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!status) return null;

  const getStatusIcon = (value: string) => {
    if (value.includes('✅')) return <CheckCircleIcon color="success" />;
    if (value.includes('❌')) return <ErrorIcon color="error" />;
    return <WarningIcon color="warning" />;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom align="center">
        AIrFLOW System Status
      </Typography>
      
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Chip 
          label={status.status === 'ready' ? 'System Ready' : 'Configuration Incomplete'}
          color={status.status === 'ready' ? 'success' : 'warning'}
          size="medium"
        />
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Last checked: {new Date(status.timestamp).toLocaleString()}
        </Typography>
      </Box>


      {status.recommendations && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {status.recommendations.message}
          </Typography>
          <List dense>
            {status.recommendations.steps.map((step, index) => (
              <ListItem key={index}>
                <ListItemText primary={`${index + 1}. ${step}`} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Environment Configuration
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
          {Object.entries(status.environment).map(([key, value]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon(value)}
              <Typography variant="body2">
                <strong>{key}:</strong> {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Supabase Connection
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {getStatusIcon(status.supabase.status)}
          <Typography>Status: {status.supabase.status}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          URL: {status.supabase.url}
        </Typography>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Deployment Information
        </Typography>
        <Typography variant="body2">
          <strong>Platform:</strong> {status.deployment.platform}
        </Typography>
        <Typography variant="body2">
          <strong>Region:</strong> {status.deployment.region}
        </Typography>
      </Paper>
    </Container>
  );
}