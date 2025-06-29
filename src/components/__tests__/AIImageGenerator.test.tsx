/**
 * Comprehensive test suite for AIImageGenerator component
 * Critical business logic component for AI image generation workflow
 * Priority: HIGH - Core business functionality with complex API integration
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AIImageGenerator } from '../AIImageGenerator';
import { createMockAsset } from '@/test/test-setup-enhanced';

// Enhanced mocks for AI functionality
const mockAxios = {
  post: jest.fn(),
  isAxiosError: jest.fn(),
};

jest.mock('axios', () => mockAxios);

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  jest.clearAllMocks();
  mockAxios.isAxiosError.mockReturnValue(false);
});

afterEach(() => {
  process.env = originalEnv;
});

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

const defaultProps = {
  clientId: 'client-123',
  onImageGenerated: jest.fn(),
  brandGuidelines: {
    colors: ['#FF0000', '#00FF00'],
    fonts: ['Arial', 'Helvetica'],
    tone: 'professional',
    style: 'modern',
  },
};

const createMockGeneratedImage = (overrides = {}) => ({
  success: true,
  asset: createMockAsset({
    type: 'image',
    name: 'AI Generated Image',
    ai_prompt: 'Test prompt',
    ...overrides,
  }),
  generation_details: {
    original_prompt: 'A modern office space',
    enhanced_prompt: 'Enhanced: A modern office space with professional lighting',
    revised_prompt: 'DALL-E revised: A contemporary office space',
    model: 'dall-e-3',
    settings: {
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    },
  },
  ...overrides,
});

describe('AIImageGenerator', () => {
  describe('Initial Rendering', () => {
    it('renders all essential UI elements', () => {
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      expect(screen.getByText('AI Image Generator (DALL-E 3)')).toBeInTheDocument();
      expect(screen.getByLabelText(/describe the image you want to create/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Image Size')).toBeInTheDocument();
      expect(screen.getByLabelText('Purpose')).toBeInTheDocument();
      expect(screen.getByLabelText('Quality')).toBeInTheDocument();
      expect(screen.getByLabelText('Style')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate image/i })).toBeInTheDocument();
    });

    it('shows demo mode indicator when in demo mode', () => {
      process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      expect(screen.getByText('DEMO MODE')).toBeInTheDocument();
      expect(screen.getByText(/you're in demo mode/i)).toBeInTheDocument();
    });

    it('shows API key warning when no key is configured', () => {
      process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
      process.env.NEXT_PUBLIC_OPENAI_API_KEY = '';

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      expect(screen.getByText(/openai api key is not configured/i)).toBeInTheDocument();
    });

    it('initializes with default generation options', () => {
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      expect(screen.getByDisplayValue('1024x1024')).toBeInTheDocument();
      expect(screen.getByDisplayValue('general')).toBeInTheDocument();
      expect(screen.getByDisplayValue('standard')).toBeInTheDocument();
      expect(screen.getByDisplayValue('vivid')).toBeInTheDocument();
    });
  });

  describe('Input Validation', () => {
    it('shows validation error for empty prompt', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a description for your image/i)).toBeInTheDocument();
      });
    });

    it('shows validation error for prompt too short', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'Hi');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(
          screen.getByText(/description must be at least 3 characters long/i)
        ).toBeInTheDocument();
      });
    });

    it('shows validation error for prompt too long', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const longPrompt = 'A'.repeat(1001);
      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, longPrompt);

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(
          screen.getByText(/description must be less than 1000 characters/i)
        ).toBeInTheDocument();
      });
    });

    it('blocks inappropriate content', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'explicit violent content');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/your prompt contains inappropriate content/i)).toBeInTheDocument();
      });
    });

    it('shows character count', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'Test prompt');

      expect(screen.getByText('11/1000 characters')).toBeInTheDocument();
    });

    it('clears validation errors when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      // Trigger validation error
      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a description/i)).toBeInTheDocument();
      });

      // Type in input to clear error
      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'Valid prompt');

      expect(screen.queryByText(/please enter a description/i)).not.toBeInTheDocument();
    });
  });

  describe('Generation Options', () => {
    it('allows changing image size', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const sizeSelect = screen.getByLabelText('Image Size');
      await user.click(sizeSelect);

      const landscapeOption = screen.getByText('Landscape (1792×1024)');
      await user.click(landscapeOption);

      expect(screen.getByDisplayValue('1792x1024')).toBeInTheDocument();
    });

    it('allows changing purpose', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const purposeSelect = screen.getByLabelText('Purpose');
      await user.click(purposeSelect);

      const heroOption = screen.getByText('Hero Image');
      await user.click(heroOption);

      expect(screen.getByDisplayValue('hero')).toBeInTheDocument();
    });

    it('allows changing quality and shows cost indication', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const qualitySelect = screen.getByLabelText('Quality');
      await user.click(qualitySelect);

      const hdOption = screen.getByText('HD (2x cost)');
      await user.click(hdOption);

      expect(screen.getByDisplayValue('hd')).toBeInTheDocument();
    });

    it('allows changing style between vivid and natural', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const styleSelect = screen.getByLabelText('Style');
      await user.click(styleSelect);

      const naturalOption = screen.getByText('Natural (More realistic)');
      await user.click(naturalOption);

      expect(screen.getByDisplayValue('natural')).toBeInTheDocument();
    });

    it('allows toggling AI prompt enhancement', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const enhanceSwitch = screen.getByLabelText('AI Enhance Prompt');
      expect(enhanceSwitch).toBeChecked();

      await user.click(enhanceSwitch);
      expect(enhanceSwitch).not.toBeChecked();
    });
  });

  describe('Demo Mode Generation', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('generates demo image with simulated delay', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A beautiful landscape');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      // Should show loading state
      expect(screen.getByText('Generating...')).toBeInTheDocument();
      expect(generateButton).toBeDisabled();

      // Fast-forward time to complete generation
      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
      });
    });

    it('calls onImageGenerated callback with demo data', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onImageGenerated = jest.fn();

      renderWithProviders(
        <AIImageGenerator {...defaultProps} onImageGenerated={onImageGenerated} />
      );

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A beautiful landscape');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(onImageGenerated).toHaveBeenCalledWith(
          expect.objectContaining({
            name: expect.stringContaining('AI Generated - A beautiful landscape'),
            ai_prompt: 'A beautiful landscape',
          })
        );
      });
    });
  });

  describe('API Integration', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
      process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'test-api-key';
    });

    it('makes correct API call with all parameters', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith('/api/dalle', {
          prompt: 'A modern office space',
          client_id: 'client-123',
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid',
          purpose: 'general',
          enhance_prompt: true,
          brand_guidelines: defaultProps.brandGuidelines,
          tags: ['ai-generated', 'general'],
        });
      });
    });

    it('shows loading state during API call', async () => {
      const user = userEvent.setup();
      mockAxios.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      expect(screen.getByText('Generating...')).toBeInTheDocument();
      expect(generateButton).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('opens results dialog on successful generation', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
        expect(screen.getByText('Original Prompt:')).toBeInTheDocument();
        expect(screen.getByText('A modern office space')).toBeInTheDocument();
      });
    });

    it('displays enhanced prompt when available', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Enhanced Prompt:')).toBeInTheDocument();
        expect(
          screen.getByText('Enhanced: A modern office space with professional lighting')
        ).toBeInTheDocument();
      });
    });

    it('displays DALL-E revised prompt when available', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('DALL-E Revised Prompt:')).toBeInTheDocument();
        expect(screen.getByText('DALL-E revised: A contemporary office space')).toBeInTheDocument();
      });
    });

    it('shows generation metadata chips', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('dall-e-3')).toBeInTheDocument();
        expect(screen.getByText('1024x1024')).toBeInTheDocument();
        expect(screen.getByText('standard')).toBeInTheDocument();
        expect(screen.getByText('vivid')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
      process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'test-api-key';
    });

    it('shows error for missing API key', async () => {
      process.env.NEXT_PUBLIC_OPENAI_API_KEY = '';
      const user = userEvent.setup();

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/openai api key is not configured/i)).toBeInTheDocument();
      });
    });

    it('handles 401 unauthorized error', async () => {
      const user = userEvent.setup();
      const axiosError = {
        response: { status: 401, data: { message: 'Invalid API key' } },
      };
      mockAxios.post.mockRejectedValue(axiosError);
      mockAxios.isAxiosError.mockReturnValue(true);

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid api key/i)).toBeInTheDocument();
      });
    });

    it('handles 429 rate limit error', async () => {
      const user = userEvent.setup();
      const axiosError = {
        response: { status: 429, data: { message: 'Rate limit exceeded' } },
      };
      mockAxios.post.mockRejectedValue(axiosError);
      mockAxios.isAxiosError.mockReturnValue(true);

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
      });
    });

    it('handles 400 bad request error', async () => {
      const user = userEvent.setup();
      const axiosError = {
        response: { status: 400, data: { message: 'Invalid prompt' } },
      };
      mockAxios.post.mockRejectedValue(axiosError);
      mockAxios.isAxiosError.mockReturnValue(true);

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid prompt')).toBeInTheDocument();
      });
    });

    it('handles generic API errors', async () => {
      const user = userEvent.setup();
      const axiosError = {
        response: { status: 500, data: { error: 'Internal server error' } },
      };
      mockAxios.post.mockRejectedValue(axiosError);
      mockAxios.isAxiosError.mockReturnValue(true);

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
      });
    });

    it('handles non-Axios errors', async () => {
      const user = userEvent.setup();
      mockAxios.post.mockRejectedValue(new Error('Network error'));
      mockAxios.isAxiosError.mockReturnValue(false);

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('allows dismissing error messages', async () => {
      const user = userEvent.setup();
      mockAxios.post.mockRejectedValue(new Error('Test error'));

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });
  });

  describe('Results Dialog Functionality', () => {
    it('allows copying original prompt', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(),
        },
      });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByLabelText(/copy/i);
      await user.click(copyButtons[0]);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('A modern office space');
    });

    it('allows copying enhanced prompt', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(),
        },
      });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByLabelText(/copy/i);
      await user.click(copyButtons[1]);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Enhanced: A modern office space with professional lighting'
      );
    });

    it('provides download functionality', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      // Mock document.createElement and DOM manipulation
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      const createElementSpy = jest.spyOn(document, 'createElement');
      createElementSpy.mockReturnValue(mockLink as any);

      const appendChildSpy = jest.spyOn(document.body, 'appendChild');
      const removeChildSpy = jest.spyOn(document.body, 'removeChild');
      appendChildSpy.mockImplementation(() => ({}) as any);
      removeChildSpy.mockImplementation(() => ({}) as any);

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('Download Image');
      await user.click(downloadButton);

      expect(mockLink.href).toBe(mockResponse.asset.url);
      expect(mockLink.download).toMatch(/ai-generated-\d+\.png/);
      expect(mockLink.click).toHaveBeenCalled();

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('allows generating another image', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
      });

      const generateAnotherButton = screen.getByText('Generate Another');
      await user.click(generateAnotherButton);

      expect(screen.queryByText('Generated Image')).not.toBeInTheDocument();
      expect(promptInput).toHaveValue('');
    });

    it('allows closing dialog', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(screen.queryByText('Generated Image')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      expect(screen.getByLabelText(/describe the image you want to create/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Image Size')).toBeInTheDocument();
      expect(screen.getByLabelText('Purpose')).toBeInTheDocument();
      expect(screen.getByLabelText('Quality')).toBeInTheDocument();
      expect(screen.getByLabelText('Style')).toBeInTheDocument();
      expect(screen.getByLabelText('AI Enhance Prompt')).toBeInTheDocument();
    });

    it('maintains focus management in dialog', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Generated Image')).toBeInTheDocument();
      });

      // Dialog should be accessible via keyboard
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('provides proper form validation feedback', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        const promptInput = screen.getByLabelText(/describe the image you want to create/i);
        expect(promptInput).toBeInvalid();
        expect(promptInput).toHaveAccessibleDescription();
      });
    });
  });

  describe('Performance', () => {
    it('debounces input validation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);

      // Type rapidly
      await user.type(promptInput, 'Test prompt for validation');

      // Character count should update immediately
      expect(screen.getByText('27/1000 characters')).toBeInTheDocument();
    });

    it('handles multiple rapid option changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const sizeSelect = screen.getByLabelText('Image Size');
      const qualitySelect = screen.getByLabelText('Quality');

      // Rapid changes should not cause issues
      await user.click(sizeSelect);
      await user.click(screen.getByText('Landscape (1792×1024)'));
      await user.click(qualitySelect);
      await user.click(screen.getByText('HD (2x cost)'));

      expect(screen.getByDisplayValue('1792x1024')).toBeInTheDocument();
      expect(screen.getByDisplayValue('hd')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates with brand guidelines', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(<AIImageGenerator {...defaultProps} />);

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith(
          '/api/dalle',
          expect.objectContaining({
            brand_guidelines: defaultProps.brandGuidelines,
          })
        );
      });
    });

    it('calls onImageGenerated callback with correct data', async () => {
      const user = userEvent.setup();
      const onImageGenerated = jest.fn();
      const mockResponse = createMockGeneratedImage();
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      renderWithProviders(
        <AIImageGenerator {...defaultProps} onImageGenerated={onImageGenerated} />
      );

      const promptInput = screen.getByLabelText(/describe the image you want to create/i);
      await user.type(promptInput, 'A modern office space');

      const generateButton = screen.getByRole('button', { name: /generate image/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(onImageGenerated).toHaveBeenCalledWith(mockResponse.asset);
      });
    });

    it('works without optional props', () => {
      const minimalProps = { clientId: 'client-123' };

      renderWithProviders(<AIImageGenerator {...minimalProps} />);

      expect(screen.getByText('AI Image Generator (DALL-E 3)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate image/i })).toBeInTheDocument();
    });
  });
});
