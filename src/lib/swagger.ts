/**
 * Comprehensive OpenAPI specification for AIRWAVE platform
 * This specification documents all major API endpoints and data models
 */
export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'AIRWAVE API',
    version: '1.0.0',
    description: `
# AIRWAVE Platform API

The AIRWAVE API provides comprehensive video marketing workflow management capabilities.

## Features
- **AI-Powered Content Generation**: Generate motivations, copy, and images using OpenAI
- **Video Creation**: Automated video generation with Creatomate integration
- **Asset Management**: Upload, organize, and manage marketing assets
- **Campaign Workflows**: Complete campaign lifecycle management
- **Real-time Collaboration**: Live updates and collaborative features
- **Analytics & Monitoring**: Performance tracking and insights

## Authentication
All endpoints (except public health checks) require authentication via:
- **Bearer Token**: Include JWT token in Authorization header
- **Session Cookie**: Browser-based authentication for web clients

## Rate Limiting
API requests are rate-limited to ensure fair usage and system stability.

## Error Handling
All endpoints return structured error responses with consistent format.
    `,
    contact: {
      name: 'AIRWAVE Support',
      email: 'support@airwave.com'
    },
    license: {
      name: 'Private'
    }
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      description: 'Development server'
    },
    {
      url: 'https://app.airwave.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from login endpoint'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'auth-token',
        description: 'Session cookie for browser-based authentication'
      }
    },
    schemas: {
      // Common response schemas
      ApiResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful'
          },
          message: {
            type: 'string',
            description: 'Human-readable message about the operation'
          },
          data: {
            description: 'Response data (varies by endpoint)'
          }
        }
      },
      Error: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            description: 'Error message'
          },
          error: {
            type: 'string',
            description: 'Technical error details'
          },
          code: {
            type: 'string',
            description: 'Error code for programmatic handling'
          }
        }
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            example: 'Validation failed'
          },
          errors: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            description: 'Field-specific validation errors'
          }
        }
      },
      
      // Health check schemas
      HealthStatus: {
        type: 'object',
        required: ['status', 'timestamp', 'uptime', 'version', 'environment'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Overall system health status'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check execution time'
          },
          uptime: {
            type: 'number',
            description: 'System uptime in seconds'
          },
          version: {
            type: 'string',
            description: 'Application version'
          },
          environment: {
            type: 'string',
            enum: ['development', 'staging', 'production']
          },
          checks: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ServiceCheck'
            }
          },
          summary: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              healthy: { type: 'integer' },
              unhealthy: { type: 'integer' },
              degraded: { type: 'integer' }
            }
          }
        }
      },
      ServiceCheck: {
        type: 'object',
        required: ['service', 'status'],
        properties: {
          service: {
            type: 'string',
            description: 'Service name'
          },
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'degraded']
          },
          responseTime: {
            type: 'number',
            description: 'Response time in milliseconds'
          },
          error: {
            type: 'string',
            description: 'Error message if unhealthy'
          },
          details: {
            type: 'object',
            description: 'Additional service-specific details'
          }
        }
      },

      // User and Authentication schemas
      User: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique user identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          firstName: {
            type: 'string',
            description: 'User first name'
          },
          lastName: {
            type: 'string',
            description: 'User last name'
          },
          role: {
            type: 'string',
            enum: ['admin', 'manager', 'editor', 'viewer'],
            description: 'User role and permissions level'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      
      // Asset schemas
      Asset: {
        type: 'object',
        required: ['id', 'name', 'type', 'url'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          name: {
            type: 'string',
            description: 'Asset name'
          },
          type: {
            type: 'string',
            enum: ['image', 'video', 'text', 'voice'],
            description: 'Asset type'
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Asset URL'
          },
          thumbnailUrl: {
            type: 'string',
            format: 'uri',
            description: 'Thumbnail URL for media assets'
          },
          size: {
            type: 'integer',
            description: 'File size in bytes'
          },
          metadata: {
            type: 'object',
            description: 'Asset-specific metadata'
          },
          clientId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated client ID'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },

      // AI Generation schemas
      GenerationRequest: {
        type: 'object',
        required: ['prompt', 'type', 'clientId'],
        properties: {
          prompt: {
            type: 'string',
            description: 'Generation prompt'
          },
          type: {
            type: 'string',
            enum: ['text', 'image', 'video', 'voice'],
            description: 'Content type to generate'
          },
          clientId: {
            type: 'string',
            format: 'uuid',
            description: 'Client ID for the generation'
          },
          parameters: {
            type: 'object',
            description: 'Type-specific generation parameters'
          }
        }
      },
      GenerationResult: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Generation ID'
          },
          type: {
            type: 'string',
            enum: ['text', 'image', 'video', 'voice']
          },
          content: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ],
            description: 'Generated content or URLs'
          },
          prompt: {
            type: 'string',
            description: 'Original prompt'
          },
          dateCreated: {
            type: 'string',
            format: 'date-time'
          },
          clientId: {
            type: 'string',
            format: 'uuid'
          },
          userId: {
            type: 'string',
            format: 'uuid'
          }
        }
      }
    }
  },
  paths: {
    // Health endpoints
    '/api/health': {
      get: {
        summary: 'System health check',
        description: 'Comprehensive system health check including all services',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Health check results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthStatus'
                }
              }
            }
          },
          '503': {
            description: 'Service unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthStatus'
                }
              }
            }
          }
        }
      }
    },
    '/api/health/live': {
      get: {
        summary: 'Liveness probe',
        description: 'Basic liveness check for container orchestration',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'alive' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/health/ready': {
      get: {
        summary: 'Readiness probe',
        description: 'Readiness check for container orchestration',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service is ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ready' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'System',
      description: 'System health and monitoring endpoints'
    },
    {
      name: 'Authentication',
      description: 'User authentication and session management'
    },
    {
      name: 'Assets',
      description: 'Asset management and file operations'
    },
    {
      name: 'AI',
      description: 'AI-powered content generation'
    },
    {
      name: 'Campaigns',
      description: 'Marketing campaign management'
    },
    {
      name: 'Workflow',
      description: 'Workflow orchestration and execution'
    },
    {
      name: 'Analytics',
      description: 'Performance analytics and insights'
    }
  ]
};