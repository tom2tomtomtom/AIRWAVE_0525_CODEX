import React, { useState, useCallback, useMemo } from 'react';
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
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Menu,
  ListItemIcon,
  ListItemText,
  Fade,
  Zoom,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Image as ImageIcon,
  VideoFile as VideoFileIcon,
  AudioFile as AudioFileIcon,
  TextFields as TextFieldsIcon,
  Refresh as RefreshIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  GridView as GridViewIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { LoadingState } from '../feedback/LoadingState';
import { ErrorState } from '../feedback/ErrorState';
import { ActionButton } from '../buttons/ActionButton';

interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'voice' | 'document';
  url: string;
  thumbnailUrl?: string;
  description?: string;
  tags: string[];
  dateCreated: string;
  dateModified?: string;
  clientId: string;
  userId: string;
  size?: number;
  duration?: number;
  dimensions?: { width: number; height: number };
  isFavorite?: boolean;
  status?: 'processing' | 'ready' | 'error';
}

interface EnhancedAssetBrowserProps {
  assets?: Asset[];
  loading?: boolean;
  error?: string;
  onAssetSelect?: (asset: Asset) => void;
  onAssetUpload?: (files: FileList) => void;
  onAssetDelete?: (assetId: string) => void;
  onAssetFavorite?: (assetId: string, favorite: boolean) => void;
  onRefresh?: () => void;
  allowMultiSelect?: boolean;
  allowUpload?: boolean;
  allowDelete?: boolean;
  selectedAssets?: Asset[];
  clientId?: string;
  showFilters?: boolean;
  maxSelections?: number;
}

type ViewMode = 'grid' | 'list' | 'compact';
type SortOption = 'name' | 'date' | 'type' | 'size';
type FilterType = 'all' | 'image' | 'video' | 'text' | 'voice' | 'document';

export const EnhancedAssetBrowser: React.FC<EnhancedAssetBrowserProps> = ({
  assets = [],
  loading = false,
  error,
  onAssetSelect,
  onAssetUpload,
  onAssetDelete: _onAssetDelete,
  onAssetFavorite,
  onRefresh,
  allowMultiSelect = false,
  allowUpload = true,
  allowDelete = false,
  selectedAssets = [],
  clientId,
  showFilters = true,
  maxSelections,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ asset: Asset; element: HTMLElement } | null>(null);
  const [uploadProgress, _setUploadProgress] = useState<Record<string, number>>({});

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let filtered = assets;

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (asset: any) =>
          asset.name.toLowerCase().includes(search) ||
          asset.description?.toLowerCase().includes(search) ||
          asset.tags.some((tag: string) => tag.toLowerCase().includes(search))
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((asset: any) => asset.type === filterType);
    }

    // Apply favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter((asset: any) => asset.isFavorite);
    }

    // Apply client filter
    if (clientId) {
      filtered = filtered.filter((asset: any) => asset.clientId === clientId);
    }

    // Sort assets
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'size':
          return (b.size || 0) - (a.size || 0);
        default: // date
          return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
      }
    });

    return filtered;
  }, [assets, searchTerm, filterType, showFavoritesOnly, clientId, sortBy]);

  const handleAssetClick = (asset: Asset) => {
    if (allowMultiSelect) {
      const isSelected = selectedAssets.some(selected => selected.id === asset.id);
      if (isSelected) {
        // Remove from selection
        const newSelection = selectedAssets.filter((selected: any) => selected.id !== asset.id);
        onAssetSelect?.(newSelection[0] || asset);
      } else {
        // Add to selection if within limits
        if (!maxSelections || selectedAssets.length < maxSelections) {
          onAssetSelect?.(asset);
        }
      }
    } else {
      onAssetSelect?.(asset);
    }
  };

  const handleAssetPreview = (asset: Asset) => {
    setPreviewAsset(asset);
  };

  const handleAssetMenu = (asset: Asset, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor({ asset, element: event.currentTarget });
  };

  const handleFavoriteToggle = (asset: Asset, event: React.MouseEvent) => {
    event.stopPropagation();
    onAssetFavorite?.(asset.id, !asset.isFavorite);
  };

  const handleUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) {
        onAssetUpload?.(files);
      }
    },
    [onAssetUpload]
  );

  const getAssetIcon = (type: Asset['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon />;
      case 'video':
        return <VideoFileIcon />;
      case 'text':
        return <TextFieldsIcon />;
      case 'voice':
        return <AudioFileIcon />;
      default:
        return <ImageIcon />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const renderAssetCard = (asset: Asset) => {
    const isSelected = selectedAssets.some(selected => selected.id === asset.id);
    const hasProgress = uploadProgress[asset.id] !== undefined;

    return (
      <Zoom in timeout={300} key={asset.id}>
        <Card
          sx={{
            cursor: 'pointer',
            border: 2,
            borderColor: isSelected ? 'primary.main' : 'transparent',
            transform: isSelected ? 'scale(0.98)' : 'scale(1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 4,
            },
          }}
          onClick={() => handleAssetClick(asset)}
        >
          {hasProgress && (
            <LinearProgress
              variant="determinate"
              value={uploadProgress[asset.id] || 0}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                zIndex: 1,
              }}
            />
          )}

          <Box sx={{ position: 'relative' }}>
            {asset.thumbnailUrl || asset.type === 'image' ? (
              <CardMedia
                component="img"
                height={viewMode === 'compact' ? 80 : 160}
                image={asset.thumbnailUrl || asset.url}
                alt={asset.name}
                sx={{
                  objectFit: 'cover',
                  backgroundColor: 'action.hover',
                }}
              />
            ) : (
              <Box
                sx={{
                  height: viewMode === 'compact' ? 80 : 160,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'action.hover',
                  color: 'text.secondary',
                }}
              >
                {getAssetIcon(asset.type)}
              </Box>
            )}

            {/* Status overlay */}
            {asset.status === 'processing' && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <CircularProgress size={24} color="inherit" />
              </Box>
            )}

            {/* Action buttons overlay */}
            <Fade in>
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  gap: 0.5,
                }}
              >
                <IconButton
                  size="small"
                  onClick={e => handleFavoriteToggle(asset, e)}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 1)',
                    },
                  }}
                >
                  {asset.isFavorite ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={e => handleAssetMenu(asset, e)}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 1)',
                    },
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </Box>
            </Fade>

            {/* Selection indicator */}
            {isSelected && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  backgroundColor: 'primary.main',
                  color: 'white',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                }}
              >
                ✓
              </Box>
            )}
          </Box>

          <CardContent sx={{ p: viewMode === 'compact' ? 1 : 2 }}>
            <Typography
              variant={viewMode === 'compact' ? 'body2' : 'subtitle2'}
              noWrap
              sx={{ fontWeight: 600, mb: 0.5 }}
            >
              {asset.name}
            </Typography>

            {viewMode !== 'compact' && (
              <>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label={asset.type} variant="outlined" />
                  {asset.size && (
                    <Chip size="small" label={formatFileSize(asset.size)} variant="outlined" />
                  )}
                </Box>

                {asset.description && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {asset.description}
                  </Typography>
                )}

                {asset.tags.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {asset.tags.slice(0, 3).map((tag: any) => (
                      <Chip
                        key={tag}
                        size="small"
                        label={tag}
                        sx={{ height: 16, fontSize: '0.65rem' }}
                      />
                    ))}
                    {asset.tags.length > 3 && (
                      <Chip
                        size="small"
                        label={`+${asset.tags.length - 3}`}
                        sx={{ height: 16, fontSize: '0.65rem' }}
                      />
                    )}
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Zoom>
    );
  };

  const renderListItem = (asset: Asset) => {
    const isSelected = selectedAssets.some(selected => selected.id === asset.id);

    return (
      <Paper
        key={asset.id}
        sx={{
          p: 2,
          cursor: 'pointer',
          border: 2,
          borderColor: isSelected ? 'primary.main' : 'transparent',
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
        onClick={() => handleAssetClick(asset)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1,
              overflow: 'hidden',
              flexShrink: 0,
              backgroundColor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {asset.thumbnailUrl || asset.type === 'image' ? (
              <img
                src={asset.thumbnailUrl || asset.url}
                alt={asset.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              getAssetIcon(asset.type)
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
              {asset.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {asset.description || `${asset.type} asset`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {new Date(asset.dateCreated).toLocaleDateString()}
              </Typography>
              {asset.size && (
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(asset.size)}
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={e => handleFavoriteToggle(asset, e)}>
              {asset.isFavorite ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton size="small" onClick={e => handleAssetMenu(asset, e)}>
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    );
  };

  if (loading) {
    return <LoadingState type="skeleton" rows={6} />;
  }

  if (error) {
    return <ErrorState type="error" message={error} showRetry={true} {...(onRefresh && { onRetry: onRefresh })} variant="card" />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Asset Library
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {allowUpload && (
              <Button
                component="label"
                variant="contained"
                startIcon={<CloudUploadIcon />}
                size="small"
              >
                Upload
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*,video/*,audio/*,.txt,.doc,.docx,.pdf"
                  onChange={handleUpload}
                />
              </Button>
            )}

            <IconButton onClick={onRefresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Filters */}
        {showFilters && (
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 200 }}
            />

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={e => setFilterType(e.target.value as FilterType)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="image">Images</MenuItem>
                <MenuItem value="video">Videos</MenuItem>
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="voice">Audio</MenuItem>
                <MenuItem value="document">Documents</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={e => setSortBy(e.target.value as SortOption)}
              >
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="type">Type</MenuItem>
                <MenuItem value="size">Size</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant={showFavoritesOnly ? 'contained' : 'outlined'}
              startIcon={<FavoriteIcon />}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              size="small"
            >
              Favorites
            </Button>
          </Stack>
        )}

        {/* View mode toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {filteredAssets.length} assets
            {allowMultiSelect && selectedAssets.length > 0 && (
              <> • {selectedAssets.length} selected</>
            )}
          </Typography>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="grid">
              <GridViewIcon />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewListIcon />
            </ToggleButton>
            <ToggleButton value="compact">
              <ViewModuleIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Assets Grid/List */}
      {filteredAssets.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            color: 'text.secondary',
          }}
        >
          <ImageIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            No assets found
          </Typography>
          <Typography variant="body2">
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Upload some assets to get started'}
          </Typography>
        </Box>
      ) : viewMode === 'list' ? (
        <Stack spacing={1}>{filteredAssets.map(renderListItem)}</Stack>
      ) : (
        <Grid container spacing={viewMode === 'compact' ? 1 : 2}>
          {filteredAssets.map((asset: any) => (
            <Grid
              key={asset.id}
              size={{
                xs: viewMode === 'compact' ? 6 : 12,
                sm: viewMode === 'compact' ? 4 : 6,
                md: viewMode === 'compact' ? 3 : 4,
                lg: viewMode === 'compact' ? 2 : 3,
              }}
            >
              {renderAssetCard(asset)}
            </Grid>
          ))}
        </Grid>
      )}

      {/* Asset Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleAssetPreview(menuAnchor!.asset)}>
          <ListItemIcon>
            <SearchIcon />
          </ListItemIcon>
          <ListItemText>Preview</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <ShareIcon />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {allowDelete && (
          <MenuItem sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Asset Preview Dialog */}
      <Dialog
        open={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
        maxWidth="md"
        fullWidth
      >
        {previewAsset && (
          <>
            <DialogTitle
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              {previewAsset.name}
              <IconButton onClick={() => setPreviewAsset(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                {previewAsset.type === 'image' ? (
                  <img
                    src={previewAsset.url}
                    alt={previewAsset.name}
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'action.hover',
                      borderRadius: 2,
                    }}
                  >
                    {getAssetIcon(previewAsset.type)}
                  </Box>
                )}
              </Box>
              {previewAsset.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {previewAsset.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {previewAsset.tags.map((tag: any) => (
                  <Chip key={tag} size="small" label={tag} />
                ))}
              </Box>
            </DialogContent>
            <DialogActions>
              <ActionButton variant="outline" onClick={() => setPreviewAsset(null)}>
                Close
              </ActionButton>
              <ActionButton variant="primary" startIcon={<DownloadIcon />}>
                Download
              </ActionButton>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};
