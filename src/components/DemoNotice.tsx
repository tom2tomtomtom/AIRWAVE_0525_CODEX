import React from 'react';
import { Alert, AlertTitle, Box, Typography, Chip } from '@mui/material';
import { Info, Warning } from '@mui/icons-material';
import { isDemoMode } from '@/lib/demo-mode';

const DemoNotice: React.FC = () => {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <Alert
      severity="info"
      icon={<Info />}
      sx={{
        mb: 2,
        borderRadius: 2,
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        borderColor: 'primary.main',
      }}
    >
      <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" component="span">
          🚀 AIRWAVE Platform Demo
        </Typography>
        <Chip label="Demo Mode" color="primary" size="small" />
      </AlertTitle>
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" gutterBottom>
          Welcome to the AIRWAVE AI-powered video marketing platform! This is a live demonstration
          of our platform's capabilities.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>✨ Features showcased:</strong>
          <br />
          • 🎬 AI Video Studio interface
          <br />
          • 📊 Analytics dashboard
          <br />
          • 👥 Client management system
          <br />
          • ⚡ Performance optimizations
          <br />• 🛡️ Security features
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          <Warning fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
          Demo mode: External APIs are mocked for demonstration purposes.
        </Typography>
      </Box>
    </Alert>
  );
};

export default DemoNotice;
