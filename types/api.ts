// types/api.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Request handler types
export type ApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void>;

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Common parameter types
export interface IdParams {
  id: string;
}

export interface ClientParams {
  clientId: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Form data types
export interface FormFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  path?: string;
}

// Error handling types
export type ErrorWithMessage = {
  message: string;
  code?: string;
  statusCode?: number;
}

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

// Supabase types
export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// Session types
export interface UserSession {
  id: string;
  email: string;
  role: string;
  clientId?: string;
  createdAt: Date;
  expiresAt: Date;
}

// Webhook types
export interface WebhookPayload {
  event: string;
  data: Record<string, any>;
  timestamp: string;
  signature?: string;
}

// Asset types
export interface AssetUploadParams {
  file: FormFile;
  clientId: string;
  type: 'image' | 'video' | 'audio' | 'text';
  tags?: string[];
  metadata?: Record<string, any>;
}

// Matrix types
export interface MatrixCell {
  assetId?: string;
  locked: boolean;
  type: string;
}

export interface MatrixRow {
  id: string;
  cells: MatrixCell[];
  locked: boolean;
}

// Render types
export interface RenderJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  output?: string;
  error?: string;
}