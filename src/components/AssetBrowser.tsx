import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  InputAdornment} from '@mui/material';
import {
  Search,
  Clear,
  Favorite,
  FavoriteBorder,
  Download,
  Share,
  Image,
  VideoFile,
  AudioFile,
  TextFields,
  Refresh} from '@mui/icons-material';

interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'voice';
  url: string;
  thumbnailUrl?: string;
  description?: string;
  tags: string[];
  dateCreated: string;
  clientId: string;
  userId: string;
  favorite?: boolean;
  metadata?: Record<string, any>;
  size?: number;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
}

interface AssetBrowserProps {
  clientId?: string;
  onAssetSelect?: (asset: Asset) => void;
  selectionMode?: boolean;
}

const assetTypeIcons = {
  image: <Image />,
  video: <VideoFile />,
  voice: <AudioFile />,
  text: <TextFields />};

const assetTypeColors = {
  image: '#4CAF50',
  video: '#2196F3',
  voice: '#FF9800',
  text: '#9C27B0'};

export default function AssetBrowser({ 
  clientId, 
  onAssetSelect, 
  selectionMode = false 
}: AssetBrowserProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Dialog state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '20',
        sortBy,
        sortOrder});
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType) params.append('type', selectedType);
      if (clientId) params.append('clientId', clientId);

      const response = await fetch(`/api/assets?${params}`);
      const data = await response.json();

      if (data.success) {
        setAssets(data.assets || []);
      } else {
        setError(data.message || 'Failed to load assets');
      }
    } catch (err: any) {
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedType, sortBy, sortOrder, clientId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedType('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const handleAssetClick = (asset: Asset) => {
    if (selectionMode && onAssetSelect) {
      onAssetSelect(asset);
    } else {
      setSelectedAsset(asset);
      setDetailsOpen(true);
    }
  };

  const toggleFavorite = async (asset: Asset) => {
    try {
      const newFavoriteStatus = !asset.favorite;
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: {},
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          metadata: {},
            ...asset.metadata,
            favorite: newFavoriteStatus }})});

      if (response.ok) {
        setAssets(assets.map((a: any) => 
          a.id === asset.id ? { ...a, favorite: newFavoriteStatus } : a
        ));
      }
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div>Content</div>
  );
    <Box>
      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )}}
            />
          </Grid>
          
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={selectedType}
                label="Type"
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="image">Images</MenuItem>
                <MenuItem value="video">Videos</MenuItem>
                <MenuItem value="voice">Audio</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="created_at">Date Created</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="type">Type</MenuItem>
                <MenuItem value="file_size">Size</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12, md: 2 }}>
            <Box display="flex" gap={1}>
              <IconButton onClick={handleClearFilters} title="Clear Filters">
                <Clear />
              </IconButton>
              <IconButton onClick={loadAssets} title="Refresh">
                <Refresh />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Assets Grid */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {assets.map((asset: any) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={asset.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  '&:hover': { transform: 'translateY(-2px)' },
                  transition: 'transform 0.2s'
                }}
                onClick={() => handleAssetClick(asset)}
              >
                <Box position="relative">
                  {asset.type === 'image' && asset.thumbnailUrl ? (
                    <CardMedia
                      component="img"
                      height="200"
                      image={asset.thumbnailUrl}
                      alt={asset.name}
                      sx={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <Box
                      height="200"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bgcolor={assetTypeColors[asset.type as keyof typeof assetTypeColors] || '#666'}
                      color="white"
                    >
                      {assetTypeIcons[asset.type as keyof typeof assetTypeIcons] || <TextFields />}
                    </Box>
                  )}
                  <IconButton
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(asset);
                    }}
                  >
                    {asset.favorite ? <Favorite color="error" /> : <FavoriteBorder />}
                  </IconButton>
                </Box>
                <CardContent>
                  <Typography variant="h6" noWrap>
                    {asset.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {asset.type.toUpperCase()} • {formatFileSize(asset.size)}
                  </Typography>
                  {asset.tags.length > 0 && (
                    <Box mt={1}>
                      {asset.tags.slice(0, 2).map((tag: any) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                      {asset.tags.length > 2 && (
                        <Chip
                          label={`+${asset.tags.length - 2} more`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Asset Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedAsset && (
          <>
       <DialogTitle>
              {selectedAsset.name}
              <IconButton
                sx={{ position: 'absolute', right: 8, top: 8 }}
                onClick={() => toggleFavorite(selectedAsset)}
              >
                {selectedAsset.favorite ? <Favorite color="error" /> : <FavoriteBorder />}
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  {selectedAsset.type === 'image' ? (
                    <img
                      src={selectedAsset.url}
                      alt={selectedAsset.name}
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '400px',
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <Box
                      height="400px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bgcolor={assetTypeColors[selectedAsset.type]}
                      color="white"
                      borderRadius={1}
                    >
                      {assetTypeIcons[selectedAsset.type]}
                    </Box>
                  )}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="h6" gutterBottom>Details</Typography>
                  <Typography><strong>Type:</strong> {selectedAsset.type.toUpperCase()}</Typography>
                  <Typography><strong>Size:</strong> {formatFileSize(selectedAsset.size)}</Typography>
                  <Typography><strong>Created:</strong> {selectedAsset.dateCreated}</Typography>
                  {selectedAsset.width && selectedAsset.height && (
                    <Typography><strong>Dimensions:</strong> {selectedAsset.width} × {selectedAsset.height}</Typography>
                  )}
                  {selectedAsset.duration && (
                    <Typography><strong>Duration:</strong> {selectedAsset.duration}s</Typography>
                  )}
                  {selectedAsset.description && (
                    <Typography><strong>Description:</strong> {selectedAsset.description}</Typography>
                  )}
                  {selectedAsset.tags.length > 0 && (
                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>Tags</Typography>
                      {selectedAsset.tags.map((tag: any) => (
                        <Chip
                          key={tag}
                          label={tag}
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button startIcon={<Download />} href={selectedAsset.url} target="_blank">
                Download
              </Button>
              <Button startIcon={<Share />}>
                Share
              </Button>
              <Button onClick={() => setDetailsOpen(false)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}