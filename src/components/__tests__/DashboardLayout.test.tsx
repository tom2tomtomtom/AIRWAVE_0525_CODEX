import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DashboardLayout from '../DashboardLayout';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

describe('DashboardLayout', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      pathname: '/',
      push: mockPush,
    });
  });

  it('renders children correctly', () => {
    const childText = 'Test Child Content';
    render(<DashboardLayout><div>{childText}</div></DashboardLayout>);
    expect(screen.getByText(childText)).toBeInTheDocument();
  });

  it('renders navigation menu', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Generate/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Templates/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Matrix/i)[0]).toBeInTheDocument();
  });

  it('highlights active route', () => {
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      pathname: '/generate-enhanced',
      push: mockPush,
    });
    
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    const generateItem = screen.getAllByText(/Generate/i)[0];
    const wrapper = generateItem.closest('[role="button"]');
    expect(wrapper).toHaveClass('Mui-selected');
  });
});
