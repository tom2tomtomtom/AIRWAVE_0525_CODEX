import React from 'react';
import Head from 'next/head';
import { Box, Typography, Paper } from '@mui/material';
import DashboardLayout from '@/components/DashboardLayout';
import AIImageGenerator from '@/components/AIImageGenerator';

const AIToolsPage: React.FC = () => {
  const handleImageGenerated = (_image: any) => {
    // Image generated successfully
  };

  return (
    <>
       <Head>
        <title>AI Tools | AIrFLOW</title>
      </Head>
      <DashboardLayout>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
            AI Tools
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Use AI-powered tools to generate content for your campaigns
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <AIImageGenerator clientId="demo-client" onImageGenerated={handleImageGenerated} />
        </Paper>
      </DashboardLayout>
    </>
  );
};

export default AIToolsPage;
