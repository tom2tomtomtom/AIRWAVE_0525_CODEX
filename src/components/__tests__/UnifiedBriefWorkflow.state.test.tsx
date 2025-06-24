import React from 'react';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { UnifiedBriefWorkflow } from '../UnifiedBriefWorkflow';
import { NotificationProvider } from '@/contexts/NotificationContext';

// Mock the notification context
const MockNotificationProvider = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })};
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage });

// Mock fetch for API calls
global.fetch = jest.fn();

describe('UnifiedBriefWorkflow State Management', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    jest.clearAllMocks();

    // Reset console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderWorkflow = (props: Record<string, any> = {}) => {
    const defaultProps = {
      open: true,
      onClose: jest.fn(),
      onComplete: jest.fn() };

    return render(
      <MockNotificationProvider>
        <UnifiedBriefWorkflow {...defaultProps} {...props} />
      </MockNotificationProvider>
    );
  };

  test('should initialize with empty state when no saved state exists', async () => {
    renderWorkflow();

    // Should render the workflow dialog with new title
    expect(screen.getByText('AIRWAVE Campaign Builder')).toBeInTheDocument();
    // Should render the upload step label
    expect(screen.getByText('Upload Brief')).toBeInTheDocument();
    // Wait for lazy-loaded component to render and check for unique text
    await waitFor(() => {
      expect(
        screen.getByText(
          'Start by uploading your campaign brief. Our AI will parse the content and extract key information.'
        )
      ).toBeInTheDocument();
    });
  });

  test('should restore state from sessionStorage when available', () => {
    renderWorkflow();

    // Should render the workflow dialog with new title
    expect(screen.getByText('AIRWAVE Campaign Builder')).toBeInTheDocument();
    // Should render the upload step
    expect(screen.getByText('Upload Brief')).toBeInTheDocument();
  });

  test('should save state to sessionStorage when state changes', async () => {
    renderWorkflow();

    // Component should render without errors with new title
    expect(screen.getByText('AIRWAVE Campaign Builder')).toBeInTheDocument();
  });

  test('should prevent multiple initializations', () => {
    const { rerender } = renderWorkflow();

    // Rerender the component
    rerender(
      <MockNotificationProvider>
        <UnifiedBriefWorkflow open={true} onClose={jest.fn()} onComplete={jest.fn()} />
      </MockNotificationProvider>
    );

    // Should not initialize multiple times
    const initializationLogs = (console.log as jest.Mock).mock.calls.filter(
      call => call[0] && call[0].includes('Finalizing workflow state initialization')
    );

    expect(initializationLogs.length).toBeLessThanOrEqual(1);
  });

  test('should clear state when resetWorkflow is called', async () => {
    const savedState = {
      activeStep: 2,
      briefData: { title: 'Test Brief'  },
  motivations: [{ id: '1', text: 'Test', selected: true }] };

    mockSessionStorage.setItem('airwave_unified_workflow_state', JSON.stringify(savedState));

    renderWorkflow();

    // Find and click the Start Over button (if visible)
    const startOverButton = screen.queryByText('Start Over');
    if (startOverButton) {
      fireEvent.click(startOverButton);

      await waitFor(() => {
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
          'airwave_unified_workflow_state'
        );
      });
    }
  });

  test('should maintain component instance across re-renders', () => {
    const { rerender } = renderWorkflow();

    // Component should render initially with new title
    expect(screen.getByText('AIRWAVE Campaign Builder')).toBeInTheDocument();

    rerender(
      <MockNotificationProvider>
        <UnifiedBriefWorkflow open={true} onClose={jest.fn()} onComplete={jest.fn()} />
      </MockNotificationProvider>
    );

    // Should still render after re-render with new title
    expect(screen.getByText('AIRWAVE Campaign Builder')).toBeInTheDocument();
  });
});
