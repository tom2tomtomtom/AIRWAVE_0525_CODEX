// Accessibility utilities for better WCAG compliance

import { useEffect, useRef, useState } from 'react';

// ARIA label and description utilities
export interface AriaAttributes {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-disabled'?: boolean;
  role?: string;
}

// Generate unique IDs for accessibility
let idCounter = 0;
export const generateId = (prefix = 'airflow'): string => {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now()}`;
};

// Create accessible form field props
export interface AccessibleFieldProps {
  id: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
}

export const createAccessibleField = (
  label: string,
  options: {
    required?: boolean;
    invalid?: boolean;
    description?: string;
    errorMessage?: string;
  } = {}
): {
  fieldProps: AccessibleFieldProps;
  labelProps: { htmlFor: string; id: string };
  descriptionProps?: { id: string };
  errorProps?: { id: string; role: string; 'aria-live': 'polite' };
} => {
  const fieldId = generateId('field');
  const labelId = generateId('label');
  const descriptionId = options.description ? generateId('description') : undefined;
  const errorId = options.errorMessage ? generateId('error') : undefined;

  const describedByIds = [descriptionId, errorId].filter(Boolean).join(' ');

  const result: any = {
    fieldProps: {
      id: fieldId,
      'aria-label': label,
      ...(describedByIds && { 'aria-describedby': describedByIds }),
      ...(options.required !== undefined && { 'aria-required': options.required }),
      ...(options.invalid !== undefined && { 'aria-invalid': options.invalid }),
    },
    labelProps: {
      htmlFor: fieldId,
      id: labelId,
    },
  };

  if (descriptionId) {
    result.descriptionProps = { id: descriptionId };
  }

  if (errorId) {
    result.errorProps = {
      id: errorId,
      role: 'alert',
      'aria-live': 'polite' as const,
    };
  }

  return result;
};

// Focus management utilities
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Dispatch custom event for parent components to handle
        container.dispatchEvent(new CustomEvent('escape-pressed'));
      }
    };

    container.addEventListener('keydown', handleTabKey);
    container.addEventListener('keydown', handleEscapeKey);

    // Focus the first element when trap becomes active
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      container.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isActive]);

  return containerRef;
};

// Screen reader announcements
export const announceToScreenReader = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';

  document.body.appendChild(announcement);

  // Set the message after a brief delay to ensure screen readers pick it up
  setTimeout(() => {
    announcement.textContent = message;
  }, 100);

  // Clean up after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 3000);
};

// Keyboard navigation helpers
export const handleKeyboardActivation = (
  event: React.KeyboardEvent,
  callback: () => void,
  keys: string[] = ['Enter', ' ']
) => {
  if (keys.includes(event.key)) {
    event.preventDefault();
    callback();
  }
};

// Color contrast utilities
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    // Simple RGB extraction - in production, use a proper color parsing library
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const sRGB = [r, g, b].map((c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * sRGB[0]! + 0.7152 * sRGB[1]! + 0.0722 * sRGB[2]!;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
};

export const meetsWCAGAA = (foreground: string, background: string, fontSize = 16): boolean => {
  const ratio = getContrastRatio(foreground, background);
  const isLargeText = fontSize >= 18 || fontSize >= 14; // 14pt bold or 18pt normal
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
};

export const meetsWCAGAAA = (foreground: string, background: string, fontSize = 16): boolean => {
  const ratio = getContrastRatio(foreground, background);
  const isLargeText = fontSize >= 18 || fontSize >= 14;
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
};

// Skip link component props
export interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

// Modal/Dialog accessibility props
export interface ModalA11yProps {
  'aria-modal': true;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  role: 'dialog' | 'alertdialog';
}

export const createModalProps = (title?: string, description?: string): ModalA11yProps => {
  const titleId = title ? generateId('modal-title') : undefined;
  const descId = description ? generateId('modal-desc') : undefined;

  const props: any = {
    'aria-modal': true,
    role: 'dialog',
  };

  if (titleId) {
    props['aria-labelledby'] = titleId;
  }

  if (descId) {
    props['aria-describedby'] = descId;
  }

  return props;
};

// Loading state accessibility
export interface LoadingA11yProps {
  'aria-live': 'polite';
  'aria-busy': boolean;
  'aria-label': string;
}

export const createLoadingProps = (
  isLoading: boolean,
  loadingText = 'Loading...',
  completeText = 'Loading complete'
): LoadingA11yProps => {
  return {
    'aria-live': 'polite',
    'aria-busy': isLoading,
    'aria-label': isLoading ? loadingText : completeText,
  };
};

// Button accessibility enhancements
export interface ButtonA11yProps {
  type?: 'button' | 'submit' | 'reset';
  'aria-pressed'?: boolean;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-describedby'?: string;
  disabled?: boolean;
}

export const createButtonProps = (
  options: {
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
    describedBy?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  } = {}
): ButtonA11yProps => {
  const props: any = {
    type: options.type || 'button',
  };

  if (options.pressed !== undefined) {
    props['aria-pressed'] = options.pressed;
  }

  if (options.expanded !== undefined) {
    props['aria-expanded'] = options.expanded;
  }

  if (options.controls) {
    props['aria-controls'] = options.controls;
  }

  if (options.describedBy) {
    props['aria-describedby'] = options.describedBy;
  }

  if (options.disabled !== undefined) {
    props.disabled = options.disabled;
  }

  return props;
};

// Navigation accessibility
export interface NavA11yProps {
  role: 'navigation';
  'aria-label'?: string;
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time';
}

export const createNavProps = (
  label?: string,
  current?: 'page' | 'step' | 'location' | 'date' | 'time'
): NavA11yProps => {
  const props: any = {
    role: 'navigation',
  };

  if (label) {
    props['aria-label'] = label;
  }

  if (current) {
    props['aria-current'] = current;
  }

  return props;
};

// Table accessibility
export interface TableA11yProps {
  role?: 'table';
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-rowcount'?: number;
  'aria-colcount'?: number;
}

export const createTableProps = (
  label?: string,
  description?: string,
  rowCount?: number,
  colCount?: number
): TableA11yProps => {
  const descId = description ? generateId('table-desc') : undefined;

  return {
    role: 'table',
    'aria-label': label,
    'aria-describedby': descId,
    'aria-rowcount': rowCount,
    'aria-colcount': colCount,
  };
};

// Reduced motion detection
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// Export commonly used ARIA attributes for reuse
export const commonAriaAttributes = {
  hidden: { 'aria-hidden': true },
  expanded: (isExpanded: boolean) => ({ 'aria-expanded': isExpanded }),
  pressed: (isPressed: boolean) => ({ 'aria-pressed': isPressed }),
  disabled: (isDisabled: boolean) => ({ 'aria-disabled': isDisabled }),
  required: { 'aria-required': true },
  invalid: (isInvalid: boolean) => ({ 'aria-invalid': isInvalid }),
  current: (current: string) => ({ 'aria-current': current }),
  live: (level: 'polite' | 'assertive') => ({ 'aria-live': level }),
} as const;
