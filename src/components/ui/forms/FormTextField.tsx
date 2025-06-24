import React from 'react';
import {
  TextField,
  TextFieldProps,
  FormHelperText,
  Box,
  Typography,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { useFormContext, Controller } from 'react-hook-form';
import { createAccessibleField } from '@/utils/accessibility';

interface FormTextFieldProps extends Omit<TextFieldProps, 'name'> {
  name: string;
  label: string;
  tooltip?: string;
  description?: string;
  rules?: Record<string, unknown>;
  maxLength?: number;
  showCharacterCount?: boolean;
}

export const FormTextField: React.FC<FormTextFieldProps> = ({
  name,
  label,
  tooltip,
  description,
  rules = {},
  maxLength,
  showCharacterCount = false,
  ...textFieldProps
}) => {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext();

  const value = watch(name) || '';
  const error = errors[name];
  const hasError = Boolean(error);
  const errorMessage = error?.message as string;

  // Create accessible field props
  const { fieldProps, labelProps, descriptionProps, errorProps } = createAccessibleField(label, {
    required: Boolean(rules.required),
    invalid: hasError,
    description,
    errorMessage,
  });

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
          {rules.required && (
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

      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field }) => (
          <TextField
            {...field}
            {...textFieldProps}
            {...fieldProps}
            fullWidth
            error={hasError}
            helperText={hasError ? errorMessage : textFieldProps.helperText}
            inputProps={{
              ...textFieldProps.inputProps,
              maxLength,
              'aria-describedby': fieldProps['aria-describedby'],
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'background.paper',
                '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'error.main',
                  borderWidth: 2 },
                '&.Mui-focused.Mui-error .MuiOutlinedInput-notchedOutline': {
                  boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.1)',
                },
              },
              ...textFieldProps.sx,
            }}
          />
        )}
      />

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

      {showCharacterCount && maxLength && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: value.length > maxLength * 0.9 ? 'warning.main' : 'text.secondary',
              fontWeight: value.length > maxLength * 0.9 ? 600 : 400 }}
          >
            {value.length}/{maxLength}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
