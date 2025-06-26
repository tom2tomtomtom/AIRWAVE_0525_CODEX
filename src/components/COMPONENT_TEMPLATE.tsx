import React from 'react';

/**
 * ComponentName - Brief description of what this component does
 * 
 * Longer description explaining the component's purpose, key features,
 * and how it fits into the larger application architecture.
 * 
 * Features:
 * - Feature 1 description
 * - Feature 2 description
 * - Feature 3 description
 * 
 * @example
 * ```tsx
 * // Basic usage example
 * const MyPage = () => {
 *   const [value, setValue] = useState('');
 *   
 *   return (
 *     <ComponentName
 *       value={value}
 *       onChange={setValue}
 *       placeholder="Enter value"
 *     />
 *   );
 * };
 * ```
 * 
 * @example
 * ```tsx
 * // Advanced usage example
 * const AdvancedPage = () => {
 *   const handleSubmit = (data: FormData) => {
 *     console.log('Form submitted:', data);
 *   };
 *   
 *   return (
 *     <ComponentName
 *       onSubmit={handleSubmit}
 *       validation={{ required: true, minLength: 5 }}
 *       customStyles={{ border: '2px solid blue' }}
 *     />
 *   );
 * };
 * ```
 */

interface ComponentNameProps {
  /** Required prop - describe what this does */
  requiredProp: string;
  
  /** Optional prop with default behavior */
  optionalProp?: boolean;
  
  /** 
   * Callback prop - describe when this is called
   * @param value - Description of the parameter
   */
  onAction?: (value: string) => void;
  
  /** Custom CSS classes to apply */
  className?: string;
  
  /** Child elements to render inside the component */
  children?: React.ReactNode;
  
  /** Accessibility label for screen readers */
  'aria-label'?: string;
}

/**
 * Optional: Define additional interfaces used by this component
 */
interface ComponentState {
  isLoading: boolean;
  error: string | null;
  data: any[];
}

export const ComponentName: React.FC<ComponentNameProps> = ({
  requiredProp,
  optionalProp = false,
  onAction,
  className,
  children,
  'aria-label': ariaLabel,
  ...rest
}) => {
  // Document complex state with comments
  const [state, setState] = React.useState<ComponentState>({
    isLoading: false,
    error: null,
    data: []
  });

  // Document side effects and their purposes
  React.useEffect(() => {
    // Initialize component or fetch data
    // Explain what triggers this effect and what it does
  }, [requiredProp]);

  // Document event handlers
  const handleUserAction = React.useCallback((event: React.MouseEvent) => {
    // Prevent default if needed
    event.preventDefault();
    
    // Perform action logic
    const result = processUserInput(event);
    
    // Call callback if provided
    onAction?.(result);
  }, [onAction]);

  // Document conditional rendering logic
  if (state.isLoading) {
    return (
      <div className="loading-container" aria-live="polite">
        Loading component data...
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="error-container" role="alert">
        Error: {state.error}
      </div>
    );
  }

  // Main component render
  return (
    <div 
      className={`component-name ${className || ''}`}
      aria-label={ariaLabel}
      {...rest}
    >
      {/* Document complex JSX structures */}
      <header className="component-header">
        <h2>{requiredProp}</h2>
        {optionalProp && (
          <span className="optional-indicator">Optional feature enabled</span>
        )}
      </header>
      
      <main className="component-content">
        {children}
      </main>
      
      <footer className="component-actions">
        <button 
          onClick={handleUserAction}
          disabled={state.isLoading}
          aria-describedby="action-description"
        >
          Perform Action
        </button>
        <div id="action-description" className="sr-only">
          This button will trigger the main component action
        </div>
      </footer>
    </div>
  );
};

// Helper functions should be documented too
/**
 * Processes user input and returns formatted result
 * @param event - Mouse event from user interaction
 * @returns Processed string value
 */
function processUserInput(event: React.MouseEvent): string {
  // Implementation details
  return 'processed-value';
}

export default ComponentName;

/**
 * Export additional utilities if needed
 */
export type { ComponentNameProps, ComponentState };