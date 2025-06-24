import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback} from 'react';
import { PaletteMode } from '@mui/material';

interface ThemeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
};

interface ThemeModeProviderProps {
  children: ReactNode;
}

export const ThemeModeProvider: React.FC<ThemeModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>('light');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize theme only after component mounts (client-side)
  useEffect(() => {
    // Get initial theme from blocking script or default
    const currentTheme = document.documentElement.getAttribute(
      'data-mui-color-scheme'
    ) as PaletteMode;
    if (currentTheme === 'dark' || currentTheme === 'light') {
      setMode(currentTheme);
    }
    setMounted(true);
  }, []);

  // Debounced theme toggle to prevent rapid switching
  const toggleMode = useCallback(() => {
    if (isTransitioning) return; // Prevent switching during transition

    setIsTransitioning(true);
    const newMode = mode === 'light' ? 'dark' : 'light';

    // Add transition class to body
    document.body.classList.add('theme-transitioning');

    // Update DOM immediately for instant visual feedback
    document.documentElement.setAttribute('data-mui-color-scheme', newMode);
    document.documentElement.style.colorScheme = newMode;

    // Update localStorage
    try {
      localStorage.setItem('themeMode', newMode);
    } catch (error: unknown) {
      console.warn('Failed to save theme to localStorage:', error);
    }

    // Set new mode after a brief delay to allow DOM update
    setTimeout(() => {
      setMode(newMode);

      // Remove transition class after theme has been applied
      setTimeout(() => {
        document.body.classList.remove('theme-transitioning');
        setIsTransitioning(false);
      }, 300); // Match CSS transition duration
    }, 50);
  }, [mode, isTransitioning]);

  // Only update DOM attributes when mode changes (not on every render)
  useEffect(() => {
    if (!mounted) return;

    document.documentElement.setAttribute('data-mui-color-scheme', mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode, mounted]);

  // Don't render until mounted to prevent hydration mismatches
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{ mode: 'light', toggleMode: () => {}, isTransitioning: false }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
};
