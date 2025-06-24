import { useForm, UseFormProps, FieldValues, Path, RegisterOptions } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCallback, useMemo } from 'react';

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  url: /^https?:\/\/.+\..+/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s\-_]+$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8}$/};

// Common validation messages
export const validationMessages = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  url: 'Please enter a valid URL',
  minLength: (min: number) => `Must be at least ${min} characters long`,
  maxLength: (max: number) => `Must not exceed ${max} characters`,
  min: (min: number) => `Must be at least ${min}`,
  max: (max: number) => `Must not exceed ${max}`,
  strongPassword: 'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character',
  confirmPassword: 'Passwords do not match',
  fileSize: (maxSizeMB: number) => `File size must not exceed ${maxSizeMB}MB`,
  fileType: (allowedTypes: string[]) => `Only ${allowedTypes.join(', ')} files are allowed`};

// Zod schema builders for common patterns
export const createValidationSchema = {
  email: (required = true) => 
    required 
      ? z.string().min(1, validationMessages.required).email(validationMessages.email)
      : z.string().optional().refine(val => !val || validationPatterns.email.test(val), validationMessages.email),

  password: (required = true, strong = false) => {
    let schema = z.string();
    if (required) schema = schema.min(1, validationMessages.required);
    if (strong) schema = schema.regex(validationPatterns.strongPassword, validationMessages.strongPassword);
    else schema = schema.min(6, validationMessages.minLength(6));
    return required ? schema : schema.optional();
  },

  confirmPassword: (passwordField: string) =>
    z.string().min(1, validationMessages.required),

  text: (required = true, min?: number, max?: number) => {
    let schema = z.string();
    if (required) schema = schema.min(1, validationMessages.required);
    if (min) schema = schema.min(min, validationMessages.minLength(min));
    if (max) schema = schema.max(max, validationMessages.maxLength(max));
    return required ? schema : schema.optional();
  },

  number: (required = true, min?: number, max?: number) => {
    let schema = z.number();
    if (min !== undefined) schema = schema.min(min, validationMessages.min(min));
    if (max !== undefined) schema = schema.max(max, validationMessages.max(max));
    return required ? schema : schema.optional();
  },

  url: (required = true) =>
    required
      ? z.string().min(1, validationMessages.required).url(validationMessages.url)
      : z.string().optional().refine(val => !val || validationPatterns.url.test(val), validationMessages.url),

  phone: (required = true) =>
    required
      ? z.string().min(1, validationMessages.required).regex(validationPatterns.phone, validationMessages.phone)
      : z.string().optional().refine(val => !val || validationPatterns.phone.test(val), validationMessages.phone),

  file: (required = true, maxSizeMB?: number, allowedTypes?: string[]) => {
    const schema = z.instanceof(File);
    // Note: File validation in Zod is complex, so we'll handle this in the form validation hook
    return required ? schema : schema.optional();
  }};

// React Hook Form validation rules
export const createValidationRules = {
  required: (message = validationMessages.required): RegisterOptions => ({
    required: { value: true, message }}),

  email: (required = true): RegisterOptions => ({
    ...(required && { required: { value: true, message: validationMessages.required } }),
    pattern: { value: validationPatterns.email, message: validationMessages.email }}),

  password: (required = true, strong = false): RegisterOptions => ({
    ...(required && { required: { value: true, message: validationMessages.required } }),
    minLength: { value: strong ? 8 : 6, message: validationMessages.minLength(strong ? 8 : 6)  }
    ...(strong && {
      pattern: { value: validationPatterns.strongPassword, message: validationMessages.strongPassword }})}),

  text: (required = true, min?: number, max?: number): RegisterOptions => ({
    ...(required && { required: { value: true, message: validationMessages.required } }),
    ...(min && { minLength: { value: min, message: validationMessages.minLength(min) } }),
    ...(max && { maxLength: { value: max, message: validationMessages.maxLength(max) } })}),

  number: (required = true, min?: number, max?: number): RegisterOptions => ({
    ...(required && { required: { value: true, message: validationMessages.required } }),
    ...(min !== undefined && { min: { value: min, message: validationMessages.min(min) } }),
    ...(max !== undefined && { max: { value: max, message: validationMessages.max(max) } }),
    valueAsNumber: true}),

  url: (required = true): RegisterOptions => ({
    ...(required && { required: { value: true, message: validationMessages.required } }),
    pattern: { value: validationPatterns.url, message: validationMessages.url }}),

  phone: (required = true): RegisterOptions => ({
    ...(required && { required: { value: true, message: validationMessages.required } }),
    pattern: { value: validationPatterns.phone, message: validationMessages.phone }}),

  file: (required = true, maxSizeMB?: number, allowedTypes?: string[]): RegisterOptions => ({
    ...(required && { required: { value: true, message: validationMessages.required } }),
    validate: { }
      ...(maxSizeMB && {
        fileSize: (files: FileList) => {
          if (!files || files.length === 0) return true;
          const file = files[0];
          return file.size <= maxSizeMB * 1024 * 1024 || validationMessages.fileSize(maxSizeMB);
        }}),
      ...(allowedTypes && {
        fileType: (files: FileList) => {
          if (!files || files.length === 0) return true;
          const file = files[0];
          const fileType = file.type;
          const fileExtension = file.name.split('.').pop()?.toLowerCase();
          return (
            allowedTypes.some(type => 
              fileType.includes(type) || (fileExtension && type.includes(fileExtension))
            ) || validationMessages.fileType(allowedTypes)
          );
        }})}})};

// Enhanced form hook with common patterns
interface UseFormValidationOptions<T extends FieldValues> extends UseFormProps<T> {
  schema?: z.ZodSchema<T>;
  onSubmitSuccess?: (data: T) => void | Promise<void>;
  onSubmitError?: (error: Error) => void;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export function useFormValidation<T extends FieldValues>({
  schema,
  onSubmitSuccess,
  onSubmitError,
  autoSave = false,
  autoSaveDelay = 1000,
  ...formOptions
}: UseFormValidationOptions<T> = {}) {
  const form = useForm<T>({
    ...formOptions,
    resolver: schema ? zodResolver(schema) : undefined});

  const { handleSubmit, watch, formState: { errors, isSubmitting, isDirty } } = form;

  // Auto-save functionality
  const watchedValues = watch();
  
  const handleFormSubmit = useCallback(
    async (data: T) => {
      try {
        await onSubmitSuccess?.(data);
      } catch (error: any) {
        onSubmitError?.(error as Error);
      }
    },
    [onSubmitSuccess, onSubmitError]
  );

  // Validation helpers
  const validateField = useCallback(
    async (fieldName: Path<T>) => {
      return form.trigger(fieldName);
    },
    [form]
  );

  const validateForm = useCallback(async () => {
    return form.trigger();
  }, [form]);

  const getFieldError = useCallback(
    (fieldName: Path<T>) => {
      const error = errors[fieldName];
      return error?.message as string | undefined;
    },
    [errors]
  );

  const hasFieldError = useCallback(
    (fieldName: Path<T>) => {
      return Boolean(errors[fieldName]);
    },
    [errors]
  );

  // Form state helpers
  const isFieldDirty = useCallback(
    (fieldName: Path<T>) => {
      return Boolean(form.formState.dirtyFields[fieldName]);
    },
    [form.formState.dirtyFields]
  );

  const resetField = useCallback(
    (fieldName: Path<T>) => {
      form.resetField(fieldName);
    },
    [form]
  );

  const setFieldValue = useCallback(
    (fieldName: Path<T>, value: any) => {
      form.setValue(fieldName, value, { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

  const clearErrors = useCallback(() => {
    form.clearErrors();
  }, [form]);

  // Confirm password validation helper
  const addConfirmPasswordValidation = useCallback(
    (passwordField: Path<T>, confirmPasswordField: Path<T>) => {
      return {
        validate: (value: string) => {
          const passwordValue = form.getValues(passwordField);
          return value === passwordValue || validationMessages.confirmPassword;
        }};
    },
    [form]
  );

  // File validation helpers
  const validateFile = useCallback(
    (file: File, maxSizeMB?: number, allowedTypes?: string[]) => {
      const errors: string[] = [];

      if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        errors.push(validationMessages.fileSize(maxSizeMB));
      }

      if (allowedTypes) {
        const fileType = file.type;
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const isValidType = allowedTypes.some(type =>
          fileType.includes(type) || (fileExtension && type.includes(fileExtension))
        );
        
        if (!isValidType) {
          errors.push(validationMessages.fileType(allowedTypes));
        }
      }

      return errors;
    },
    []
  );

  // Computed properties
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);
  const canSubmit = useMemo(() => !hasErrors && !isSubmitting, [hasErrors, isSubmitting]);

  return {
    ...form,
    handleFormSubmit: handleSubmit(handleFormSubmit),
    validateField,
    validateForm,
    getFieldError,
    hasFieldError,
    isFieldDirty,
    resetField,
    setFieldValue,
    clearErrors,
    addConfirmPasswordValidation,
    validateFile,
    hasErrors,
    canSubmit,
    // Convenience getters
    isLoading: isSubmitting,
    isDirty};
}

// Common form schemas
export const commonSchemas = {
  login: z.object({
    email: createValidationSchema.email(),
    password: createValidationSchema.password()}),

  signup: z.object({
    firstName: createValidationSchema.text(true, 2, 50),
    lastName: createValidationSchema.text(true, 2, 50),
    email: createValidationSchema.email(),
    password: createValidationSchema.password(true, true),
    confirmPassword: createValidationSchema.confirmPassword('password')}).refine((data) => data.password === data.confirmPassword, {
    message: validationMessages.confirmPassword,
    path: ['confirmPassword']}),

  profile: z.object({
    firstName: createValidationSchema.text(true, 2, 50),
    lastName: createValidationSchema.text(true, 2, 50),
    email: createValidationSchema.email(),
    phone: createValidationSchema.phone(false),
    bio: createValidationSchema.text(false, 0, 500)}),

  client: z.object({
    name: createValidationSchema.text(true, 2, 100),
    email: createValidationSchema.email(false),
    phone: createValidationSchema.phone(false),
    industry: createValidationSchema.text(false, 0, 50),
    website: createValidationSchema.url(false),
    description: createValidationSchema.text(false, 0, 1000)}),

  campaign: z.object({
    name: createValidationSchema.text(true, 2, 100),
    description: createValidationSchema.text(false, 0, 1000),
    clientId: createValidationSchema.text(true),
    startDate: z.date(),
    endDate: z.date(),
    budget: createValidationSchema.number(false, 0)}).refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate']})};