import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  GridView as GridViewIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon} from '@mui/icons-material';
import { useWorkflow } from '../WorkflowProvider';
import { StepComponentProps } from '@/lib/workflow/workflow-types';

interface MatrixBuildStepProps extends StepComponentProps {}

interface MatrixItem {
  id: string;
  motivation: string;
  copy: string;
  asset: string;
  platform: string;
  status: 'pending' | 'ready' | 'error';
}

export const MatrixBuildStep: React.FC<MatrixBuildStepProps> = ({ onNext, onPrevious }) => {
  const { state, actions } = useWorkflow();
  const { briefData, motivations, copyVariations, selectedAssets, selectedTemplate, lastError } =
    state;

  const [matrixItems, setMatrixItems] = useState<MatrixItem[]>([]);
  const [buildingMatrix, setBuildingMatrix] = useState(false);

  // Get selected data
  const selectedMotivations = motivations.filter((m: any) => m.selected);
  const selectedCopy = copyVariations.filter((c: any) => c.selected);

  // Build matrix automatically when component loads
  useEffect(() => {
    if (
      selectedMotivations.length > 0 &&
      selectedCopy.length > 0 &&
      selectedAssets.length > 0 &&
      matrixItems.length === 0
    ) {
      buildMatrix();
    }
  }, [selectedMotivations, selectedCopy, selectedAssets, matrixItems.length]);

  // Build campaign matrix
  const buildMatrix = useCallback(() => {
    setBuildingMatrix(true);

    const items: MatrixItem[] = [];
    let itemId = 1;

    // Create combinations of motivations, copy, and assets
    selectedMotivations.forEach((motivation: any) => {
      selectedCopy.forEach((copy: any) => {
        selectedAssets.forEach((asset: any) => {
          items.push({
            id: `matrix-${itemId++}`,
            motivation: motivation.title,
            copy: copy.text.substring(0, 100) + (copy.text.length > 100 ? '...' : ''),
            asset: asset.metadata?.title || asset.id,
            platform: copy.platform,
            status: 'ready' });
        });
      });
    });

    // Simulate matrix building process
    setTimeout(() => {
      setMatrixItems(items);
      setBuildingMatrix(false);
    }, 1500);
  }, [selectedMotivations, selectedCopy, selectedAssets]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (matrixItems.length === 0) {
      actions.setError('Please build the campaign matrix first');
      return;
    }

    actions.clearError();
    onNext?.();
  }, [matrixItems.length, actions, onNext]);

  // Clear error
  const handleClearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  // Handle matrix item actions
  const handlePreviewItem = useCallback((item: MatrixItem) => {
    // In real implementation, this would open a preview modal
    console.log('Preview item:', item);
  }, []);

  const handleEditItem = useCallback((item: MatrixItem) => {
    // In real implementation, this would open an edit modal
    console.log('Edit item:', item);
  }, []);

  const handleDeleteItem = useCallback((itemId: string) => {
    setMatrixItems(items => items.filter((item: any) => item.id !== itemId));
  }, []);

  // Get matrix statistics
  const getMatrixStats = () => {
    const totalCombinations =
      selectedMotivations.length * selectedCopy.length * selectedAssets.length;
    const readyItems = matrixItems.filter((item: any) => item.status === 'ready').length;
    const platforms = [...new Set(matrixItems.map((item: any) => item.platform))];

    return {
      total: matrixItems.length,
      ready: readyItems,
      platforms: platforms.length,
      combinations: totalCombinations };
  };

  const stats = getMatrixStats();

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Campaign Matrix
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Review and manage your campaign matrix. Each row represents a unique combination of
        motivation, copy, and assets.
      </Typography>

      {/* Error Alert */}
      {lastError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={handleClearError}>
          {lastError}
        </Alert>
      )}

      {/* Matrix Statistics */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <GridViewIcon />
          Matrix Overview
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr'  }
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="primary">
              {stats.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Combinations
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="success.main">
              {stats.ready}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ready to Render
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="info.main">
              {stats.platforms}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Platforms
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="warning.main">
              {selectedTemplate ? 1 : 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Template Selected
            </Typography>
          </Box>
        </Box>

        {/* Selected Components Summary */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Selected Components:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip
              label={`${selectedMotivations.length} Motivations`}
              color="primary"
              size="small"
            />
            <Chip label={`${selectedCopy.length} Copy Variations`} color="secondary" size="small" />
            <Chip label={`${selectedAssets.length} Assets`} color="success" size="small" />
            {selectedTemplate && (
              <Chip label={`Template: ${selectedTemplate.name}`} color="info" size="small" />
            )}
          </Stack>
        </Box>
      </Paper>

      {/* Build Matrix Button */}
      {matrixItems.length === 0 && !buildingMatrix && (
        <Paper sx={{ p: 4, textAlign: 'center', mb: 4 }}>
          <GridViewIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Ready to Build Campaign Matrix
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Generate all possible combinations of your selected motivations, copy, and assets.
          </Typography>
          <Button
            variant="contained"
            onClick={buildMatrix}
            startIcon={<GridViewIcon />}
            size="large"
          >
            Build Matrix ({stats.combinations} combinations)
          </Button>
        </Paper>
      )}

      {/* Building Progress */}
      {buildingMatrix && (
        <Paper sx={{ p: 4, textAlign: 'center', mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Building Campaign Matrix...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Creating {stats.combinations} unique combinations
          </Typography>
        </Paper>
      )}

      {/* Matrix Table */}
      {matrixItems.length > 0 && (
        <TableContainer component={Paper} sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Motivation</TableCell>
                <TableCell>Copy Preview</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matrixItems.map((item: any) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {item.motivation}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }}>
                      {item.copy}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.asset}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={item.platform} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status}
                      size="small"
                      color={
                        item.status === 'ready'
                          ? 'success'
                          : item.status === 'error'
                            ? 'error'
                            : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Preview">
                        <IconButton size="small" onClick={() => handlePreviewItem(item)}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEditItem(item)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDeleteItem(item.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onPrevious} startIcon={<ArrowBackIcon />}>
          Back to Templates
        </Button>

        <Stack direction="row" spacing={2}>
          {matrixItems.length > 0 && (
            <Button
              variant="outlined"
              onClick={buildMatrix}
              startIcon={<GridViewIcon />}
              disabled={buildingMatrix}
            >
              Rebuild Matrix
            </Button>
          )}

          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={<ArrowForwardIcon />}
            disabled={matrixItems.length === 0}
          >
            Start Rendering ({stats.ready} items)
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
