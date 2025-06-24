/**
 * API Response Types
 * Standardized response interfaces for all API endpoints
 */

// Base API Response
export interface BaseApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Authentication API Responses
export interface LoginResponse extends BaseApiResponse {
  user?: {
    id: string;,
    email: string;,
    name: string;,
    role: string;
  };
  session?: {
    access_token: string;,
    refresh_token: string;,
    expires_at: string;
  };
}

export interface SignupResponse extends BaseApiResponse {
  user?: {
    id: string;,
    email: string;,
    name: string;,
    role: string;
  };
}

export interface SessionResponse extends BaseApiResponse {
  authenticated: boolean;
  user?: {
    id: string;,
    email: string;,
    name: string;,
    role: string;
  };
}

// AI Generation API Responses
export interface AIGenerationResponse extends BaseApiResponse {
  data?: {
    id: string;,
    type: 'text' | 'image' | 'video' | 'voice';,
    content: string;
    metadata?: Record<string, unknown>;
    created_at: string;
  };
}

export interface GenerationsListResponse extends BaseApiResponse {
  data?: Array<{
    id: string;,
    type: string;,
    content: string;,
    created_at: string;,
    status: string;
  }>;
  pagination?: {
    page: number;,
    limit: number;,
    total: number;,
    totalPages: number;
  };
}

// Asset Management API Responses
export interface AssetUploadResponse extends BaseApiResponse {
  asset?: {
    id: string;,
    filename: string;,
    url: string;,
    type: string;,
    size: number;,
    created_at: string;
  };
}

export interface AssetsListResponse extends BaseApiResponse {
  assets?: Array<{
    id: string;,
    filename: string;,
    url: string;,
    type: string;,
    size: number;,
    created_at: string;
  }>;
  pagination?: {
    page: number;,
    limit: number;,
    total: number;
  };
}

// Campaign API Responses
export interface CampaignResponse extends BaseApiResponse {
  campaign?: {
    id: string;,
    name: string;,
    description: string;,
    status: string;,
    created_at: string;,
    updated_at: string;
  };
}

export interface CampaignsListResponse extends BaseApiResponse {
  campaigns?: Array<{
    id: string;,
    name: string;,
    description: string;,
    status: string;,
    created_at: string;
  }>;
}

// Analytics API Responses
export interface AnalyticsResponse extends BaseApiResponse {
  data?: {
    metrics: Array<{
    id: string;,
    label: string;,
    value: string | number;,
    change: number;,
    trend: 'up' | 'down' | 'stable';
    }>;
    charts?: Record<string, unknown>;
    timeRange: string;
  };
}

// Health Check Response
export interface HealthResponse extends BaseApiResponse {
  status: 'healthy' | 'unhealthy';,
    timestamp: string;
  services?: Record<string, 'up' | 'down'>;
}

// CSRF Token Response
export interface CSRFTokenResponse extends BaseApiResponse {
  csrfToken: string;
}

// Error Response
export interface ErrorResponse extends BaseApiResponse {
  success: false;,
    error: string;
  details?: Record<string, unknown>;
  code?: string;
}

// Request Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, unknown>;
}

// AI Generation Request
export interface AIGenerationRequest {
  prompt: string;,
    type: 'text' | 'image' | 'video' | 'voice';,
    clientId: string;
  parameters?: Record<string, unknown>;
}

// Asset Upload Request
export interface AssetUploadRequest {
  file: File;
  type?: string;
  metadata?: Record<string, unknown>;
}

// Campaign Request
export interface CampaignRequest {
  name: string;
  description?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

// Authentication Request
export interface LoginRequest {
  email: string;,
    password: string;
}

export interface SignupRequest {
  email: string;,
    password: string;,
    name: string;
}

// Type guards for API responses
export function isSuccessResponse(
  response: BaseApiResponse
): response is BaseApiResponse & { success: true } {
  return response.success === true;
}

export function isErrorResponse(response: BaseApiResponse): response is ErrorResponse {
  return response.success === false;
}

// API endpoint paths
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/signup',
  LOGOUT: '/api/auth/logout',
  SESSION: '/api/auth/session',
  CSRF_TOKEN: '/api/auth/csrf-token',

  // AI Generation
  AI_GENERATE: '/api/ai/generate',
  AI_GENERATIONS: '/api/ai/generations',

  // Assets
  ASSETS: '/api/assets',
  ASSET_UPLOAD: '/api/assets/upload',

  // Campaigns
  CAMPAIGNS: '/api/campaigns',

  // Analytics
  ANALYTICS_OVERVIEW: '/api/analytics/overview',
  ANALYTICS_PERFORMANCE: '/api/analytics/performance',

  // Health
  HEALTH: '/api/health' } as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];
