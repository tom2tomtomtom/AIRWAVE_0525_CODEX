import React, { useState } from 'react';
import Head from 'next/head';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  TrendingUp as StrategyIcon,
  Lightbulb as IdeaIcon,
  GpsFixed as TargetIcon} from '@mui/icons-material';
import DashboardLayout from '@/components/DashboardLayout';
import { useNotification } from '@/contexts/NotificationContext';

interface StrategyInsight {
  title: string;
  description: string;
  category: 'audience' | 'messaging' | 'channels' | 'timing';
  priority: 'high' | 'medium' | 'low';
}

const StrategyPage: React.FC = () => {
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<StrategyInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { showNotification } = useNotification();

  const handleGenerateStrategy = async () => {
    if (!brief.trim()) {
      showNotification('Please enter a brief to generate strategy insights', 'warning');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/strategy-generate', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
      
      },
        body: JSON.stringify({ brief }),
        credentials: 'include'});

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to generate strategy`);
      }

      const result = await response.json();

      if (result.success) {
        setInsights(result.data.insights || []);
        showNotification('Strategy insights generated successfully!', 'success');
      } else {
        throw new Error(result.message || 'Failed to generate strategy');
      }
    } catch (error: any) {
      console.error('Error generating strategy:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate strategy';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'audience': return 'primary';
      case 'messaging': return 'secondary';
      case 'channels': return 'success';
      case 'timing': return 'warning';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  return (
    <>
       <Head>
        <title>Strategy | AIRFLOW</title>
      </Head>
      <DashboardLayout title="Strategy">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
            AI Strategy Generator
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Generate strategic insights and recommendations using AI analysis
          </Typography>
        </Box>

        {/* Brief Input Section */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Campaign Brief
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Describe your campaign objectives, target audience, and key requirements
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder="Enter your campaign brief here... Include details about your product/service, target audience, goals, budget, timeline, and any specific requirements."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <AIIcon />}
            onClick={handleGenerateStrategy}
            disabled={loading || !brief.trim()}
            sx={{ minWidth: 200 }}
          >
            {loading ? 'Generating...' : 'Generate Strategy'}
          </Button>
        </Paper>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Strategy Insights */}
        {insights.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StrategyIcon />
              Strategy Insights
            </Typography>
            <Grid container spacing={3}>
              {insights.map((insight, index) => (
                <Grid size={{ xs: 12, md: 6 }} key={index}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" component="h3">
                          {insight.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={insight.priority}
                          color={getPriorityColor(insight.priority) as any}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {insight.description}
                      </Typography>
                      <Chip
                        size="small"
                        label={insight.category}
                        color={getCategoryColor(insight.category) as any}
                        variant="outlined"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Getting Started Section */}
        {insights.length === 0 && !loading && (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
            <IdeaIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Ready to Generate Your Strategy?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
              Enter your campaign brief above and let our AI analyze your requirements to generate
              strategic insights, audience recommendations, messaging strategies, and channel suggestions.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip icon={<TargetIcon />} label="Audience Analysis" />
              <Chip icon={<AIIcon />} label="AI-Powered Insights" />
              <Chip icon={<StrategyIcon />} label="Strategic Recommendations" />
            </Box>
          </Paper>
        )}
      </DashboardLayout>
    </>
  );
};

export default StrategyPage;
