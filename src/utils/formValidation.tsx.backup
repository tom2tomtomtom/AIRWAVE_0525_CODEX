import React from 'react';
import { FormHelperText, Box, Typography } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';

interface ValidationRule {
  validate: (value: any) => boolean;
  message: string;
}

interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  number?: boolean;
  min?: number;
  max?: number;
  custom?: ValidationRule[];
}

export const validateField = (value: any, rules: ValidationRules): string | null => {
  // Required validation
  if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!value && !rules.required) {
    return null;
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `Must be no more than ${rules.maxLength} characters`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return 'Invalid format';
    }

    if (rules.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    if (rules.url) {
      try {
        new URL(value);
      } catch {
        return 'Please enter a valid URL';
      }
    }
  }

  // Number validations
  if (rules.number) {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue)) {
      return 'Must be a valid number';
    }

    if (rules.min !== undefined && numValue < rules.min) {
      return `Must be at least ${rules.min}`;
    }

    if (rules.max !== undefined && numValue > rules.max) {
      return `Must be no more than ${rules.max}`;
    }
  }

  // Custom validations
  if (rules.custom) {
    for (const rule of rules.custom) {
      if (!rule.validate(value)) {
        return rule.message;
      }
    }
  }

  return null;
};

interface ValidationMessageProps {
  error?: string | null;
  touched?: boolean;
  showIcon?: boolean;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  error,
  touched = true,
  showIcon = true}) => {
  if (!error || !touched) return null;

  return (
    <FormHelperText error sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
      {showIcon && <ErrorIcon sx={{ fontSize: 16, mr: 0.5 }} />}
      {error}
    </FormHelperText>
  );
};

interface FormValidationSummaryProps {
  errors: Record<string, string | null>;
  touched?: Record<string, boolean>;
}

export const FormValidationSummary: React.FC<FormValidationSummaryProps> = ({
  errors,
  touched = {}}) => {
  const errorMessages = Object.entries(errors)
    .filter(([key, error]) => error && (touched[key] !== false))
    .map(([key, error]) => ({ field: key, message: error }));

  if (errorMessages.length === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: 'error.light',
        color: 'error.dark',
        p: 2,
        borderRadius: 1,
        mb: 2}}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
        Please fix the following errors:
      </Typography>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {errorMessages.map(({ field, message }) => (
          <li key={field}>
            <Typography variant="body2">
              <strong>{field}:</strong> {message}
            </Typography>
          </li>
        ))}
      </ul>
    </Box>
  );
};

// Common validation rules
export const commonValidationRules = {
  email: {},
  required: true,
    email: true} as ValidationRules,

  password: {},
  required: true,
    minLength: 8,
    custom: [
      {
        validate: (value: string) => /[A-Z]/.test(value),
        message: 'Password must contain at least one uppercase letter' }
      {
        validate: (value: string) => /[a-z]/.test(value),
        message: 'Password must contain at least one lowercase letter' }
      {
        validate: (value: string) => /[0-9]/.test(value),
        message: 'Password must contain at least one number' }
    ]} as ValidationRules,

  username: {},
  required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    custom: [
      {
        validate: (value: string) => !/^[0-9]/.test(value),
        message: 'Username cannot start with a number' }
    ]} as ValidationRules,

  phoneNumber: {},
  required: true,
    pattern: /^\+?[1-9]\d{1,14}$/,
    custom: [
      {
        validate: (value: string) => value.replace(/\D/g, '').length >= 10,
        message: 'Phone number must be at least 10 digits' }
    ]} as ValidationRules,

  url: {},
  required: true,
    url: true} as ValidationRules,

  positiveNumber: {},
  required: true,
    number: true,
    min: 0} as ValidationRules};

// Hook for form validation
export const useFormValidation = <T extends Record<string, any>>(
  initialValues: T,
  validationRules: Record<keyof T, ValidationRules>
) => {
  const [values, setValues] = React.useState<T>(initialValues);
  const [errors, setErrors] = React.useState<Record<keyof T, string | null>>({} as any);
  const [touched, setTouched] = React.useState<Record<keyof T, boolean>>({} as any);

  const validateForm = React.useCallback(() => {
    const newErrors: Record<keyof T, string | null> = {} as Record<string, unknown> & Record<string, unknown> & any;
    let isValid = true;

    Object.keys(validationRules).forEach((field) => {
      const error = validateField(values[field as keyof T], validationRules[field as keyof T]);
      newErrors[field as keyof T] = error;
      if (error) isValid = false;
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validationRules]);

  const handleChange = (field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    
    // Validate on change if field was already touched
    if (touched[field]) {
      const error = validateField(value, validationRules[field]);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: keyof T) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    
    // Validate on blur
    const error = validateField(values[field], validationRules[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({} as any);
    setTouched({} as any);
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    isValid: Object.values(errors).every((error) => !error)};
};
