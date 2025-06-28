import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  Avatar,
  Divider,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Search,
  Close,
  History,
  Description,
  VideoLibrary,
  Image,
  Campaign,
  Group,
  PlayArrow,
  Folder,
  AccessTime,
} from '@mui/icons-material';
import { useRouter } from 'next/router';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'brief' | 'template' | 'asset' | 'campaign' | 'client' | 'action' | 'page';
  icon: React.ReactNode;
  url?: string;
  action?: () => void;
  metadata?: {
    date?: string;
    status?: string;
    tags?: string[];
  };
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ open, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Real API integration for search
  const searchData = useCallback(async (searchQuery: string): Promise<SearchResult[]> => {
    if (!searchQuery.trim()) {
      return [];
    }

    try {
      const response = await fetch('/api/v2/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        console.error('Search API error:', response.status);
        return [];
      }

      const data = await response.json();

      if (data.success && data.data) {
        return data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          type: item.type || 'page',
          icon: getTypeIcon(item.type || 'page'),
          url: item.url,
          action: item.action,
          metadata: item.metadata,
        }));
      }

      return [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }, []);

  // Generate quick actions from common tasks
  const getQuickActions = useCallback((): SearchResult[] => {
    return [
      {
        id: 'quick-new-flow',
        title: 'Start New Flow',
        description: 'Begin a new content generation workflow',
        type: 'action',
        icon: <PlayArrow />,
        action: () => router.push('/flow'),
      },
      {
        id: 'quick-create-client',
        title: 'Create Client',
        description: 'Add a new client to your workspace',
        type: 'action',
        icon: <Group />,
        action: () => router.push('/clients?action=create'),
      },
      {
        id: 'quick-upload-asset',
        title: 'Upload Asset',
        description: 'Upload new media assets',
        type: 'action',
        icon: <Image />,
        action: () => router.push('/assets?action=upload'),
      },
    ];
  }, [router]);

  useEffect(() => {
    if (query.trim()) {
      setLoading(true);
      const timeoutId = setTimeout(async () => {
        try {
          const searchResults = await searchData(query);
          setResults(searchResults);
          setSelectedIndex(0);
        } catch (error) {
          console.error('Search failed:', error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300); // Debounce search

      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
      setSelectedIndex(0);
      setLoading(false);
      return undefined;
    }
  }, [query, searchData]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]!);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    // Add to recent searches
    setRecentSearches(prev => {
      const updated = [query, ...prev.filter((s: any) => s !== query)].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });

    // Execute action or navigate
    if (result.action) {
      result.action();
    } else if (result.url) {
      router.push(result.url);
    }

    onClose();
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      action: <PlayArrow />,
      page: <Folder />,
      brief: <Description />,
      template: <VideoLibrary />,
      asset: <Image />,
      campaign: <Campaign />,
      client: <Group />,
    };
    return icons[type as keyof typeof icons] || <Folder />;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      action: 'primary',
      page: 'secondary',
      brief: 'info',
      template: 'warning',
      asset: 'success',
      campaign: 'error',
      client: 'default',
    };
    return colors[type as keyof typeof colors] || 'default';
  };

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const quickActions = getQuickActions();
  const showQuickActions = !query.trim() && quickActions.length > 0;
  const showRecentSearches = !query.trim() && recentSearches.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          mt: 8,
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Search Input */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            placeholder="Search everything... (Ctrl+K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={onClose} size="small" aria-label="Close search">
                    {' '}
                    <Close />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { border: 'none' },
              },
            }}
          />
        </Box>

        {/* Results */}
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Searching...</Typography>
            </Box>
          ) : results.length > 0 ? (
            <List>
              {results.map((result, index) => (
                <ListItem
                  key={result.id}
                  onClick={() => handleSelectResult(result)}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: index === selectedIndex ? 'action.selected' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        bgcolor: `${getTypeColor(result.type)}.light`,
                        width: 32,
                        height: 32,
                      }}
                    >
                      {result.icon}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1">{result.title}</Typography>
                        <Chip
                          label={result.type}
                          size="small"
                          color={getTypeColor(result.type) as any}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {result.description}
                        </Typography>
                        {result.metadata && (
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            {result.metadata.date && (
                              <Chip
                                icon={<AccessTime />}
                                label={result.metadata.date}
                                size="small"
                                variant="outlined"
                                sx={{ height: 16, fontSize: '0.6rem' }}
                              />
                            )}
                            {result.metadata.status && (
                              <Chip
                                label={result.metadata.status}
                                size="small"
                                color={
                                  result.metadata.status === 'completed' ? 'success' : 'default'
                                }
                                sx={{ height: 16, fontSize: '0.6rem' }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : query.trim() ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No results found for "{query}"</Typography>
              <Typography variant="caption" color="text.secondary">
                Try different keywords or browse categories
              </Typography>
            </Box>
          ) : (
            <Box>
              {/* Quick Actions */}
              {showQuickActions && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Quick Actions
                  </Typography>
                  <List dense>
                    {quickActions.map((action: any) => (
                      <ListItem
                        key={action.id}
                        onClick={() => handleSelectResult(action)}
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: 'primary.light', width: 32, height: 32 }}>
                            {action.icon}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText primary={action.title} secondary={action.description} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {showQuickActions && showRecentSearches && <Divider />}

              {/* Recent Searches */}
              {showRecentSearches && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Recent Searches
                  </Typography>
                  <List dense>
                    {recentSearches.map((search, index) => (
                      <ListItem
                        key={index}
                        onClick={() => setQuery(search)}
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <ListItemIcon>
                          <History color="action" />
                        </ListItemIcon>
                        <ListItemText primary={search} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {!showQuickActions && !showRecentSearches && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Search sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Search AIrFLOW
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Find briefs, templates, assets, and more...
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary">
            Press ↑↓ to navigate, Enter to select, Esc to close
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
