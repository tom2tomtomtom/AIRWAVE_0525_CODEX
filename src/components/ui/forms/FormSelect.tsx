import React from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  Tooltip,
  IconButton,
  SelectProps,
  Chip,
} from '@mui/material';
import { Info as InfoIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useFormContext, Controller } from 'react-hook-form';
import { createAccessibleField } from '@/utils/accessibility';

export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface FormSelectProps extends Omit<SelectProps, 'name'> {
  name: string;
  label: string;
  options: SelectOption[];
  tooltip?: string;
  description?: string;
  rules?: Record<string, unknown>;
  loading?: boolean;
  allowMultiple?: boolean;
  maxSelections?: number;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  name,
  label,
  options,
  tooltip,
  description,
  rules = {},
  loading = false,
  allowMultiple = false,
  maxSelections,
  ...selectProps
}) => {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext();

  const value = watch(name);
  const error = errors[name];
  const hasError = Boolean(error);
  const errorMessage = error?.message as string;

  // Create accessible field props
  const { fieldProps, labelProps, descriptionProps, errorProps } = createAccessibleField(label, {
    required: Boolean(rules.required),
    invalid: hasError,
    ...(description && { description }),
    errorMessage,
  });

  const renderValue = (selected: unknown) => {
    if (allowMultiple && Array.isArray(selected)) {
      if (selected.length === 0) return <em>None selected</em>;

      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {selected.map((val: any) => {
            const option = options.find((opt: any) => opt.value === val);
            return (
              <Chip
                key={val}
                label={option?.label || val}
                size="small"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiChip-deleteIcon': {
                    color: 'primary.contrastText' },
                }}
              />
            );
          })}
        </Box>
      );
    }

    const selectedOption = options.find((opt: any) => opt.value === selected);
    return selectedOption?.label || '';
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography
          component="label"
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5 }}
          {...labelProps}
        >
          {label}
          {Boolean(rules.required) && (
            <Typography component="span" sx={{ color: 'error.main', ml: 0.5 }}>
              *
            </Typography>
          )}
          {tooltip && (
            <Tooltip title={tooltip} placement="top">
              <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Typography>
      </Box>

      <FormControl fullWidth error={hasError}>
        <Controller
          name={name}
          control={control}
          rules={rules}
          render={({ field }) => (
            <Select
              {...field}
              {...selectProps}
              {...fieldProps}
              multiple={allowMultiple}
              loading={loading}
              renderValue={allowMultiple ? renderValue : undefined}
              IconComponent={ExpandMoreIcon}
              sx={{
                backgroundColor: 'background.paper',
                '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'error.main',
                  borderWidth: 2 },
                '&.Mui-focused.Mui-error .MuiOutlinedInput-notchedOutline': {
                  boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.1)',
                },
                ...selectProps.sx,
              }}
            >
              {loading ? (
                <MenuItem disabled>Loading...</MenuItem>
              ) : options.length === 0 ? (
                <MenuItem disabled>No options available</MenuItem>
              ) : (
                options.map((option: any) => (
                  <MenuItem
                    key={option.value}
                    value={option.value}
                    disabled={
                      option.disabled ||
                      (allowMultiple &&
                        maxSelections &&
                        Array.isArray(value) &&
                        value.length >= maxSelections &&
                        !value.includes(option.value))
                    }
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1 }}
                  >
                    {option.icon && (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>{option.icon}</Box>
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{option.label}</Typography>
                      {option.description && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {option.description}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          )}
        />
      </FormControl>

      {description && !hasError && (
        <FormHelperText {...descriptionProps} sx={{ mt: 0.5, color: 'text.secondary' }}>
          {description}
        </FormHelperText>
      )}

      {hasError && errorMessage && (
        <FormHelperText {...errorProps} sx={{ mt: 0.5, color: 'error.main' }}>
          {errorMessage}
        </FormHelperText>
      )}

      {allowMultiple && maxSelections && Array.isArray(value) && (
        <FormHelperText sx={{ mt: 0.5, color: 'text.secondary' }}>
          {value.length}/{maxSelections} selections
        </FormHelperText>
      )}
    </Box>
  );
};
