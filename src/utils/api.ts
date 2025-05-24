// API utility functions for making requests to the backend
import type { NextApiResponse } from 'next';

// Error codes enum
export enum ErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
}

// Error response helper
export const errorResponse = (
  res: NextApiResponse,
  code: ErrorCode,
  message: string,
  statusCode: number = 400
) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};

// Get the authentication token from localStorage
const getAuthToken = (): string | null => {
  try {
    const user = localStorage.getItem('airwave_user');
    if (!user) return null;

    const userData = JSON.parse(user);
    return userData.token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Base API request function with authentication
export const apiRequest = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  try {
    const token = getAuthToken();

    // Set default headers
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Parse the response
    const data = await response.json();

    // Handle error responses
    if (!response.ok) {
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }

    return data as T;
  } catch (error) {
    console.error(`API request error for ${url}:`, error);
    throw error;
  }
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    return apiRequest<{
      success: boolean;
      user: {
        id: string;
        email: string;
        name: string;
        token: string;
      };
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  signup: async (email: string, password: string, name: string) => {
    return apiRequest<{
      success: boolean;
      user: {
        id: string;
        email: string;
        name: string;
        token: string;
      };
    }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },
};

// Client API
export interface Client {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  userId: string;
}

export const clientApi = {
  getClients: async () => {
    return apiRequest<{
      success: boolean;
      clients: Client[];
    }>('/api/clients');
  },

  createClient: async (clientData: Omit<Client, 'id' | 'userId'>) => {
    return apiRequest<{
      success: boolean;
      client: Client;
    }>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  },

  updateClient: async (id: string, clientData: Partial<Omit<Client, 'id' | 'userId'>>) => {
    return apiRequest<{
      success: boolean;
      client: Client;
    }>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    });
  },

  deleteClient: async (id: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
      client: Client;
    }>(`/api/clients/${id}`, {
      method: 'DELETE',
    });
  },
};

// Assets API
export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'voice';
  url: string;
  thumbnailUrl?: string;
  description?: string;
  tags: string[];
  dateCreated: string;
  clientId: string;
  userId: string;
}

export const assetApi = {
  getAssets: async (clientId?: string) => {
    const url = clientId ? `/api/assets?clientId=${clientId}` : '/api/assets';
    return apiRequest<{
      success: boolean;
      assets: Asset[];
    }>(url);
  },

  createAsset: async (assetData: Omit<Asset, 'id' | 'dateCreated' | 'userId'>) => {
    return apiRequest<{
      success: boolean;
      asset: Asset;
    }>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(assetData),
    });
  },

  updateAsset: async (id: string, assetData: Partial<Omit<Asset, 'id' | 'userId'>>) => {
    return apiRequest<{
      success: boolean;
      asset: Asset;
    }>(`/api/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assetData),
    });
  },

  deleteAsset: async (id: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
    }>(`/api/assets/${id}`, {
      method: 'DELETE',
    });
  },
};

// AI Generation API
export interface GenerationPrompt {
  prompt: string;
  type: 'text' | 'image' | 'video' | 'voice';
  parameters?: Record<string, unknown>;
  clientId: string;
}

export interface GenerationResult {
  id: string;
  type: 'text' | 'image' | 'video' | 'voice';
  content: string | string[]; // URL for media, text content for text
  prompt: string;
  dateCreated: string;
  clientId: string;
  userId: string;
}

export const aiApi = {
  generate: async (promptData: GenerationPrompt) => {
    return apiRequest<{
      success: boolean;
      result: GenerationResult;
    }>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(promptData),
    });
  },

  getGenerations: async (clientId?: string) => {
    const url = clientId ? `/api/ai/generations?clientId=${clientId}` : '/api/ai/generations';
    return apiRequest<{
      success: boolean;
      generations: GenerationResult[];
    }>(url);
  },
};

const api = {
  auth: authApi,
  client: clientApi,
  asset: assetApi,
  ai: aiApi,
};

export default api;
