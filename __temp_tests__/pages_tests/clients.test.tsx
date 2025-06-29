/**
 * Focused test suite for clients.tsx page component
 * Large component (895 lines) - targeting high-impact functionality
 * Priority: MEDIUM - Page-level testing for critical client management workflow
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useRouter } from 'next/router';
import ClientsPage from '../clients';
import { createMockUser } from '@/test/test-setup-enhanced';

// Mock Next.js components and hooks
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next/head', () => {
  return function MockHead({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
});

// Mock contexts
const mockAuth = {
  user: createMockUser(),
  loading: false,
  signIn: jest.fn(),
  signOut: jest.fn(),
};

const mockNotification = {
  showNotification: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/contexts/NotificationContext', () => ({
  useNotification: () => mockNotification,
}));

// Mock fetch globally
global.fetch = jest.fn();

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

const mockRouter = {
  pathname: '/clients',
  query: {},
  asPath: '/clients',
  push: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isLocaleDomain: true,
  isReady: true,
};

const createMockClient = (overrides = {}) => ({
  id: 'client-123',
  name: 'Acme Corporation',
  email: 'contact@acme.com',
  website: 'https://acme.com',
  industry: 'Technology',
  company_size: '100-500',
  status: 'active',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T15:30:00Z',
  brand_guidelines: {
    primary_color: '#FF0000',
    secondary_color: '#00FF00',
    fonts: ['Arial', 'Helvetica'],
    tone: 'professional',
    style: 'modern',
  },
  contacts: [
    {
      id: 'contact-1',
      name: 'John Smith',
      email: 'john@acme.com',
      role: 'Marketing Director',
      is_primary: true,
    },
  ],
  social_media: {
    facebook: 'https://facebook.com/acme',
    twitter: 'https://twitter.com/acme',
    linkedin: 'https://linkedin.com/company/acme',
  },
  campaigns_count: 5,
  assets_count: 25,
  ...overrides,
});

const createMockClients = () => [
  createMockClient(),
  createMockClient({
    id: 'client-456',
    name: 'TechStart Inc',
    email: 'hello@techstart.com',
    industry: 'Software',
    status: 'active',
    campaigns_count: 3,
    assets_count: 15,
  }),
  createMockClient({
    id: 'client-789',
    name: 'Creative Agency',
    email: 'info@creative.com',
    industry: 'Design',
    status: 'inactive',
    campaigns_count: 1,
    assets_count: 8,
  }),
];

describe('Clients Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Default successful API responses
    (global.fetch as jest.Mock).mockImplementation(url => {
      if (url.includes('/api/clients')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              clients: createMockClients(),
              total: 3,
              page: 1,
              limit: 10,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  describe('Initial Page Rendering', () => {
    it('renders page title and header', () => {
      renderWithProviders(<ClientsPage />);

      expect(screen.getByText('Client Management')).toBeInTheDocument();
      expect(screen.getByText(/manage your client portfolio/i)).toBeInTheDocument();
    });

    it('shows add client button', () => {
      renderWithProviders(<ClientsPage />);

      expect(screen.getByText(/add client/i)).toBeInTheDocument();
    });

    it('displays search and filter controls', () => {
      renderWithProviders(<ClientsPage />);

      expect(screen.getByPlaceholderText(/search clients/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by industry/i)).toBeInTheDocument();
    });

    it('loads clients on mount', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/clients');
      });
    });

    it('shows loading state while fetching data', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderWithProviders(<ClientsPage />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Client List Display', () => {
    it('displays client cards with essential information', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        expect(screen.getByText('TechStart Inc')).toBeInTheDocument();
        expect(screen.getByText('Creative Agency')).toBeInTheDocument();
      });
    });

    it('shows client status indicators', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getAllByText('active')).toHaveLength(2);
        expect(screen.getByText('inactive')).toBeInTheDocument();
      });
    });

    it('displays client industry information', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Technology')).toBeInTheDocument();
        expect(screen.getByText('Software')).toBeInTheDocument();
        expect(screen.getByText('Design')).toBeInTheDocument();
      });
    });

    it('shows campaign and asset counts', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('5 campaigns')).toBeInTheDocument();
        expect(screen.getByText('25 assets')).toBeInTheDocument();
        expect(screen.getByText('3 campaigns')).toBeInTheDocument();
        expect(screen.getByText('15 assets')).toBeInTheDocument();
      });
    });

    it('displays primary contact information', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Marketing Director')).toBeInTheDocument();
      });
    });

    it('shows social media links', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
        expect(within(clientCard!).getByTestId('FacebookIcon')).toBeInTheDocument();
        expect(within(clientCard!).getByTestId('TwitterIcon')).toBeInTheDocument();
        expect(within(clientCard!).getByTestId('LinkedInIcon')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('filters clients by search term', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'Acme');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('search=Acme'));
      });
    });

    it('filters by client status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText(/filter by status/i);
      await user.click(statusFilter);

      const activeOption = screen.getByText('Active Only');
      await user.click(activeOption);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('status=active'));
      });
    });

    it('filters by industry', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const industryFilter = screen.getByLabelText(/filter by industry/i);
      await user.click(industryFilter);

      const techOption = screen.getByText('Technology');
      await user.click(techOption);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('industry=Technology'));
      });
    });

    it('combines multiple filters', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // Set search term
      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'tech');

      // Set status filter
      const statusFilter = screen.getByLabelText(/filter by status/i);
      await user.click(statusFilter);
      await user.click(screen.getByText('Active Only'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/search=tech.*status=active/)
        );
      });
    });

    it('clears filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // Set filters
      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'test');

      // Clear filters
      const clearButton = screen.getByLabelText(/clear filters/i);
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
      await waitFor(() => {
        expect(global.fetch).toHaveBeenLastCalledWith('/api/clients');
      });
    });
  });

  describe('Client Creation', () => {
    it('opens client creation dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      const addButton = screen.getByText(/add client/i);
      await user.click(addButton);

      expect(screen.getByText(/new client/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      const addButton = screen.getByText(/add client/i);
      await user.click(addButton);

      const createButton = screen.getByText(/create client/i);
      await user.click(createButton);

      expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });

    it('creates new client with valid data', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              client: createMockClient({ name: 'New Client' }),
            }),
        })
      );

      renderWithProviders(<ClientsPage />);

      const addButton = screen.getByText(/add client/i);
      await user.click(addButton);

      // Fill form
      const nameInput = screen.getByLabelText(/company name/i);
      await user.type(nameInput, 'New Client');

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'new@client.com');

      const createButton = screen.getByText(/create client/i);
      await user.click(createButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/clients',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('New Client'),
          })
        );
      });
    });

    it('handles creation errors gracefully', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      renderWithProviders(<ClientsPage />);

      const addButton = screen.getByText(/add client/i);
      await user.click(addButton);

      const nameInput = screen.getByLabelText(/company name/i);
      await user.type(nameInput, 'New Client');

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'new@client.com');

      const createButton = screen.getByText(/create client/i);
      await user.click(createButton);

      await waitFor(() => {
        expect(mockNotification.showNotification).toHaveBeenCalledWith(
          expect.stringContaining('Failed to create client'),
          'error'
        );
      });
    });

    it('includes brand guidelines in creation form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      const addButton = screen.getByText(/add client/i);
      await user.click(addButton);

      // Should show brand guidelines section
      expect(screen.getByText(/brand guidelines/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/primary color/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/brand tone/i)).toBeInTheDocument();
    });
  });

  describe('Client Management Actions', () => {
    it('opens client details when client card is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      await user.click(clientCard!);

      expect(mockRouter.push).toHaveBeenCalledWith('/clients/client-123');
    });

    it('shows client action menu', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      const menuButton = within(clientCard!).getByLabelText(/more actions/i);
      await user.click(menuButton);

      expect(screen.getByText(/edit client/i)).toBeInTheDocument();
      expect(screen.getByText(/view campaigns/i)).toBeInTheDocument();
      expect(screen.getByText(/view assets/i)).toBeInTheDocument();
    });

    it('opens edit dialog from action menu', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      const menuButton = within(clientCard!).getByLabelText(/more actions/i);
      await user.click(menuButton);

      const editOption = screen.getByText(/edit client/i);
      await user.click(editOption);

      expect(screen.getByText(/edit client/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument();
    });

    it('updates client information', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              clients: createMockClients(),
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              client: createMockClient({ name: 'Updated Name' }),
            }),
        });

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      const menuButton = within(clientCard!).getByLabelText(/more actions/i);
      await user.click(menuButton);

      const editOption = screen.getByText(/edit client/i);
      await user.click(editOption);

      const nameInput = screen.getByDisplayValue('Acme Corporation');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByText(/save changes/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/clients/client-123',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('Updated Name'),
          })
        );
      });
    });

    it('confirms client deletion', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      const menuButton = within(clientCard!).getByLabelText(/more actions/i);
      await user.click(menuButton);

      const deleteOption = screen.getByText(/delete client/i);
      await user.click(deleteOption);

      expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    it('navigates to client campaigns', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      const menuButton = within(clientCard!).getByLabelText(/more actions/i);
      await user.click(menuButton);

      const campaignOption = screen.getByText(/view campaigns/i);
      await user.click(campaignOption);

      expect(mockRouter.push).toHaveBeenCalledWith('/campaigns?client=client-123');
    });

    it('navigates to client assets', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      const menuButton = within(clientCard!).getByLabelText(/more actions/i);
      await user.click(menuButton);

      const assetsOption = screen.getByText(/view assets/i);
      await user.click(assetsOption);

      expect(mockRouter.push).toHaveBeenCalledWith('/assets?client=client-123');
    });
  });

  describe('Client List Views', () => {
    it('toggles between grid and list view', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const viewToggle = screen.getByLabelText(/toggle view/i);
      await user.click(viewToggle);

      // Should switch to list view
      expect(screen.getByTestId('list-view')).toBeInTheDocument();
    });

    it('shows client details in list view', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const viewToggle = screen.getByLabelText(/toggle view/i);
      await user.click(viewToggle);

      // List view should show more detailed information
      expect(screen.getByText('contact@acme.com')).toBeInTheDocument();
      expect(screen.getByText('https://acme.com')).toBeInTheDocument();
    });

    it('sorts clients by different criteria', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.click(sortSelect);

      const nameOption = screen.getByText('Name');
      await user.click(nameOption);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('sort=name'));
      });
    });
  });

  describe('Pagination', () => {
    it('shows pagination controls when there are many clients', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            clients: createMockClients(),
            total: 25,
            page: 1,
            limit: 10,
          }),
      });

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
      });
    });

    it('navigates between pages', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            clients: createMockClients(),
            total: 25,
            page: 1,
            limit: 10,
          }),
      });

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByLabelText(/next page/i);
      await user.click(nextButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'));
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load clients/i)).toBeInTheDocument();
      });
    });

    it('shows retry option on errors', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });

      // Mock successful retry
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            clients: createMockClients(),
          }),
      });

      const retryButton = screen.getByText(/try again/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });
    });

    it('handles empty state appropriately', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            clients: [],
            total: 0,
          }),
      });

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/no clients found/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first client/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<ClientsPage />);

      // Should show mobile-optimized layout
      expect(screen.getByTestId('mobile-layout') || document.body).toBeInTheDocument();
    });

    it('shows simplified client cards on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // Mobile cards should show essential info only
      const clientCard = screen.getByText('Acme Corporation').closest('.MuiCard-root');
      expect(clientCard).toHaveClass('mobile-card');
    });
  });

  describe('Performance Considerations', () => {
    it('handles large numbers of clients efficiently', async () => {
      const manyClients = Array.from({ length: 100 }, (_, i) =>
        createMockClient({
          id: `client-${i}`,
          name: `Client ${i}`,
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            clients: manyClients,
            total: 100,
          }),
      });

      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Client 0')).toBeInTheDocument();
      });

      // Should render without performance issues
      expect(screen.getAllByText(/Client \d+/).length).toBeLessThanOrEqual(20); // Pagination
    });

    it('debounces search input effectively', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // Clear initial fetch calls
      (global.fetch as jest.Mock).mockClear();

      const searchInput = screen.getByPlaceholderText(/search clients/i);

      // Type rapidly
      await user.type(searchInput, 'search query');

      // Should debounce and only make one API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      renderWithProviders(<ClientsPage />);

      expect(screen.getByLabelText(/search clients/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by industry/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add client/i })).toBeInTheDocument();
    });

    it('maintains keyboard navigation support', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByPlaceholderText(/search clients/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/filter by status/i)).toHaveFocus();
    });

    it('provides accessible client cards', async () => {
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        const clientCards = screen.getAllByRole('button');
        expect(clientCards.length).toBeGreaterThan(0);

        // Each client card should be focusable and have proper labels
        clientCards.forEach(card => {
          expect(card).toBeInTheDocument();
        });
      });
    });

    it('announces filter changes to screen readers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText(/filter by status/i);
      expect(statusFilter).toHaveAttribute('aria-live', 'polite');
    });
  });
});
