import React from 'react';
import { Box, Card, CardContent, Skeleton, Grid, List, ListItem, Avatar } from '@mui/material';

// Generic skeleton for cards
export const CardSkeleton: React.FC<{ height?: number }> = ({ height = 200 }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box ml={2} flex={1}>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="40%" height={16} />
        </Box>
      </Box>
      <Skeleton variant="rectangular" width="100%" height={height - 120} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="80%" height={16} />
      <Skeleton variant="text" width="60%" height={16} />
    </CardContent>
  </Card>
);

// Dashboard stats skeleton
export const StatsSkeleton: React.FC = () => (
  <Grid container spacing={3}>
    {[...Array(6)].map((_, index) => (
      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }} key={index}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Skeleton variant="text" width={80} height={16} />
                <Skeleton variant="text" width={60} height={32} sx={{ my: 1 }} />
                <Skeleton variant="text" width={40} height={14} />
              </Box>
              <Skeleton variant="circular" width={48} height={48} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// List item skeleton
export const ListItemSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => (
  <List>
    {[...Array(items)].map((_, index) => (
      <ListItem key={index}>
        <Avatar sx={{ mr: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
        </Avatar>
        <Box flex={1}>
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="50%" height={16} />
        </Box>
        <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
      </ListItem>
    ))}
  </List>
);

// Table skeleton
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4}) => (
  <Box>
    {/* Header */}
    <Box display="flex" gap={2} mb={2} p={2} bgcolor="background.paper">
      {[...Array(columns)].map((_, index) => (
        <Skeleton key={index} variant="text" width={`${100 / columns}%`} height={24} />
      ))}
    </Box>

    {/* Rows */}
    {[...Array(rows)].map((_, rowIndex) => (
      <Box key={rowIndex} display="flex" gap={2} p={2} borderBottom={1} borderColor="divider">
        {[...Array(columns)].map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" width={`${100 / columns}%`} height={20} />
        ))}
      </Box>
    ))}
  </Box>
);

// Form skeleton
export const FormSkeleton: React.FC = () => (
  <Box>
    <Skeleton variant="text" width="30%" height={32} sx={{ mb: 3 }} />

    {[...Array(4)].map((_, index) => (
      <Box key={index} mb={3}>
        <Skeleton variant="text" width="20%" height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
      </Box>
    ))}

    <Box display="flex" gap={2} mt={4}>
      <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" width={100} height={40} sx={{ borderRadius: 1 }} />
    </Box>
  </Box>
);

// Content skeleton with image
export const ContentSkeleton: React.FC = () => (
  <Box>
    <Skeleton variant="rectangular" width="100%" height={200} sx={{ mb: 2, borderRadius: 1 }} />
    <Skeleton variant="text" width="80%" height={32} sx={{ mb: 1 }} />
    <Skeleton variant="text" width="60%" height={24} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="100%" height={16} sx={{ mb: 1 }} />
    <Skeleton variant="text" width="90%" height={16} sx={{ mb: 1 }} />
    <Skeleton variant="text" width="70%" height={16} />
  </Box>
);

// Navigation skeleton
export const NavigationSkeleton: React.FC = () => (
  <Box p={2}>
    <Skeleton variant="text" width="60%" height={32} sx={{ mb: 3 }} />

    {[...Array(6)].map((_, index) => (
      <Box key={index} display="flex" alignItems="center" mb={2}>
        <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
        <Skeleton variant="text" width="70%" height={20} />
      </Box>
    ))}
  </Box>
);

// Workflow step skeleton
export const WorkflowSkeleton: React.FC = () => (
  <Box>
    {/* Stepper */}
    <Box display="flex" justifyContent="center" mb={4}>
      {[...Array(5)].map((_, index) => (
        <Box key={index} display="flex" alignItems="center">
          <Skeleton variant="circular" width={32} height={32} />
          {index < 4 && <Skeleton variant="rectangular" width={60} height={2} sx={{ mx: 1 }} />}
        </Box>
      ))}
    </Box>

    {/* Content */}
    <Card>
      <CardContent>
        <Skeleton variant="text" width="40%" height={32} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={200} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="text" width="80%" height={20} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="60%" height={20} />
      </CardContent>
    </Card>
  </Box>
);

// Analytics skeleton
export const AnalyticsSkeleton: React.FC = () => (
  <Grid container spacing={3}>
    {/* KPI Cards */}
    <Grid size={{ xs: 12 }}>
      <Grid container spacing={2}>
        {[...Array(4)].map((_, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card>
              <CardContent>
                <Box textAlign="center">
                  <Skeleton variant="text" width="60%" height={20} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="40%" height={40} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="50%" height={16} sx={{ mx: 'auto' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Grid>

    {/* Charts */}
    <Grid size={{ xs: 12, md: 8 }}>
      <Card>
        <CardContent>
          <Skeleton variant="text" width="30%" height={24} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    </Grid>

    <Grid size={{ xs: 12, md: 4 }}>
      <Card>
        <CardContent>
          <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
          <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} />
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

// Asset grid skeleton
export const AssetGridSkeleton: React.FC<{ items?: number }> = ({ items = 12 }) => (
  <Grid container spacing={2}>
    {[...Array(items)].map((_, index) => (
      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={index}>
        <Card>
          <Skeleton variant="rectangular" width="100%" height={160} />
          <CardContent>
            <Skeleton variant="text" width="80%" height={20} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="60%" height={16} />
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// Progress skeleton with steps
export const ProgressSkeleton: React.FC = () => (
  <Box>
    <Box display="flex" alignItems="center" mb={2}>
      <Skeleton variant="text" width="30%" height={24} />
      <Box flex={1} mx={2}>
        <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 1 }} />
      </Box>
      <Skeleton variant="text" width="10%" height={20} />
    </Box>

    <Skeleton variant="text" width="50%" height={16} />
  </Box>
);

// Chat/Activity skeleton
export const ActivitySkeleton: React.FC = () => (
  <List>
    {[...Array(5)].map((_, index) => (
      <ListItem key={index} alignItems="flex-start">
        <Skeleton variant="circular" width={32} height={32} sx={{ mr: 2, mt: 0.5 }} />
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Skeleton variant="text" width="30%" height={16} />
            <Skeleton variant="text" width="20%" height={14} />
          </Box>
          <Skeleton variant="text" width="90%" height={16} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width="70%" height={16} />
        </Box>
      </ListItem>
    ))}
  </List>
);
