// utils/format.ts

// Date formatting
export function formatDate(date: string | Date, format: 'short' | 'long' | 'iso' = 'short'): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    case 'long':
      return d.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    case 'iso':
      return d.toISOString();
    default:
      return d.toLocaleDateString('en-GB');
  }
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }
  
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return formatDate(d, 'short');
}

// File size formatting
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Duration formatting
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

// Number formatting
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// String formatting
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  return str
    .split(' ')
    .map(word => capitalise(word))
    .join(' ');
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Platform formatting
export function formatPlatform(platform: string): string {
  const platforms: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    meta: 'Meta'
  };
  
  return platforms[platform.toLowerCase()] || titleCase(platform);
}

// Asset type formatting
export function formatAssetType(type: string): string {
  const types: Record<string, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    text: 'Text',
    copy: 'Copy',
    graphic: 'Graphic'
  };
  
  return types[type.toLowerCase()] || titleCase(type);
}

// Status formatting
export function formatStatus(status: string): {
  label: string;
  colour: string;
} {
  const statuses: Record<string, { label: string; colour: string }> = {
    pending: { label: 'Pending', colour: 'yellow' },
    processing: { label: 'Processing', colour: 'blue' },
    completed: { label: 'Completed', colour: 'green' },
    failed: { label: 'Failed', colour: 'red' },
    approved: { label: 'Approved', colour: 'green' },
    rejected: { label: 'Rejected', colour: 'red' },
    draft: { label: 'Draft', colour: 'gray' }
  };
  
  return statuses[status.toLowerCase()] || { 
    label: titleCase(status), 
    colour: 'gray' 
  };
}

// Error message formatting
export function formatErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unexpected error occurred';
}

// Validation error formatting
export function formatValidationErrors(errors: Record<string, string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => `${titleCase(field)}: ${messages.join(', ')}`)
    .join('\n');
}