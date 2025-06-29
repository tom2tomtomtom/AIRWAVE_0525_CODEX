import React, { useState } from 'react';
import { Box, Typography, Button, ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { UnifiedBriefWorkflow } from '@/components/UnifiedBriefWorkflow';
import { NotificationProvider } from '@/contexts/NotificationContext';

const theme = createTheme();

const TestFlowPage: React.FC = () => {
  const [openWorkflow, setOpenWorkflow] = useState(false);

  const handleWorkflowComplete = (_data: any) => {
    setOpenWorkflow(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <Box sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            Test Flow Page
          </Typography>
          <Typography variant="body1" paragraph>
            This is a test page to verify the Flow workflow functionality without authentication.
          </Typography>

          <Button
            variant="contained"
            size="large"
            onClick={() => setOpenWorkflow(true)}
            data-testid="start-flow-button"
          >
            Start Flow Test
          </Button>

          <UnifiedBriefWorkflow
            open={openWorkflow}
            onClose={() => setOpenWorkflow(false)}
            onComplete={handleWorkflowComplete}
          />
        </Box>
      </NotificationProvider>
    </ThemeProvider>
  );
};

// Override getServerSideProps to prevent auth redirect
export async function getServerSideProps() {
  return {
    props: {},
  };
}

export default TestFlowPage;
