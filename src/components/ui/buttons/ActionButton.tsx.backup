import React from 'react';
import {
  Button,
  ButtonProps,
  CircularProgress,
  Box,
  Tooltip,
  alpha} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { createButtonProps } from '@/utils/accessibility';

interface ActionButtonProps extends Omit<ButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  loadingText?: string;
  tooltip?: string;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  variant = 'primary',
  loading = false,
  loadingText,
  tooltip,
  iconPosition = 'start',
  disabled,
  onClick,
  size = 'medium',
  startIcon,
  endIcon,
  ...props
}) => {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  // Create accessible button props
  const accessibilityProps = createButtonProps({
    disabled: isDisabled,
    type: props.type});

  // Determine button styling based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          variant: 'contained' as const,
          sx: {},
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: '#FFFFFF',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.35)}`,
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`},
            '&:active': {
              transform: 'translateY(0)' }
            '&:disabled': {
              background: theme.palette.action.disabledBackground,
              color: theme.palette.action.disabled,
              transform: 'none',
              boxShadow: 'none'}}};

      case 'secondary':
        return {
          variant: 'contained' as const,
          sx: {},
  backgroundColor: theme.palette.secondary.main,
            color: theme.palette.secondary.contrastText,
            fontWeight: 500,
            '&:hover': {
              backgroundColor: theme.palette.secondary.dark,
              transform: 'translateY(-1px)'}}};

      case 'outline':
        return {
          variant: 'outlined' as const,
          sx: {},
  borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            borderWidth: 2,
            fontWeight: 500,
            '&:hover': {
              borderColor: theme.palette.primary.dark,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              transform: 'translateY(-1px)',
              borderWidth: 2}}};

      case 'ghost':
        return {
          variant: 'text' as const,
          sx: {},
  color: theme.palette.primary.main,
            fontWeight: 500,
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              transform: 'translateY(-1px)'}}};

      case 'danger':
        return {
          variant: 'contained' as const,
          sx: {},
  backgroundColor: theme.palette.error.main,
            color: theme.palette.error.contrastText,
            fontWeight: 500,
            '&:hover': {
              backgroundColor: theme.palette.error.dark,
              transform: 'translateY(-1px)'}}};

      default:
        return { variant: 'contained' as const };
    }
  };

  const variantStyles = getVariantStyles();

  // Size-specific styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: '6px 16px',
          fontSize: '0.875rem',
          minHeight: '32px'};
      case 'large':
        return {
          padding: '12px 32px',
          fontSize: '1rem',
          minHeight: '48px'};
      default:
        return {
          padding: '10px 24px',
          fontSize: '0.875rem',
          minHeight: '40px'};
    }
  };

  const sizeStyles = getSizeStyles();

  const buttonContent = (
    <Button
      {...props}
      {...accessibilityProps}
      {...variantStyles}
      disabled={isDisabled}
      onClick={onClick}
      startIcon={
        loading ? (
          <CircularProgress size={16} color="inherit" />
        ) : iconPosition === 'start' ? (
          startIcon
        ) : undefined
      }
      endIcon={iconPosition === 'end' ? endIcon : undefined}
      sx={{
        ...sizeStyles,
        ...variantStyles.sx,
        ...props.sx}}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1}}
      >
        {loading && loadingText ? loadingText : children}
      </Box>
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip} placement="top">
        <span>{buttonContent}</span>
      </Tooltip>
    );
  }

  return buttonContent;
};