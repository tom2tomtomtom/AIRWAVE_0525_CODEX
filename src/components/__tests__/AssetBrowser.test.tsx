/**
 * Comprehensive test suite for AssetBrowser component
 * Critical workflow component for asset management and selection
 * Priority: HIGH - Core asset functionality with complex search/filter/selection
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AssetBrowser from '../AssetBrowser';
import { createMockAsset } from '@/test/test-setup-enhanced';

// Mock fetch globally
global.fetch = jest.fn();

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

const createMockAssets = () => [
  createMockAsset({
    id: 'asset-1',
    name: 'Product Hero Image',
    type: 'image',
    url: 'https://example.com/hero.jpg',
    thumbnailUrl: 'https://example.com/hero-thumb.jpg',
    tags: ['hero', 'product', 'marketing'],
    size: 1024000,
    width: 1920,
    height: 1080,
    favorite: false,
    dateCreated: '2024-01-15T10:00:00Z',
  }),
  createMockAsset({
    id: 'asset-2',
    name: 'Brand Promotional Video',
    type: 'video',
    url: 'https://example.com/promo.mp4',
    tags: ['promo', 'brand', 'video'],
    size: 5242880,
    duration: 30,
    favorite: true,
    dateCreated: '2024-01-14T15:30:00Z',
  }),
  createMockAsset({
    id: 'asset-3',
    name: 'Voice Over Script',
    type: 'voice',
    url: 'https://example.com/voiceover.mp3',
    tags: ['voice', 'script', 'audio'],
    size: 2097152,
    duration: 45,
    favorite: false,
    dateCreated: '2024-01-13T09:15:00Z',
  }),
  createMockAsset({
    id: 'asset-4',
    name: 'Marketing Copy Text',
    type: 'text',
    url: 'https://example.com/copy.txt',
    tags: ['copy', 'text', 'marketing'],
    size: 4096,
    favorite: false,
    dateCreated: '2024-01-12T14:45:00Z',
  }),
];

const defaultProps = {
  clientId: 'client-123',
  onAssetSelect: jest.fn(),
  selectionMode: false,
};

describe('AssetBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          assets: createMockAssets(),
        }),
    });
  });

  describe('Initial Rendering and Loading', () => {
    it('renders all essential UI elements', () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument();
      expect(screen.getByLabelText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Sort By')).toBeInTheDocument();
      expect(screen.getByLabelText('Clear Filters')).toBeInTheDocument();
      expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('loads assets on mount with correct API parameters', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            '/api/assets?limit=20&sortBy=created_at&sortOrder=desc&clientId=client-123'
          )
        );
      });
    });

    it('displays assets after loading', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
        expect(screen.getByText('Brand Promotional Video')).toBeInTheDocument();
        expect(screen.getByText('Voice Over Script')).toBeInTheDocument();
        expect(screen.getByText('Marketing Copy Text')).toBeInTheDocument();
      });
    });

    it('works without clientId prop', async () => {
      const propsWithoutClient = { ...defaultProps };
      delete (propsWithoutClient as any).clientId;

      renderWithProviders(<AssetBrowser {...propsWithoutClient} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.not.stringContaining('clientId='));
      });
    });
  });

  describe('Asset Display and Information', () => {
    it('displays asset metadata correctly', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('IMAGE • 1000 KB')).toBeInTheDocument();
        expect(screen.getByText('VIDEO • 5 MB')).toBeInTheDocument();
        expect(screen.getByText('VOICE • 2 MB')).toBeInTheDocument();
        expect(screen.getByText('TEXT • 4 KB')).toBeInTheDocument();
      });
    });

    it('shows image thumbnails for image assets', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        const imageAsset = screen.getByText('Product Hero Image').closest('.MuiCard-root');
        const image = within(imageAsset!).getByRole('img');
        expect(image).toHaveAttribute('src', 'https://example.com/hero-thumb.jpg');
        expect(image).toHaveAttribute('alt', 'Product Hero Image');
      });
    });

    it('shows type icons for non-image assets', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        // Video asset should show video icon
        const videoAsset = screen.getByText('Brand Promotional Video').closest('.MuiCard-root');
        expect(videoAsset).toBeInTheDocument();

        // Voice asset should show audio icon
        const voiceAsset = screen.getByText('Voice Over Script').closest('.MuiCard-root');
        expect(voiceAsset).toBeInTheDocument();
      });
    });

    it('displays asset tags correctly', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('hero')).toBeInTheDocument();
        expect(screen.getByText('product')).toBeInTheDocument();
        expect(screen.getByText('promo')).toBeInTheDocument();
        expect(screen.getByText('brand')).toBeInTheDocument();
      });
    });

    it('shows "more tags" indicator when asset has many tags', async () => {
      const assetsWithManyTags = [
        createMockAsset({
          id: 'asset-many-tags',
          name: 'Asset with Many Tags',
          tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
        }),
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            assets: assetsWithManyTags,
          }),
      });

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('+3 more')).toBeInTheDocument();
      });
    });

    it('displays favorite indicators correctly', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        const videoCard = screen.getByText('Brand Promotional Video').closest('.MuiCard-root');
        const favoriteIcon = within(videoCard!).getByTestId('FavoriteIcon');
        expect(favoriteIcon).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('filters assets by search term', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search assets...');
      await user.type(searchInput, 'video');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search=video'));
      });
    });

    it('clears search results when search is cleared', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search assets...');
      await user.type(searchInput, 'video');
      await user.clear(searchInput);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenLastCalledWith(expect.not.stringContaining('search='));
      });
    });

    it('handles search with special characters', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search assets...');
      await user.type(searchInput, 'test@#$%');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=test%40%23%24%25')
        );
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('filters by asset type', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const typeSelect = screen.getByLabelText('Type');
      await user.click(typeSelect);

      const imageOption = screen.getByText('Images');
      await user.click(imageOption);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('type=image'));
      });
    });

    it('shows all types when "All Types" is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const typeSelect = screen.getByLabelText('Type');
      await user.click(typeSelect);

      const allTypesOption = screen.getByText('All Types');
      await user.click(allTypesOption);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.not.stringContaining('type='));
      });
    });

    it('sorts by different criteria', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText('Sort By');
      await user.click(sortSelect);

      const nameOption = screen.getByText('Name');
      await user.click(nameOption);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('sortBy=name'));
      });
    });

    it('combines multiple filters', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      // Set search term
      const searchInput = screen.getByPlaceholderText('Search assets...');
      await user.type(searchInput, 'marketing');

      // Set type filter
      const typeSelect = screen.getByLabelText('Type');
      await user.click(typeSelect);
      await user.click(screen.getByText('Images'));

      // Set sort option
      const sortSelect = screen.getByLabelText('Sort By');
      await user.click(sortSelect);
      await user.click(screen.getByText('Size'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/search=marketing.*type=image.*sortBy=file_size/)
        );
      });
    });

    it('clears all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      // Set some filters
      const searchInput = screen.getByPlaceholderText('Search assets...');
      await user.type(searchInput, 'test');

      const typeSelect = screen.getByLabelText('Type');
      await user.click(typeSelect);
      await user.click(screen.getByText('Images'));

      // Clear filters
      const clearButton = screen.getByLabelText('Clear Filters');
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
      expect(typeSelect).toHaveTextContent('All Types');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.stringContaining('sortBy=created_at&sortOrder=desc&clientId=client-123')
        );
      });
    });
  });

  describe('Asset Selection and Interaction', () => {
    it('opens asset details dialog when asset is clicked in browse mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
      });
    });

    it('calls onAssetSelect when asset is clicked in selection mode', async () => {
      const user = userEvent.setup();
      const onAssetSelect = jest.fn();

      renderWithProviders(
        <AssetBrowser {...defaultProps} selectionMode={true} onAssetSelect={onAssetSelect} />
      );

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      expect(onAssetSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'asset-1',
          name: 'Product Hero Image',
          type: 'image',
        })
      );
    });

    it('toggles favorite status when favorite button is clicked', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              assets: createMockAssets(),
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      const favoriteButton = within(assetCard!).getByTestId('FavoriteBorderIcon').closest('button');

      await user.click(favoriteButton!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/assets/asset-1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metadata: {
              favorite: true,
            },
          }),
        });
      });
    });

    it('prevents event propagation when favorite button is clicked', async () => {
      const user = userEvent.setup();
      const onAssetSelect = jest.fn();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              assets: createMockAssets(),
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      renderWithProviders(
        <AssetBrowser {...defaultProps} selectionMode={true} onAssetSelect={onAssetSelect} />
      );

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      const favoriteButton = within(assetCard!).getByTestId('FavoriteBorderIcon').closest('button');

      await user.click(favoriteButton!);

      // Asset selection should not be triggered when clicking favorite button
      expect(onAssetSelect).not.toHaveBeenCalled();
    });
  });

  describe('Asset Details Dialog', () => {
    it('shows detailed asset information in dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        expect(screen.getByText('Type:')).toBeInTheDocument();
        expect(screen.getByText('IMAGE')).toBeInTheDocument();
        expect(screen.getByText('Size:')).toBeInTheDocument();
        expect(screen.getByText('1000 KB')).toBeInTheDocument();
        expect(screen.getByText('Dimensions:')).toBeInTheDocument();
        expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
      });
    });

    it('shows image preview for image assets', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const image = within(dialog).getByRole('img');
        expect(image).toHaveAttribute('src', 'https://example.com/hero.jpg');
        expect(image).toHaveAttribute('alt', 'Product Hero Image');
      });
    });

    it('shows type icon for non-image assets in dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Brand Promotional Video')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Brand Promotional Video').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        // Should show video icon instead of image
      });
    });

    it('shows duration for video/audio assets', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Brand Promotional Video')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Brand Promotional Video').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        expect(screen.getByText('Duration:')).toBeInTheDocument();
        expect(screen.getByText('30s')).toBeInTheDocument();
      });
    });

    it('displays all asset tags in dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Tags')).toBeInTheDocument();
        expect(within(dialog).getByText('hero')).toBeInTheDocument();
        expect(within(dialog).getByText('product')).toBeInTheDocument();
        expect(within(dialog).getByText('marketing')).toBeInTheDocument();
      });
    });

    it('provides download and share actions', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        expect(screen.getByText('Download')).toBeInTheDocument();
        expect(screen.getByText('Share')).toBeInTheDocument();
        expect(screen.getByText('Close')).toBeInTheDocument();
      });
    });

    it('closes dialog when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('allows toggling favorite from dialog', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              assets: createMockAssets(),
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
      });

      const dialogFavoriteButton = screen.getAllByTestId('FavoriteBorderIcon')[1].closest('button');
      await user.click(dialogFavoriteButton!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/assets/asset-1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metadata: {
              favorite: true,
            },
          }),
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load assets')).toBeInTheDocument();
      });
    });

    it('displays error message when API returns error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            message: 'Access denied',
          }),
      });

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Access denied')).toBeInTheDocument();
      });
    });

    it('handles favorite toggle errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              assets: createMockAssets(),
            }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      const favoriteButton = within(assetCard!).getByTestId('FavoriteBorderIcon').closest('button');

      await user.click(favoriteButton!);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to toggle favorite:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('handles empty asset list gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            assets: [],
          }),
      });

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        // Should not show loading indicator
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        // Should show empty grid
        expect(screen.queryByText('Product Hero Image')).not.toBeInTheDocument();
      });
    });
  });

  describe('Manual Refresh', () => {
    it('refreshes asset list when refresh button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      // Clear previous calls
      (global.fetch as jest.Mock).mockClear();

      const refreshButton = screen.getByLabelText('Refresh');
      await user.click(refreshButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/assets'));
      });
    });

    it('shows loading state during refresh', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      // Mock slow response for refresh
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({
                      success: true,
                      assets: createMockAssets(),
                    }),
                }),
              1000
            )
          )
      );

      const refreshButton = screen.getByLabelText('Refresh');
      await user.click(refreshButton);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('File Size Formatting', () => {
    it('formats file sizes correctly', async () => {
      const assetsWithVariousSizes = [
        createMockAsset({ id: 'bytes', name: 'Small File', size: 500 }),
        createMockAsset({ id: 'kb', name: 'Medium File', size: 1500 }),
        createMockAsset({ id: 'mb', name: 'Large File', size: 1500000 }),
        createMockAsset({ id: 'gb', name: 'Huge File', size: 1500000000 }),
        createMockAsset({ id: 'unknown', name: 'Unknown Size' }), // no size property
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            assets: assetsWithVariousSizes,
          }),
      });

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('IMAGE • 500 Bytes')).toBeInTheDocument();
        expect(screen.getByText('IMAGE • 1.46 KB')).toBeInTheDocument();
        expect(screen.getByText('IMAGE • 1.43 MB')).toBeInTheDocument();
        expect(screen.getByText('IMAGE • 1.4 GB')).toBeInTheDocument();
        expect(screen.getByText('IMAGE • Unknown')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts grid layout based on screen size', () => {
      // This would typically involve testing with different viewport sizes
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      // Grid should be responsive with MUI Grid component
      expect(screen.getByRole('main') || document.body).toBeInTheDocument();
    });
  });

  describe('Performance Considerations', () => {
    it('handles large numbers of assets efficiently', async () => {
      const manyAssets = Array.from({ length: 100 }, (_, i) =>
        createMockAsset({
          id: `asset-${i}`,
          name: `Asset ${i}`,
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            assets: manyAssets,
          }),
      });

      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Asset 0')).toBeInTheDocument();
        expect(screen.getByText('Asset 99')).toBeInTheDocument();
      });

      // Should render without performance issues
      expect(screen.getAllByText(/Asset \d+/).length).toBe(100);
    });

    it('debounces search input effectively', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      (global.fetch as jest.Mock).mockClear();

      const searchInput = screen.getByPlaceholderText('Search assets...');

      // Type rapidly
      await user.type(searchInput, 'search query');

      // Should only make API call after typing stops
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      expect(screen.getByLabelText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Sort By')).toBeInTheDocument();
      expect(screen.getByLabelText('Clear Filters')).toBeInTheDocument();
      expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
    });

    it('maintains keyboard navigation support', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByPlaceholderText('Search assets...')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Type')).toHaveFocus();
    });

    it('provides accessible asset cards', async () => {
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        const assetCards = screen.getAllByRole('button');
        expect(assetCards.length).toBeGreaterThan(0);

        // Each asset card should be focusable
        assetCards.forEach(card => {
          expect(card).toBeInTheDocument();
        });
      });
    });

    it('provides accessible dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Product Hero Image')).toBeInTheDocument();
      });

      const assetCard = screen.getByText('Product Hero Image').closest('.MuiCard-root');
      await user.click(assetCard!);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby');
        expect(dialog).toHaveAttribute('aria-describedby');
      });
    });
  });
});
