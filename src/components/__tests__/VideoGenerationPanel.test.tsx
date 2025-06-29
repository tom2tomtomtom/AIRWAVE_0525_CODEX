/**
 * Comprehensive test suite for VideoGenerationPanel component
 * Critical business logic component for video generation workflow
 * Priority: HIGH - Core video functionality with complex job management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import VideoGenerationPanel from '../VideoGenerationPanel';

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

const defaultProps = {
  combinations: [
    {
      id: 'combo-1',
      fields: {
        headline: { value: 'Amazing Product Launch' },
        copy: { value: 'Discover our revolutionary new product that will change your life.' },
      },
    },
    {
      id: 'combo-2',
      fields: {
        headline: { value: 'Limited Time Offer' },
        copy: { value: 'Get 50% off on all premium features this month only.' },
      },
    },
  ],
  campaignId: 'campaign-123',
  onComplete: jest.fn(),
};

const createMockVideoJob = (overrides = {}) => ({
  id: 'job-123',
  generation_id: 'gen-123',
  variation_index: 1,
  status: 'pending',
  progress: 0,
  render_job_id: 'render-123',
  created_at: new Date().toISOString(),
  ...overrides,
});

const createMockGenerationResponse = (overrides = {}) => ({
  success: true,
  data: {
    generation_id: 'gen-123',
    jobs: {
      results: [
        {
          job_id: 'job-1',
          status: 'pending',
          render_job_id: 'render-1',
          estimated_completion: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
        },
        {
          job_id: 'job-2',
          status: 'pending',
          render_job_id: 'render-2',
          estimated_completion: new Date(Date.now() + 300000).toISOString(),
        },
      ],
    },
  },
  ...overrides,
});

describe('VideoGenerationPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial Rendering', () => {
    it('renders all essential UI elements', () => {
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      expect(screen.getByText('Video Generation')).toBeInTheDocument();
      expect(screen.getByText('Generate Videos')).toBeInTheDocument();
      expect(screen.getByText('Refresh Status')).toBeInTheDocument();
    });

    it('shows info message when no combinations are provided', () => {
      renderWithProviders(<VideoGenerationPanel combinations={[]} />);

      expect(
        screen.getByText(/configure your campaign matrix and generate combinations first/i)
      ).toBeInTheDocument();
    });

    it('disables generate button when no combinations', () => {
      renderWithProviders(<VideoGenerationPanel combinations={[]} />);

      const generateButton = screen.getByText('Generate Videos');
      expect(generateButton).toBeDisabled();
    });

    it('enables generate button when combinations are available', () => {
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe('Configuration Dialog', () => {
    it('opens configuration dialog when generate button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      expect(screen.getByText('Video Generation Settings')).toBeInTheDocument();
    });

    it('shows all configuration options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      expect(screen.getByLabelText('Platform')).toBeInTheDocument();
      expect(screen.getByLabelText('Style')).toBeInTheDocument();
      expect(screen.getByLabelText('Quality')).toBeInTheDocument();
      expect(screen.getByText(/duration/i)).toBeInTheDocument();
      expect(screen.getByText(/variations/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Include Captions')).toBeInTheDocument();
      expect(screen.getByLabelText('Include Voice Over')).toBeInTheDocument();
    });

    it('allows changing platform', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const platformSelect = screen.getByLabelText('Platform');
      await user.click(platformSelect);

      const youtubeOption = screen.getByText('YouTube');
      await user.click(youtubeOption);

      expect(screen.getByDisplayValue('youtube')).toBeInTheDocument();
    });

    it('allows changing style', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const styleSelect = screen.getByLabelText('Style');
      await user.click(styleSelect);

      const cinematicOption = screen.getByText('Cinematic');
      await user.click(cinematicOption);

      expect(screen.getByDisplayValue('cinematic')).toBeInTheDocument();
    });

    it('allows changing quality', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const qualitySelect = screen.getByLabelText('Quality');
      await user.click(qualitySelect);

      const highOption = screen.getByText('High Quality');
      await user.click(highOption);

      expect(screen.getByDisplayValue('high')).toBeInTheDocument();
    });

    it('allows adjusting duration with slider', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const durationSlider = screen.getByRole('slider', { name: /duration/i });

      // Simulate slider change
      fireEvent.change(durationSlider, { target: { value: 30 } });

      expect(screen.getByText('Duration: 30s')).toBeInTheDocument();
    });

    it('allows adjusting variations count', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const variationsSlider = screen.getByRole('slider', { name: /variations/i });

      fireEvent.change(variationsSlider, { target: { value: 5 } });

      expect(screen.getByText('Variations: 5')).toBeInTheDocument();
    });

    it('toggles voice over option and shows text field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const voiceOverSwitch = screen.getByLabelText('Include Voice Over');
      await user.click(voiceOverSwitch);

      expect(screen.getByLabelText('Voice Over Text')).toBeInTheDocument();
    });

    it('allows entering custom voice over text', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const voiceOverSwitch = screen.getByLabelText('Include Voice Over');
      await user.click(voiceOverSwitch);

      const voiceOverText = screen.getByLabelText('Voice Over Text');
      await user.type(voiceOverText, 'Custom voice over script');

      expect(voiceOverText).toHaveValue('Custom voice over script');
    });

    it('closes dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      expect(screen.getByText('Video Generation Settings')).toBeInTheDocument();

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(screen.queryByText('Video Generation Settings')).not.toBeInTheDocument();
    });
  });

  describe('Video Generation Process', () => {
    it('shows error when no client is selected', async () => {
      mockClient.activeClient = null;
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      expect(mockNotification.showNotification).toHaveBeenCalledWith(
        'Please select a client first',
        'error'
      );
    });

    it('shows error when no combinations are available', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel combinations={[]} />);

      expect(screen.getByText(/configure your campaign matrix/i)).toBeInTheDocument();
    });

    it('makes correct API call with configuration', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      // Change some settings
      const platformSelect = screen.getByLabelText('Platform');
      await user.click(platformSelect);
      await user.click(screen.getByText('YouTube'));

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/video/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'campaign_based',
            campaign_id: 'campaign-123',
            video_config: {
              prompt: expect.stringContaining('Create a commercial video'),
              style: 'commercial',
              duration: 15,
              platform: 'youtube',
              quality: 'standard',
              aspect_ratio: '16:9',
            },
            content_elements: {
              voice_over: undefined,
              background_music: true,
            },
            generation_settings: {
              variations_count: 3,
              include_captions: true,
              auto_optimize_for_platform: true,
              save_to_assets: true,
            },
          }),
        });
      });
    });

    it('creates prompt from combinations', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/video/generate',
          expect.objectContaining({
            body: expect.stringContaining('Amazing Product Launch, Limited Time Offer'),
          })
        );
      });
    });

    it('includes voice over configuration when enabled', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      // Enable voice over
      const voiceOverSwitch = screen.getByLabelText('Include Voice Over');
      await user.click(voiceOverSwitch);

      const voiceOverText = screen.getByLabelText('Voice Over Text');
      await user.type(voiceOverText, 'Custom script');

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/video/generate',
          expect.objectContaining({
            body: expect.stringContaining('"text":"Custom script"'),
          })
        );
      });
    });

    it('shows success notification on generation start', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(mockNotification.showNotification).toHaveBeenCalledWith(
          'Started generation of 2 videos',
          'success'
        );
      });
    });

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(mockNotification.showNotification).toHaveBeenCalledWith(
          'Failed to start video generation: Network error',
          'error'
        );
      });
    });

    it('disables UI during generation', async () => {
      const user = userEvent.setup();
      // Mock slow response
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve(createMockGenerationResponse()),
                }),
              1000
            )
          )
      );

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      // UI should be disabled during generation
      expect(screen.getByRole('button', { name: /generate videos/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /refresh status/i })).toBeDisabled();
    });
  });

  describe('Job Management and Status Display', () => {
    it('displays job statistics', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Processing count
        expect(screen.getByText('Processing')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });

    it('displays individual job cards', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
        expect(screen.getAllByText('PENDING')).toHaveLength(2);
      });
    });

    it('shows progress bar for processing jobs', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: { ...createMockVideoJob(), status: 'processing', progress: 45 },
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      // Wait for initial jobs to be created
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Advance timers to trigger status update
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByText('45% complete')).toBeInTheDocument();
      });
    });

    it('shows estimated completion time', async () => {
      const user = userEvent.setup();
      const estimatedTime = new Date(Date.now() + 300000).toISOString();
      const mockResponse = createMockGenerationResponse({
        data: {
          generation_id: 'gen-123',
          jobs: {
            results: [
              {
                job_id: 'job-1',
                status: 'processing',
                estimated_completion: estimatedTime,
              },
            ],
          },
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/est\. completion:/i)).toBeInTheDocument();
      });
    });

    it('shows error messages for failed jobs', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: {
                ...createMockVideoJob(),
                status: 'failed',
                error_message: 'Rendering failed due to insufficient resources',
              },
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      // Wait for initial jobs
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Advance timers to trigger status update
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(
          screen.getByText('Rendering failed due to insufficient resources')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Completed Job Actions', () => {
    beforeEach(() => {
      // Mock window.open
      window.open = jest.fn();
    });

    it('shows preview and download buttons for completed jobs', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: {
                ...createMockVideoJob(),
                status: 'completed',
                output_url: 'https://example.com/video.mp4',
              },
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      // Wait for initial jobs
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Advance timers to trigger status update
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });

    it('opens video URL when preview is clicked', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: {
                ...createMockVideoJob(),
                status: 'completed',
                output_url: 'https://example.com/video.mp4',
              },
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
      });

      const previewButton = screen.getByText('Preview');
      await user.click(previewButton);

      expect(window.open).toHaveBeenCalledWith('https://example.com/video.mp4', '_blank');
    });

    it('opens video URL when download is clicked', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: {
                ...createMockVideoJob(),
                status: 'completed',
                output_url: 'https://example.com/video.mp4',
              },
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByText('Download')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('Download');
      await user.click(downloadButton);

      expect(window.open).toHaveBeenCalledWith('https://example.com/video.mp4', '_blank');
    });
  });

  describe('Real-time Updates', () => {
    it('polls for job updates when jobs are active', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: createMockVideoJob(),
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Advance timers to trigger polling
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/video/status?job_id=job-1');
      });
    });

    it('stops polling when no active jobs remain', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: { ...createMockVideoJob(), status: 'completed' },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: { ...createMockVideoJob({ id: 'job-2' }), status: 'completed' },
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // First poll completes first job
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/video/status?job_id=job-1');
      });

      // Second poll completes second job
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/video/status?job_id=job-2');
      });

      // Clear mock call count
      (global.fetch as jest.Mock).mockClear();

      // Third poll should not happen since all jobs are complete
      jest.advanceTimersByTime(5000);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles polling errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockResponse = createMockGenerationResponse();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching job updates:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Manual Refresh', () => {
    it('allows manual refresh of job status', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              job: createMockVideoJob(),
            }),
        });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Clear previous fetch calls
      (global.fetch as jest.Mock).mockClear();

      const refreshButton = screen.getByText('Refresh Status');
      await user.click(refreshButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/video/status?job_id=job-1');
      });
    });

    it('disables refresh button during generation', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve(createMockGenerationResponse()),
                }),
              1000
            )
          )
      );

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      const refreshButton = screen.getByText('Refresh Status');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Platform-specific Configuration', () => {
    it('sets correct aspect ratio for different platforms', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      // Test TikTok (9:16)
      const platformSelect = screen.getByLabelText('Platform');
      await user.click(platformSelect);
      await user.click(screen.getByText('TikTok'));

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/video/generate',
          expect.objectContaining({
            body: expect.stringContaining('"aspect_ratio":"9:16"'),
          })
        );
      });
    });

    it('handles platforms correctly in prompt generation', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const platformSelect = screen.getByLabelText('Platform');
      await user.click(platformSelect);
      await user.click(screen.getByText('LinkedIn'));

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/video/generate',
          expect.objectContaining({
            body: expect.stringContaining('linkedin platform'),
          })
        );
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles empty combinations array', () => {
      renderWithProviders(<VideoGenerationPanel combinations={[]} />);

      expect(screen.getByText(/configure your campaign matrix/i)).toBeInTheDocument();
    });

    it('works without campaignId prop', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel combinations={defaultProps.combinations} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/video/generate',
          expect.objectContaining({
            body: expect.stringContaining('"type":"standalone"'),
          })
        );
      });
    });

    it('handles malformed API responses', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: 'Invalid request format' }),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        expect(mockNotification.showNotification).toHaveBeenCalledWith(
          'Failed to start video generation: Invalid request format',
          'error'
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /generate videos/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh status/i })).toBeInTheDocument();
    });

    it('maintains proper focus management in dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Video Generation Settings')).toBeInTheDocument();
    });

    it('provides accessible status indicators', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGenerationResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      renderWithProviders(<VideoGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByText('Generate Videos');
      await user.click(generateButton);

      const startButton = screen.getByText('Start Generation');
      await user.click(startButton);

      await waitFor(() => {
        const statusChips = screen.getAllByText('PENDING');
        statusChips.forEach(chip => {
          expect(chip).toBeInTheDocument();
        });
      });
    });
  });
});
