import { createTheme, PaletteMode } from '@mui/material/styles';

// Premium Gradient Color Palette
const premiumColors = {
  // Light Mode
  light: {
    // Primary accent - Electric Violet
    primary: {
      main: '#7C3AED',
      light: '#8B5CF6',
      dark: '#6D28D9',
      glow: 'rgba(124, 58, 237, 0.3)',
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'
    },
    // Background gradients
    background: {
      default: '#FAFBFC',
      paper: '#FFFFFF',
      gradient: 'linear-gradient(135deg, #F8FAFF 0%, #FEF3FF 100%)',
      mesh: 'radial-gradient(at 40% 20%, hsla(280, 75%, 96%, 1) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(340, 75%, 96%, 1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(220, 75%, 96%, 1) 0px, transparent 50%)'
    },
    // Text hierarchy
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
      disabled: '#94A3B8'
    },
    // Floating panel styles
    panel: {
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(20px)',
      border: 'rgba(124, 58, 237, 0.1)',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      hoverShadow: '0 12px 48px rgba(124, 58, 237, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05)'
    },
    // Glass morphism
    glass: {
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(10px)',
      border: 'rgba(255, 255, 255, 0.18)'
    }
  },
  // Dark Mode
  dark: {
    // Primary accent - Electric Purple
    primary: {
      main: '#A78BFA',
      light: '#C4B5FD',
      dark: '#8B5CF6',
      glow: 'rgba(167, 139, 250, 0.4)',
      gradient: 'linear-gradient(135deg, #A78BFA 0%, #F472B6 100%)'
    },
    // Background gradients
    background: {
      default: '#0A0E1A',
      paper: '#0F1629',
      gradient: 'linear-gradient(135deg, #0A0E1A 0%, #1A0F29 100%)',
      mesh: 'radial-gradient(at 40% 20%, hsla(280, 100%, 15%, 1) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(340, 100%, 15%, 1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(220, 100%, 15%, 1) 0px, transparent 50%)'
    },
    // Text hierarchy
    text: {
      primary: '#F8FAFC',
      secondary: '#CBD5E1',
      disabled: '#64748B'
    },
    // Floating panel styles
    panel: {
      background: 'rgba(15, 22, 41, 0.8)',
      backdropFilter: 'blur(20px)',
      border: 'rgba(167, 139, 250, 0.2)',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
      hoverShadow: '0 12px 48px rgba(167, 139, 250, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3)'
    },
    // Glass morphism
    glass: {
      background: 'rgba(15, 22, 41, 0.6)',
      backdropFilter: 'blur(10px)',
      border: 'rgba(167, 139, 250, 0.15)'
    }
  }
};

// Enhanced Component Theme Extension
export const getThemeConfig = (mode: PaletteMode) => {
  const colors = premiumColors[mode];
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary.main,
        light: colors.primary.light,
        dark: colors.primary.dark,
        contrastText: mode === 'light' ? '#FFFFFF' : '#000000',
      },
      background: {
        default: colors.background.default,
        paper: colors.background.paper,
      },
      text: {
        primary: colors.text.primary,
        secondary: colors.text.secondary,
        disabled: colors.text.disabled,
      },
      divider: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '3.5rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '2.5rem',
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      h3: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: '1.1rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.4,
        letterSpacing: '0.4px',
      },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: [
      'none',
      '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
      '0px 3px 6px rgba(0, 0, 0, 0.16), 0px 3px 6px rgba(0, 0, 0, 0.23)',
      '0px 10px 20px rgba(0, 0, 0, 0.19), 0px 6px 6px rgba(0, 0, 0, 0.23)',
      '0px 14px 28px rgba(0, 0, 0, 0.25), 0px 10px 10px rgba(0, 0, 0, 0.22)',
      '0px 19px 38px rgba(0, 0, 0, 0.30), 0px 15px 12px rgba(0, 0, 0, 0.22)',
      '0px 24px 48px rgba(0, 0, 0, 0.35), 0px 20px 20px rgba(0, 0, 0, 0.22)',
      ...Array(18).fill('0px 24px 48px rgba(0, 0, 0, 0.35), 0px 20px 20px rgba(0, 0, 0, 0.22)') as string[],
    ] as ["none", string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: colors.background.gradient,
            minHeight: '100vh',
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            letterSpacing: '0.2px',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backdropFilter: colors.panel.backdropFilter,
            border: `1px solid ${colors.panel.border}`,
            boxShadow: colors.panel.shadow,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: colors.panel.hoverShadow,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
            padding: '8px 16px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          contained: {
            background: colors.primary.gradient,
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
            '&:hover': {
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.6)',
              transform: 'translateY(-1px)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: colors.glass.background,
            backdropFilter: colors.glass.backdropFilter,
            border: `1px solid ${colors.glass.border}`,
            borderRadius: 16,
          },
        },
      },
    },
  });
};

export default getThemeConfig;