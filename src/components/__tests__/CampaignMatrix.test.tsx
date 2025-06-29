/**
 * Comprehensive test suite for CampaignMatrix component
 * Critical component with 0% coverage - high priority for testing
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CampaignMatrix from '../CampaignMatrix';
import { createMockCampaign, createMockAsset, mockApiResponse } from '@/test/test-setup-enhanced';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

// Mock API calls
global.fetch = jest.fn();

const mockCampaigns = [
  createMockCampaign({
    id: 'campaign-1',
    name: 'Summer Sale Campaign',
    status: 'active',
    platforms: ['facebook', 'instagram'],
  }),
  createMockCampaign({
    id: 'campaign-2',
    name: 'Holiday Promotion',
    status: 'draft',
    platforms: ['youtube', 'tiktok'],
  }),
];

const mockAssets = [
  createMockAsset({ id: 'asset-1', name: 'Product Image 1', type: 'image' }),
  createMockAsset({ id: 'asset-2', name: 'Brand Video', type: 'video' }),
];

describe('CampaignMatrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse(mockCampaigns)),
    });
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithTheme(<CampaignMatrix />);
      expect(screen.getByText(/campaign matrix/i)).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
      renderWithTheme(<CampaignMatrix />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders campaign grid after loading', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
        expect(screen.getByText('Holiday Promotion')).toBeInTheDocument();
      });
    });

    it('displays campaign count', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText(/2 campaigns/i)).toBeInTheDocument();
      });
    });
  });

  describe('Campaign Management', () => {
    it('allows creating new campaigns', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const createButton = screen.getByText(/create campaign/i);
      await user.click(createButton);

      expect(screen.getByText(/new campaign/i)).toBeInTheDocument();
    });

    it('opens campaign details on click', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const campaignCard = screen.getByText('Summer Sale Campaign');
      await user.click(campaignCard);

      expect(screen.getByText(/campaign details/i)).toBeInTheDocument();
    });

    it('shows campaign status correctly', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('displays platform indicators', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText(/facebook/i)).toBeInTheDocument();
        expect(screen.getByText(/instagram/i)).toBeInTheDocument();
        expect(screen.getByText(/youtube/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('filters campaigns by status', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText(/filter by status/i);
      await user.click(statusFilter);
      await user.click(screen.getByText('Active Only'));

      expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      expect(screen.queryByText('Holiday Promotion')).not.toBeInTheDocument();
    });

    it('searches campaigns by name', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search campaigns/i);
      await user.type(searchInput, 'Summer');

      expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      expect(screen.queryByText('Holiday Promotion')).not.toBeInTheDocument();
    });

    it('clears search when input is cleared', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search campaigns/i);
      await user.type(searchInput, 'Summer');
      await user.clear(searchInput);

      expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      expect(screen.getByText('Holiday Promotion')).toBeInTheDocument();
    });
  });

  describe('Grid Layout and Views', () => {
    it('toggles between grid and list view', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const viewToggle = screen.getByLabelText(/toggle view/i);
      await user.click(viewToggle);

      // Should switch to list view
      expect(screen.getByTestId('list-view')).toBeInTheDocument();
    });

    it('adjusts grid size based on screen size', () => {
      // Mock different screen sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      renderWithTheme(<CampaignMatrix />);

      // Should adapt to mobile layout
      expect(screen.getByTestId('campaign-grid')).toHaveClass('mobile-grid');
    });

    it('handles empty state correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse([])),
      });

      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText(/no campaigns found/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first campaign/i)).toBeInTheDocument();
      });
    });
  });

  describe('Campaign Actions', () => {
    it('allows duplicating campaigns', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const campaignCard = screen.getByTestId('campaign-1');
      const moreButton = campaignCard.querySelector('[aria-label="more actions"]');
      await user.click(moreButton!);

      const duplicateAction = screen.getByText(/duplicate/i);
      await user.click(duplicateAction);

      expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/duplicate', expect.any(Object));
    });

    it('allows archiving campaigns', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const campaignCard = screen.getByTestId('campaign-1');
      const moreButton = campaignCard.querySelector('[aria-label="more actions"]');
      await user.click(moreButton!);

      const archiveAction = screen.getByText(/archive/i);
      await user.click(archiveAction);

      expect(screen.getByText(/confirm archive/i)).toBeInTheDocument();
    });

    it('shows performance metrics on hover', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const campaignCard = screen.getByTestId('campaign-1');
      await user.hover(campaignCard);

      await waitFor(() => {
        expect(screen.getByText(/impressions/i)).toBeInTheDocument();
        expect(screen.getByText(/clicks/i)).toBeInTheDocument();
        expect(screen.getByText(/conversion rate/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('updates campaign status in real-time', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      // Simulate real-time update
      const updateEvent = new CustomEvent('campaignUpdate', {
        detail: { campaignId: 'campaign-1', status: 'paused' },
      });
      window.dispatchEvent(updateEvent);

      await waitFor(() => {
        expect(screen.getByText('paused')).toBeInTheDocument();
      });
    });

    it('shows notification for new campaigns', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      // Simulate new campaign notification
      const newCampaignEvent = new CustomEvent('newCampaign', {
        detail: createMockCampaign({ name: 'New Campaign' }),
      });
      window.dispatchEvent(newCampaignEvent);

      await waitFor(() => {
        expect(screen.getByText(/new campaign added/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Optimization', () => {
    it('implements virtual scrolling for large datasets', async () => {
      const largeCampaignList = Array.from({ length: 100 }, (_, i) =>
        createMockCampaign({ id: `campaign-${i}`, name: `Campaign ${i}` })
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse(largeCampaignList)),
      });

      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        // Should only render visible items
        const visibleCampaigns = screen.getAllByTestId(/campaign-\d+/);
        expect(visibleCampaigns.length).toBeLessThan(50); // Virtual scrolling active
      });
    });

    it('lazy loads campaign images', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });

    it('debounces search input', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search campaigns/i);

      // Type rapidly
      await user.type(searchInput, 'test');

      // Should debounce API calls
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial load
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText(/error loading campaigns/i)).toBeInTheDocument();
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });
    });

    it('handles partial loading errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server Error' }),
      });

      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText(/some campaigns may not be visible/i)).toBeInTheDocument();
      });
    });

    it('retries failed operations', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText(/error loading campaigns/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/try again/i);
      await user.click(retryButton);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Campaign matrix');
      expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label', 'Search campaigns');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const firstCampaign = screen.getByTestId('campaign-1');
      firstCampaign.focus();

      await user.keyboard('{Enter}');
      expect(screen.getByText(/campaign details/i)).toBeInTheDocument();
    });

    it('announces status changes to screen readers', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const statusElement = screen.getByText('active');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Integration Tests', () => {
    it('integrates with asset management', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      // Should show asset count for each campaign
      expect(screen.getByText(/3 assets/i)).toBeInTheDocument();
    });

    it('integrates with analytics dashboard', async () => {
      const user = userEvent.setup();
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      const analyticsButton = screen.getByLabelText(/view analytics/i);
      await user.click(analyticsButton);

      expect(global.fetch).toHaveBeenCalledWith('/api/analytics/campaign/campaign-1');
    });

    it('syncs with workflow system', async () => {
      renderWithTheme(<CampaignMatrix />);

      await waitFor(() => {
        expect(screen.getByText('Summer Sale Campaign')).toBeInTheDocument();
      });

      // Should show workflow status
      expect(screen.getByText(/in review/i)).toBeInTheDocument();
    });
  });
});
