
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders correctly', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    render(<Badge variant="secondary">Secondary Badge</Badge>);
    expect(screen.getByText('Secondary Badge')).toBeInTheDocument();
  });
});
