// Admin performance monitoring page
import { GetServerSideProps } from 'next';
import PerformanceDashboard from '@/components/admin/PerformanceDashboard';
import {
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Divider
} from '@mui/material';

interface PerformancePageProps {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

const PerformancePage: React.FC<PerformancePageProps> = () => {
  return (
    <div>
      <Box sx={{ p: 3 }}>
        {/* Page Header */}
        <Box mb={3}>
          <Typography variant="h4" gutterBottom>
            Performance Monitoring
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Monitor Core Web Vitals, performance metrics, and user experience in real-time.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            This dashboard tracks performance metrics including LCP (Largest Contentful Paint), 
            FID (First Input Delay), CLS (Cumulative Layout Shift), and other key performance indicators.
          </Alert>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Monitoring Status
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time performance monitoring is active and collecting metrics.
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Performance Dashboard */}
        <PerformanceDashboard />
      </Box>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  // Mock session for development - replace with real auth in production
  return {
    props: {
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    },
  };
};

export default PerformancePage;