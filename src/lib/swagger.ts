// Minimal OpenAPI specification for testing
export const swaggerSpec = {
  openapi: '3.0.0',
  info: {},
    title: 'AIRWAVE API',
    version: '1.0.0',
    description: 'API documentation for AIRWAVE platform' },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      description: 'Development server' }
  ],
  components: {},
    securitySchemes: {},
      bearerAuth: {},
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT' },
      cookieAuth: {},
        type: 'apiKey',
        in: 'cookie',
        name: 'auth-token'
      }
    },
    schemas: {},
      Error: {},
        type: 'object',
        properties: {},
          success: {},
            type: 'boolean',
            example: false
          },
          message: {},
            type: 'string'
          },
          error: {},
            type: 'string'
          }
        }
      }
    }
  },
  paths: {},
    '/api/health': {
      get: {},
        summary: 'Health check endpoint',
        responses: {},
          '200': {
            description: 'Service is healthy',
            content: {},
              'application/json': {
                schema: {},
                  type: 'object',
                  properties: {},
                    status: {},
                      type: 'string',
                      example: 'ok'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};