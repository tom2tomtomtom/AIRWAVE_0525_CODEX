import { NextApiRequest, NextApiResponse } from 'next';
import { loggers } from './logger';

// API Version configuration
export const API_VERSIONS = {
  v1: '1.0',
  v2: '2.0',
  latest: '2.0',
} as const;

export type ApiVersion = keyof typeof API_VERSIONS;

// Version deprecation dates
export const VERSION_DEPRECATION = {
  v1: new Date('2025-12-31'),
} as const;

// Version-specific changes
export const VERSION_CHANGES = {
  v2: [
    'Enhanced error response format',
    'New rate limiting headers',
    'Improved asset upload API',
    'Breaking: Changed campaign status enum values',
  ],
  v1: ['Initial API release'],
} as const;

// Extract version from request
export function getApiVersion(req: NextApiRequest): ApiVersion {
  // Check header first (preferred method)
  const headerVersion = req.headers['x-api-version'] || req.headers['api-version'];
  if (headerVersion && typeof headerVersion === 'string' && isValidVersion(headerVersion)) {
    return headerVersion as ApiVersion;
  }

  // Check URL path
  const pathMatch = req.url?.match(/\/api\/(v\d+)\//);
  if (pathMatch && pathMatch[1] && isValidVersion(pathMatch[1])) {
    return pathMatch[1] as ApiVersion;
  }

  // Check query parameter (least preferred)
  const queryVersion = req.query.api_version || req.query.version;
  if (queryVersion && typeof queryVersion === 'string' && isValidVersion(queryVersion)) {
    return queryVersion as ApiVersion;
  }

  // Default to latest
  return 'latest';
}

// Validate version
function isValidVersion(version: string): boolean {
  return Object.keys(API_VERSIONS).includes(version);
}

// Version middleware
export function withApiVersion<T = any>(
  handler: (
    req: NextApiRequest,
    res: NextApiResponse<T>,
    version: ApiVersion
  ) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse<T>) => {
    const version = getApiVersion(req);
    const versionNumber = API_VERSIONS[version];

    // Set version headers
    res.setHeader('X-API-Version', versionNumber);
    res.setHeader('X-API-Version-Key', version);

    // Check if version is deprecated
    const deprecationDate = VERSION_DEPRECATION[version as keyof typeof VERSION_DEPRECATION];
    if (deprecationDate) {
      const daysUntilDeprecation = Math.ceil(
        (deprecationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilDeprecation <= 0) {
        return res.status(410).json({
          success: false,
          error: 'API_VERSION_DEPRECATED',
          message: `API version ${version} has been deprecated. Please upgrade to the latest version.`,
          deprecatedOn: deprecationDate.toISOString(),
          latestVersion: API_VERSIONS.latest,
        } as any);
      }

      // Warn about upcoming deprecation
      if (daysUntilDeprecation <= 90) {
        res.setHeader(
          'X-API-Deprecation',
          `This API version will be deprecated on ${deprecationDate.toISOString()}`
        );
        res.setHeader('X-API-Deprecation-Days', daysUntilDeprecation.toString());
      }
    }

    // Log API version usage
    loggers.api.debug('API request', {
      version,
      versionNumber,
      method: req.method,
      path: req.url,
      deprecated: !!deprecationDate,
    });

    // Call the handler with version
    return handler(req, res, version);
  };
}

// Version-specific response transformer
export function transformResponse<T>(data: T, version: ApiVersion): T {
  // Apply version-specific transformations
  switch (version) {
    case 'v1':
      return transformV1Response(data);
    case 'v2':
    case 'latest':
      return transformV2Response(data);
    default:
      return data;
  }
}

// V1 response transformer
function transformV1Response<T>(data: T): T {
  // V1 specific transformations
  if (typeof data === 'object' && data !== null) {
    // Example: Convert new status values to old ones
    if ('status' in data) {
      const statusMap: Record<string, string> = {
        in_progress: 'active',
        scheduled: 'pending',
        cancelled: 'archived',
      };

      const status = (data as any).status;
      if (status && statusMap[status]) {
        return {
          ...data,
          status: statusMap[status],
        };
      }
    }
  }

  return data;
}

// V2 response transformer
function transformV2Response<T>(data: T): T {
  // V2 uses the current format, no transformation needed
  return data;
}

// Error response formatter
export function formatErrorResponse(
  error: string | Error,
  version: ApiVersion,
  code?: string,
  statusCode: number = 500
) {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorCode = code || 'INTERNAL_ERROR';

  switch (version) {
    case 'v1':
      return {
        success: false,
        error: errorMessage,
        code: errorCode,
      };

    case 'v2':
    case 'latest':
      return {
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
          timestamp: new Date().toISOString(),
          statusCode,
        },
      };

    default:
      return {
        success: false,
        error: errorMessage,
      };
  }
}

// Pagination helper
export function getPaginationParams(req: NextApiRequest, version: ApiVersion) {
  switch (version) {
    case 'v1':
      return {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
      };

    case 'v2':
    case 'latest':
      return {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
        cursor: req.query.cursor as string,
      };

    default:
      return {
        page: 1,
        limit: 20,
      };
  }
}

// Response metadata helper
export function addResponseMetadata<T>(
  data: T,
  version: ApiVersion,
  metadata?: Record<string, any>
): any {
  switch (version) {
    case 'v1':
      return {
        success: true,
        data,
        ...metadata,
      };

    case 'v2':
    case 'latest':
      return {
        success: true,
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          version: API_VERSIONS[version],
          ...metadata,
        },
      };

    default:
      return data;
  }
}

// Version-specific feature flags
export function isFeatureEnabled(feature: string, version: ApiVersion): boolean {
  const features: Record<string, ApiVersion[]> = {
    enhanced_filtering: ['v2', 'latest'],
    bulk_operations: ['v2', 'latest'],
    websocket_support: ['v2', 'latest'],
    ai_suggestions: ['v2', 'latest'],
    legacy_auth: ['v1'],
  };

  return features[feature]?.includes(version) || false;
}

export default {
  withApiVersion,
  getApiVersion,
  transformResponse,
  formatErrorResponse,
  getPaginationParams,
  addResponseMetadata,
  isFeatureEnabled,
};
