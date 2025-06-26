# AIRWAVE Components Documentation

This directory contains React components for the AIRWAVE platform. Components are organized by functionality and follow consistent patterns for maintainability and reusability.

## 📁 Directory Structure

```
src/components/
├── ui/                    # Reusable UI components
│   ├── buttons/           # Button components
│   ├── forms/             # Form components
│   ├── feedback/          # Loading, error states
│   └── notifications/     # Notification system
├── workflow/              # Workflow-specific components
├── analytics/             # Analytics and monitoring
├── campaigns/             # Campaign management
├── generate/              # AI generation components
├── realtime/              # Real-time features
├── social/                # Social media publishing
└── strategic/             # Strategic planning tools
```

## 🧩 Component Categories

### Core UI Components
Basic, reusable components that form the foundation of the interface.

- **Button** - Standard action buttons with variants
- **Card** - Content containers with consistent styling
- **FormTextField** - Enhanced text input with validation
- **FormSelect** - Dropdown selection component
- **LoadingSpinner** - Loading indicators
- **ErrorBoundary** - Error handling wrapper

### Layout Components
Components that handle page structure and navigation.

- **DashboardLayout** - Main application layout
- **ProtectedRoute** - Authentication wrapper
- **SimplifiedLayout** - Clean layout for focused workflows

### Business Logic Components
Components that implement core AIRWAVE functionality.

- **UnifiedBriefWorkflow** - Main workflow orchestrator
- **AIImageGenerator** - AI-powered image generation
- **CampaignMatrix** - Campaign planning matrix
- **AssetBrowser** - Asset management interface

### Real-time Components
Components that handle live updates and collaboration.

- **RealTimeDashboard** - Live system monitoring
- **ActivityFeed** - Real-time activity updates
- **NotificationCenter** - Notification management

## 🎨 Design Patterns

### Component Structure
```typescript
// ComponentName.tsx
import React from 'react';
import { ComponentProps } from './types';

/**
 * Brief description of what this component does
 * 
 * @param props - Component props
 * @returns JSX element
 */
export const ComponentName: React.FC<ComponentProps> = ({
  prop1,
  prop2,
  ...rest
}) => {
  // Component logic here
  
  return (
    <div {...rest}>
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
```

### Props Interface
```typescript
// types.ts
export interface ComponentProps {
  /** Required prop description */
  requiredProp: string;
  
  /** Optional prop description */
  optionalProp?: boolean;
  
  /** Callback prop description */
  onAction?: (value: string) => void;
  
  /** Standard HTML props */
  className?: string;
  children?: React.ReactNode;
}
```

### Error Handling
All components should include error boundaries and graceful degradation:

```typescript
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export const MyComponent = () => (
  <ErrorBoundary fallback={<ErrorFallback />}>
    <ComponentContent />
  </ErrorBoundary>
);
```

### Loading States
Components should handle loading states appropriately:

```typescript
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export const MyComponent = ({ isLoading, data }) => {
  if (isLoading) {
    return <LoadingSpinner message="Loading data..." />;
  }
  
  return <DataDisplay data={data} />;
};
```

## 🔧 Styling Guidelines

### CSS-in-JS with Material-UI
Components use Material-UI's styling system with consistent theming:

```typescript
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

const StyledContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));
```

### Responsive Design
All components should be mobile-responsive:

```typescript
const useStyles = makeStyles((theme) => ({
  container: {
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1),
    },
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(3),
    },
  },
}));
```

## 🧪 Testing Guidelines

### Component Testing
Each component should have corresponding tests:

```typescript
// ComponentName.test.tsx
import { render, screen } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName requiredProp="test" />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
  
  it('handles user interactions', () => {
    const mockHandler = jest.fn();
    render(<ComponentName onAction={mockHandler} />);
    
    // Test interactions
  });
});
```

### Testing Utilities
Use the testing utilities from `@/components/__tests__/ui-helpers.test.tsx`:

```typescript
import { renderWithProviders } from '@/components/__tests__/ui-helpers.test';
```

## 📱 Accessibility

### ARIA Labels
Ensure all interactive elements have proper ARIA labels:

```typescript
<button
  aria-label="Delete campaign"
  aria-describedby="delete-description"
  onClick={handleDelete}
>
  <DeleteIcon />
</button>
```

### Keyboard Navigation
Components should support keyboard navigation:

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    handleAction();
  }
};
```

## 🚀 Performance

### Lazy Loading
Use React.lazy for heavy components:

```typescript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

export const LazyWrapper = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <HeavyComponent />
  </Suspense>
);
```

### Memoization
Use React.memo for expensive renders:

```typescript
export const ExpensiveComponent = React.memo<Props>(({ data }) => {
  // Expensive rendering logic
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.data.id === nextProps.data.id;
});
```

## 🔄 State Management

### Local State
Use useState for component-local state:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [data, setData] = useState<DataType | null>(null);
```

### Context
Use React Context for component trees:

```typescript
const ComponentContext = createContext<ContextType | null>(null);

export const useComponentContext = () => {
  const context = useContext(ComponentContext);
  if (!context) {
    throw new Error('useComponentContext must be used within ComponentProvider');
  }
  return context;
};
```

## 📋 Component Checklist

Before creating a new component, ensure:

- [ ] Clear, descriptive name
- [ ] Proper TypeScript interfaces
- [ ] Error boundary integration
- [ ] Loading state handling
- [ ] Responsive design
- [ ] Accessibility features
- [ ] Unit tests written
- [ ] Documentation comments
- [ ] Proper imports/exports
- [ ] Performance considerations

## 🔗 Related Documentation

- [API Documentation](/api/docs) - Backend API reference
- [Testing Guide](/docs/testing.md) - Testing standards and utilities
- [Deployment Guide](/docs/deployment.md) - Component deployment patterns
- [Style Guide](/docs/styles.md) - Design system and theming

## 🤝 Contributing

When adding new components:

1. Follow the established patterns
2. Add comprehensive tests
3. Document props and usage
4. Consider accessibility
5. Test on multiple devices
6. Update this documentation if needed

For questions or suggestions, please refer to the project's contribution guidelines.