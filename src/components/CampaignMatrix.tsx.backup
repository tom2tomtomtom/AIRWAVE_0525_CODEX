import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Slider,
  Alert,
  LinearProgress,
  Stack} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Lock as LockIcon,
  AutoAwesome as MagicIcon,
  PlayArrow as RenderIcon,
  More as MoreIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  MusicNote as MusicIcon,
  TextFields as TextIcon,
  Palette as ColorIcon} from '@mui/icons-material';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';

// Interfaces
interface MatrixRow {
  id: string;
  name: string;
  locked: boolean;
  cells: { }
    [fieldId: string]: {
      type: 'asset' | 'text' | 'color';
      value?: string;
      assetId?: string;
      locked?: boolean;
    };
  };
}

interface MatrixField {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'text' | 'color';
  required: boolean;
  description?: string;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnail?: string;
}

interface CampaignMatrixProps {
  campaignId?: string;
  onRender?: (combinations: any[]) => void;
}

const defaultFields: MatrixField[] = [
  { id: 'background', name: 'Background', type: 'image', required: true, description: 'Background image or video'  }
  { id: 'headline', name: 'Headline', type: 'text', required: true, description: 'Main headline text'  }
  { id: 'copy', name: 'Copy', type: 'text', required: true, description: 'Body copy text'  }
  { id: 'logo', name: 'Logo', type: 'image', required: false, description: 'Brand logo'  }
  { id: 'music', name: 'Music', type: 'audio', required: false, description: 'Background music'  }
  { id: 'voice', name: 'Voice Over', type: 'audio', required: false, description: 'Voice over audio'  }
  { id: 'color', name: 'Brand Color', type: 'color', required: false, description: 'Primary brand color'  }
];

export const CampaignMatrix: React.FC<CampaignMatrixProps> = ({
  campaignId,
  onRender}) => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();

  // State
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [fields] = useState<MatrixField[]>(defaultFields);
  const [selectedAssetDialog, setSelectedAssetDialog] = useState<{
    rowId: string;
    fieldId: string;
    type: string;
  } | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [combinations, setCombinations] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [maxCombinations, setMaxCombinations] = useState(10);

  // Initialize with one empty row
  useEffect(() => {
    if (rows.length === 0) {
      addRow();
    }
  }, []);

  // Load assets when component mounts
  useEffect(() => {
    loadAssets();
  }, [activeClient]);

  const loadAssets = async () => {
    if (!activeClient) return;
    
    setLoadingAssets(true);
    try {
      const response = await fetch(`/api/assets?client_id=${activeClient.id}`);
      const data = await response.json();
      
      if (data.success) {
        setAssets(data.assets || []);
      }
    } catch (error: any) {
      console.error('Error loading assets:', error);
      showNotification('Failed to load assets', 'error');
    } finally {
      setLoadingAssets(false);
    }
  };

  const addRow = () => {
    const newRow: MatrixRow = {
      id: `row-${Date.now()}`,
      name: `Variation ${rows.length + 1}`,
      locked: false,
      cells: {}
    };

    // Initialize cells for all fields
    fields.forEach((field: any) => {
      newRow.cells[field.id] = {
        type: field.type === 'color' ? 'color' : field.type === 'text' ? 'text' : 'asset'};
    });

    setRows([...rows, newRow]);
  };

  const duplicateRow = (rowId: string) => {
    const row = rows.find((r: any) => r.id === rowId);
    if (!row) return;

    const newRow: MatrixRow = {
      ...row,
      id: `row-${Date.now()}`,
      name: `${row.name} (Copy)`,
      locked: false};

    setRows([...rows, newRow]);
    showNotification('Row duplicated successfully', 'success');
  };

  const deleteRow = (rowId: string) => {
    if (rows.length <= 1) {
      showNotification('Cannot delete the last row', 'warning');
      return;
    }

    setRows(rows.filter((r: any) => r.id !== rowId));
    showNotification('Row deleted successfully', 'success');
  };

  const toggleRowLock = (rowId: string) => {
    setRows(rows.map((row: any) => 
      row.id === rowId 
        ? { ...row, locked: !row.locked }
        : row
    ));
  };

  const toggleCellLock = (rowId: string, fieldId: string) => {
    setRows(rows.map((row: any) => {
      if (row.id === rowId) {
        return {
          ...row,
          cells: { }
            ...row.cells,
            [fieldId]: {
              ...row.cells[fieldId],
              locked: !row.cells[fieldId]?.locked}
          }
        };
      }
      return row;
    }));
  };

  const updateCell = (rowId: string, fieldId: string, updates: any) => {
    setRows(rows.map((row: any) => {
      if (row.id === rowId) {
        return {
          ...row,
          cells: { }
            ...row.cells,
            [fieldId]: {
              ...row.cells[fieldId],
              ...updates}
          }
        };
      }
      return row;
    }));
  };

  const openAssetDialog = (rowId: string, fieldId: string, type: string) => {
    setSelectedAssetDialog({ rowId, fieldId, type });
  };

  const selectAsset = (asset: Asset) => {
    if (!selectedAssetDialog) return;

    const { rowId, fieldId } = selectedAssetDialog;
    updateCell(rowId, fieldId, {
      assetId: asset.id,
      value: asset.name});

    setSelectedAssetDialog(null);
    showNotification('Asset assigned successfully', 'success');
  };

  const generateCombinations = async () => {
    setGenerating(true);
    
    try {
      // Calculate all possible combinations
      const unlockedRows = rows.filter((row: any) => !row.locked);
      const lockedRows = rows.filter((row: any) => row.locked);
      
      // Generate combinations logic here
      const newCombinations = [];
      
      // For now, create variations based on different assets
      for (let i = 0; i < Math.min(maxCombinations, unlockedRows.length * 3); i++) {
        const combination: { id: string; name: string; fields: Record<string, any> } = {
          id: `combo-${Date.now()}-${i}`,
          name: `Combination ${i + 1}`,
          fields: {}
        };

        // Copy from a random unlocked row or use locked row data
        const sourceRow = unlockedRows[i % unlockedRows.length] || rows[0];
        fields.forEach((field: any) => {
          combination.fields[field.id] = sourceRow.cells[field.id] || { type: field.type, value: '' };
        });

        newCombinations.push(combination);
      }

      setCombinations(newCombinations);
      showNotification(`Generated ${newCombinations.length} combinations`, 'success');
    } catch (error: any) {
      console.error('Error generating combinations:', error);
      showNotification('Failed to generate combinations', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleRender = async () => {
    if (combinations.length === 0) {
      showNotification('Please generate combinations first', 'warning');
      return;
    }

    if (onRender) {
      onRender(combinations);
    }

    showNotification('Sending to render queue...', 'info');
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon />;
      case 'video': return <VideoIcon />;
      case 'audio': return <MusicIcon />;
      case 'text': return <TextIcon />;
      case 'color': return <ColorIcon />;
      default: return <ImageIcon />;
    }
  };

  const getCellContent = (row: MatrixRow, field: MatrixField) => {
    const cell = row.cells[field.id];
    const isLocked = cell?.locked || row.locked;

    if (field.type === 'text') {
      return (
        <Box display="flex" alignItems="center" gap={1}>
          <Typography 
            variant="body2" 
            sx={{ 
              flexGrow: 1,
              cursor: 'pointer',
              p: 1,
              border: '1px dashed transparent',
              '&:hover': { borderColor: 'divider' }
            }}
            onClick={() => {
              const newValue = prompt('Enter text:', cell?.value || '');
              if (newValue !== null) {
                updateCell(row.id, field.id, { value: newValue });
              }
            }}
          >
            {cell?.value || 'Click to enter text'}
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => toggleCellLock(row.id, field.id)}
            color={isLocked ? 'primary' : 'default'}
          >
            {isLocked ? <LockIcon fontSize="small" /> : <LockIcon fontSize="small" />}
          </IconButton>
        </Box>
      );
    }

    if (field.type === 'color') {
      return (
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 24,
              height: 24,
              backgroundColor: cell?.value || '#000000',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              cursor: 'pointer'}}
            onClick={() => {
              const newColor = prompt('Enter color (hex):', cell?.value || '#000000');
              if (newColor) {
                updateCell(row.id, field.id, { value: newColor });
              }
            }}
          />
          <Typography variant="body2">
            {cell?.value || 'Click to set color'}
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => toggleCellLock(row.id, field.id)}
            color={isLocked ? 'primary' : 'default'}
          >
            {isLocked ? <LockIcon fontSize="small" /> : <LockIcon fontSize="small" />}
          </IconButton>
        </Box>
      );
    }

    // Asset types (image, video, audio)
    const asset = assets.find((a: any) => a.id === cell?.assetId);
    
    return (
      <Box display="flex" alignItems="center" gap={1}>
        {asset ? (
          <>
       <Avatar 
              src={asset.thumbnail || asset.url} 
              sx={{ width: 32, height: 32 }}
            >
              {getFieldIcon(field.type)}
            </Avatar>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {asset.name}
            </Typography>
          </>
        ) : (
          <Button
            variant="outlined"
            size="small"
            startIcon={getFieldIcon(field.type)}
            onClick={() => openAssetDialog(row.id, field.id, field.type)}
            disabled={isLocked}
          >
            Select {field.name}
          </Button>
        )}
        <IconButton 
          size="small" 
          onClick={() => toggleCellLock(row.id, field.id)}
          color={isLocked ? 'primary' : 'default'}
        >
          {isLocked ? <LockIcon fontSize="small" /> : <LockIcon fontSize="small" />}
        </IconButton>
      </Box>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Campaign Matrix
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addRow}
          >
            Add Row
          </Button>
          <Button
            variant="outlined"
            startIcon={<MagicIcon />}
            onClick={generateCombinations}
            disabled={generating}
          >
            Generate Combinations
          </Button>
          <Button
            variant="contained"
            startIcon={<RenderIcon />}
            onClick={handleRender}
            disabled={combinations.length === 0}
          >
            Render Videos
          </Button>
        </Stack>
      </Box>

      {generating && (
        <Box mb={2}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            Generating combinations...
          </Typography>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="40px">#</TableCell>
              <TableCell width="150px">Variation Name</TableCell>
              {fields.map((field: any) => (
                <TableCell key={field.id} width="200px">
                  <Box display="flex" alignItems="center" gap={1}>
                    {getFieldIcon(field.type)}
                    {field.name}
                    {field.required && (
                      <Chip label="Required" size="small" color="primary" />
                    )}
                  </Box>
                </TableCell>
              ))}
              <TableCell width="100px">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id} sx={{ 
                backgroundColor: row.locked ? 'action.hover' : 'inherit' 
              }}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">{row.name}</Typography>
                    {row.locked && <LockIcon fontSize="small" color="primary" />}
                  </Box>
                </TableCell>
                {fields.map((field: any) => (
                  <TableCell key={field.id}>
                    {getCellContent(row, field)}
                  </TableCell>
                ))}
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      setMenuAnchor(e.currentTarget);
                      setSelectedRow(row.id);
                    }}
                  >
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {combinations.length > 0 && (
        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Generated Combinations ({combinations.length})
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {combinations.length} combinations ready for rendering
          </Alert>
          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Max Combinations: {maxCombinations}
            </Typography>
            <Slider
              value={maxCombinations}
              onChange={(_, value) => setMaxCombinations(value as number)}
              min={1}
              max={50}
              marks
              valueLabelDisplay="auto"
              sx={{ width: 200 }}
            />
          </Box>
        </Box>
      )}

      {/* Row Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor && selectedRow)}
        onClose={() => {
          setMenuAnchor(null);
          setSelectedRow(null);
        }}
      >
        <MenuItem onClick={() => {
          if (selectedRow) duplicateRow(selectedRow);
          setMenuAnchor(null);
          setSelectedRow(null);
        }}>
          <DuplicateIcon sx={{ mr: 1 }} />
          Duplicate Row
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedRow) toggleRowLock(selectedRow);
          setMenuAnchor(null);
          setSelectedRow(null);
        }}>
          <LockIcon sx={{ mr: 1 }} />
          {selectedRow && rows.find((r: any) => r.id === selectedRow)?.locked ? 'Unlock' : 'Lock'} Row
        </MenuItem>
        <MenuItem 
          onClick={() => {
            if (selectedRow) deleteRow(selectedRow);
            setMenuAnchor(null);
            setSelectedRow(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Row
        </MenuItem>
      </Menu>

      {/* Asset Selection Dialog */}
      <Dialog
        open={Boolean(selectedAssetDialog)}
        onClose={() => setSelectedAssetDialog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Select {selectedAssetDialog?.type} Asset
        </DialogTitle>
        <DialogContent>
          {loadingAssets ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {assets
                .filter((asset: any) => 
                  selectedAssetDialog?.type === 'image' ? asset.type === 'image' :
                  selectedAssetDialog?.type === 'video' ? asset.type === 'video' :
                  selectedAssetDialog?.type === 'audio' ? asset.type === 'audio' :
                  true
                )
                .map((asset: any) => (
                  <Grid size={{ xs: 6, md: 4 }} key={asset.id}>
                    <Card 
                      sx={{ cursor: 'pointer' }}
                      onClick={() => selectAsset(asset)}
                    >
                      <CardMedia
                        component="img"
                        height="140"
                        image={asset.thumbnail || asset.url}
                        alt={asset.name}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent>
                        <Typography variant="body2">
                          {asset.name}
                        </Typography>
                        <Chip label={asset.type} size="small" />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedAssetDialog(null)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CampaignMatrix;