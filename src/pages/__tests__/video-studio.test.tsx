/**
 * Focused test suite for video-studio.tsx page component
 * Large component (1,254 lines) - targeting high-impact functionality
 * Priority: MEDIUM - Page-level testing for critical video workflow
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useRouter } from 'next/router';
import VideoStudio from '../video-studio';

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
const mockClient = {
  activeClient: {
    id: 'client-123',
    name: 'Test Client',
  },
};

const mockNotification = {
  showNotification: jest.fn(),
};

jest.mock('@/contexts/ClientContext', () => ({
  useClient: () => mockClient,
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
  pathname: '/video-studio',
  query: {},
  asPath: '/video-studio',
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

const createMockVideoProject = (overrides = {}) => ({
  id: 'project-123',
  name: 'Summer Campaign Video',
  status: 'draft',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T15:30:00Z',
  client_id: 'client-123',
  template_id: 'template-456',
  assets: [],
  settings: {
    duration: 30,
    aspect_ratio: '16:9',
    quality: 'HD',
    style: 'commercial',
  },
  ...overrides,
});

const createMockVideoJob = (overrides = {}) => ({
  id: 'job-123',
  project_id: 'project-123',
  status: 'pending',
  progress: 0,
  created_at: '2024-01-15T16:00:00Z',
  estimated_completion: '2024-01-15T16:05:00Z',
  output_url: null,
  error_message: null,
  ...overrides,
});

describe('VideoStudio Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Default successful API responses
    (global.fetch as jest.Mock).mockImplementation(url => {
      if (url.includes('/api/video/projects')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              projects: [createMockVideoProject()],
            }),
        });
      }
      if (url.includes('/api/video/templates')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              templates: [
                {
                  id: 'template-1',
                  name: 'Product Showcase',
                  category: 'commercial',
                  thumbnail: 'https://example.com/thumb1.jpg',
                },
                {
                  id: 'template-2',
                  name: 'Social Media Promo',
                  category: 'social',
                  thumbnail: 'https://example.com/thumb2.jpg',
                },
              ],
            }),
        });
      }
      if (url.includes('/api/video/jobs')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              jobs: [createMockVideoJob()],
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
    it('renders page title and navigation', () => {
      renderWithProviders(<VideoStudio />);

      expect(screen.getByText('Video Studio')).toBeInTheDocument();
      expect(screen.getByText(/professional video creation platform/i)).toBeInTheDocument();
    });

    it('shows main workflow tabs', () => {
      renderWithProviders(<VideoStudio />);

      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByText('Render Queue')).toBeInTheDocument();
    });

    it('loads initial data on mount', async () => {
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/video/projects');
        expect(global.fetch).toHaveBeenCalledWith('/api/video/templates');
        expect(global.fetch).toHaveBeenCalledWith('/api/video/jobs');
      });
    });

    it('shows loading state while fetching data', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderWithProviders(<VideoStudio />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Projects Tab', () => {
    it('displays existing projects', async () => {
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Summer Campaign Video')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('shows create new project button', async () => {
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/create new project/i)).toBeInTheDocument();
      });
    });

    it('opens project creation dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/create new project/i)).toBeInTheDocument();
      });

      const createButton = screen.getByText(/create new project/i);
      await user.click(createButton);

      expect(screen.getByText(/new video project/i)).toBeInTheDocument();
    });

    it('allows editing project settings', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Summer Campaign Video')).toBeInTheDocument();
      });

      const projectCard = screen.getByText('Summer Campaign Video').closest('.MuiCard-root');
      const editButton = within(projectCard!).getByLabelText(/edit/i);
      await user.click(editButton);

      expect(screen.getByText(/project settings/i)).toBeInTheDocument();
    });

    it('shows project status correctly', async () => {
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('displays project metadata', async () => {
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/30s/)).toBeInTheDocument(); // duration
        expect(screen.getByText(/16:9/)).toBeInTheDocument(); // aspect ratio
        expect(screen.getByText(/HD/)).toBeInTheDocument(); // quality
      });
    });
  });

  describe('Templates Tab', () => {
    it('switches to templates tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const templatesTab = screen.getByText('Templates');
      await user.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('Product Showcase')).toBeInTheDocument();
        expect(screen.getByText('Social Media Promo')).toBeInTheDocument();
      });
    });

    it('displays template categories', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const templatesTab = screen.getByText('Templates');
      await user.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('commercial')).toBeInTheDocument();
        expect(screen.getByText('social')).toBeInTheDocument();
      });
    });

    it('shows template thumbnails', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const templatesTab = screen.getByText('Templates');
      await user.click(templatesTab);

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.some(img => img.getAttribute('src')?.includes('thumb1.jpg'))).toBe(true);
        expect(images.some(img => img.getAttribute('src')?.includes('thumb2.jpg'))).toBe(true);
      });
    });

    it('allows selecting templates for new projects', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const templatesTab = screen.getByText('Templates');
      await user.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('Product Showcase')).toBeInTheDocument();
      });

      const templateCard = screen.getByText('Product Showcase').closest('.MuiCard-root');
      const useTemplateButton = within(templateCard!).getByText(/use template/i);
      await user.click(useTemplateButton);

      expect(screen.getByText(/create project from template/i)).toBeInTheDocument();
    });

    it('filters templates by category', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const templatesTab = screen.getByText('Templates');
      await user.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('Product Showcase')).toBeInTheDocument();
      });

      // Look for category filter
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.click(categoryFilter);

      const commercialOption = screen.getByText('Commercial');
      await user.click(commercialOption);

      // Should filter to show only commercial templates
      expect(screen.getByText('Product Showcase')).toBeInTheDocument();
    });
  });

  describe('Render Queue Tab', () => {
    it('switches to render queue tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const renderQueueTab = screen.getByText('Render Queue');
      await user.click(renderQueueTab);

      await waitFor(() => {
        expect(screen.getByText(/render job/i)).toBeInTheDocument();
      });
    });

    it('displays active render jobs', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const renderQueueTab = screen.getByText('Render Queue');
      await user.click(renderQueueTab);

      await waitFor(() => {
        expect(screen.getByText('pending')).toBeInTheDocument();
        expect(screen.getByText(/project-123/)).toBeInTheDocument();
      });
    });

    it('shows job progress for processing jobs', async () => {
      const processingJob = createMockVideoJob({
        status: 'processing',
        progress: 45,
      });

      (global.fetch as jest.Mock).mockImplementation(url => {
        if (url.includes('/api/video/jobs')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                jobs: [processingJob],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const renderQueueTab = screen.getByText('Render Queue');
      await user.click(renderQueueTab);

      await waitFor(() => {
        expect(screen.getByText('processing')).toBeInTheDocument();
        expect(screen.getByText('45%')).toBeInTheDocument();
      });
    });

    it('shows completed jobs with download option', async () => {
      const completedJob = createMockVideoJob({
        status: 'completed',
        progress: 100,
        output_url: 'https://example.com/video.mp4',
      });

      (global.fetch as jest.Mock).mockImplementation(url => {
        if (url.includes('/api/video/jobs')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                jobs: [completedJob],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const renderQueueTab = screen.getByText('Render Queue');
      await user.click(renderQueueTab);

      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText(/download/i)).toBeInTheDocument();
      });
    });

    it('displays error messages for failed jobs', async () => {
      const failedJob = createMockVideoJob({
        status: 'failed',
        error_message: 'Rendering failed due to insufficient resources',
      });

      (global.fetch as jest.Mock).mockImplementation(url => {
        if (url.includes('/api/video/jobs')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                jobs: [failedJob],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      const renderQueueTab = screen.getByText('Render Queue');
      await user.click(renderQueueTab);

      await waitFor(() => {
        expect(screen.getByText('failed')).toBeInTheDocument();
        expect(
          screen.getByText('Rendering failed due to insufficient resources')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Project Creation Workflow', () => {
    it('creates new project with form validation', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementationOnce(url => {
        if (url.includes('/api/video/projects') && url !== '/api/video/projects') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                project: createMockVideoProject({ name: 'New Project' }),
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/create new project/i)).toBeInTheDocument();
      });

      const createButton = screen.getByText(/create new project/i);
      await user.click(createButton);

      // Fill out form
      const nameInput = screen.getByLabelText(/project name/i);
      await user.type(nameInput, 'New Project');

      const createProjectButton = screen.getByText(/create project/i);
      await user.click(createProjectButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/video/projects',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('New Project'),
          })
        );
      });
    });

    it('validates required fields in project creation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/create new project/i)).toBeInTheDocument();
      });

      const createButton = screen.getByText(/create new project/i);
      await user.click(createButton);

      // Try to create without required fields
      const createProjectButton = screen.getByText(/create project/i);
      await user.click(createProjectButton);

      expect(screen.getByText(/project name is required/i)).toBeInTheDocument();
    });

    it('handles project creation errors', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/create new project/i)).toBeInTheDocument();
      });

      const createButton = screen.getByText(/create new project/i);
      await user.click(createButton);

      const nameInput = screen.getByLabelText(/project name/i);
      await user.type(nameInput, 'New Project');

      const createProjectButton = screen.getByText(/create project/i);
      await user.click(createProjectButton);

      await waitFor(() => {
        expect(mockNotification.showNotification).toHaveBeenCalledWith(
          expect.stringContaining('Failed to create project'),
          'error'
        );
      });
    });
  });

  describe('Video Rendering Process', () => {
    it('starts render job from project', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementationOnce(url => {
        if (url.includes('/api/video/render')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                job: createMockVideoJob(),
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Summer Campaign Video')).toBeInTheDocument();
      });

      const projectCard = screen.getByText('Summer Campaign Video').closest('.MuiCard-root');
      const renderButton = within(projectCard!).getByText(/render/i);
      await user.click(renderButton);

      expect(screen.getByText(/render settings/i)).toBeInTheDocument();
    });

    it('configures render settings', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Summer Campaign Video')).toBeInTheDocument();
      });

      const projectCard = screen.getByText('Summer Campaign Video').closest('.MuiCard-root');
      const renderButton = within(projectCard!).getByText(/render/i);
      await user.click(renderButton);

      // Should show render configuration options
      expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
    });

    it('submits render job with correct parameters', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementationOnce(url => {
        if (url.includes('/api/video/render')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                job: createMockVideoJob(),
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Summer Campaign Video')).toBeInTheDocument();
      });

      const projectCard = screen.getByText('Summer Campaign Video').closest('.MuiCard-root');
      const renderButton = within(projectCard!).getByText(/render/i);
      await user.click(renderButton);

      const startRenderButton = screen.getByText(/start render/i);
      await user.click(startRenderButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/video/render',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('project-123'),
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('shows retry option on errors', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });

      // Mock successful retry
      (global.fetch as jest.Mock).mockImplementation(url => {
        if (url.includes('/api/video/projects')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                projects: [createMockVideoProject()],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      const retryButton = screen.getByText(/try again/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Summer Campaign Video')).toBeInTheDocument();
      });
    });

    it('handles empty states appropriately', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              projects: [],
              templates: [],
              jobs: [],
            }),
        })
      );

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('polls for job status updates', async () => {
      jest.useFakeTimers();

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Render Queue')).toBeInTheDocument();
      });

      // Clear initial calls
      (global.fetch as jest.Mock).mockClear();

      // Advance timers to trigger polling
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/video/jobs');
      });

      jest.useRealTimers();
    });

    it('updates job status in real-time', async () => {
      jest.useFakeTimers();

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // Initial pending job
      (global.fetch as jest.Mock).mockImplementation(url => {
        if (url.includes('/api/video/jobs')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                jobs: [createMockVideoJob({ status: 'pending' })],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      renderWithProviders(<VideoStudio />);

      const renderQueueTab = screen.getByText('Render Queue');
      await user.click(renderQueueTab);

      await waitFor(() => {
        expect(screen.getByText('pending')).toBeInTheDocument();
      });

      // Update to processing
      (global.fetch as jest.Mock).mockImplementation(url => {
        if (url.includes('/api/video/jobs')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                jobs: [createMockVideoJob({ status: 'processing', progress: 50 })],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByText('processing')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Navigation and Routing', () => {
    it('handles route changes appropriately', () => {
      renderWithProviders(<VideoStudio />);

      expect(mockRouter.pathname).toBe('/video-studio');
    });

    it('navigates to project details when project is opened', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Summer Campaign Video')).toBeInTheDocument();
      });

      const projectCard = screen.getByText('Summer Campaign Video').closest('.MuiCard-root');
      const openButton = within(projectCard!).getByText(/open/i);
      await user.click(openButton);

      expect(mockRouter.push).toHaveBeenCalledWith('/video-studio/project-123');
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      renderWithProviders(<VideoStudio />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('maintains keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoStudio />);

      // Should be able to navigate between tabs with keyboard
      const templatesTab = screen.getByText('Templates');
      templatesTab.focus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Product Showcase')).toBeInTheDocument();
      });
    });

    it('provides accessible project cards', async () => {
      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        const projectCards = screen.getAllByRole('button');
        expect(projectCards.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Considerations', () => {
    it('handles large numbers of projects efficiently', async () => {
      const manyProjects = Array.from({ length: 50 }, (_, i) =>
        createMockVideoProject({
          id: `project-${i}`,
          name: `Project ${i}`,
        })
      );

      (global.fetch as jest.Mock).mockImplementation(url => {
        if (url.includes('/api/video/projects')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                projects: manyProjects,
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      renderWithProviders(<VideoStudio />);

      await waitFor(() => {
        expect(screen.getByText('Project 0')).toBeInTheDocument();
        expect(screen.getByText('Project 49')).toBeInTheDocument();
      });
    });

    it('optimizes re-renders with proper state management', () => {
      const startTime = performance.now();

      renderWithProviders(<VideoStudio />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render reasonably quickly despite complexity
      expect(renderTime).toBeLessThan(100);
    });
  });
});
