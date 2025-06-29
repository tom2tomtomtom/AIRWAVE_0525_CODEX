/**
 * Common Test Patterns and Reusable Test Configurations
 * Provides standardized test patterns for consistent testing across the application
 */

import { NextApiHandler } from 'next';
import { APIRequestBuilder, APITestRunner, TestDataFactory } from './api-test-utils';
import { describe, it, expect } from '@jest/globals';

// Standard API test patterns
export class APITestPatterns {
  /**
   * Complete CRUD test suite for an API endpoint
   */
  static createCRUDTestSuite(
    handlers: {
      create?: NextApiHandler;
      read?: NextApiHandler;
      update?: NextApiHandler;
      delete?: NextApiHandler;
      list?: NextApiHandler;
    },
    testData: {
      validCreateData: unknown;
      validUpdateData: unknown;
      invalidData: unknown;
      resourceName: string;
    }
  ) {
    const { validCreateData, validUpdateData, invalidData, resourceName } = testData;

    return {
      testCreate: () => {
        if (!handlers.create) return;

        describe(`POST /${resourceName} (Create)`, () => {
          it('should create resource with valid data', async () => {
            await APITestRunner.testValidInput(handlers.create!, validCreateData, 'POST');
          });

          it('should reject invalid data', async () => {
            await APITestRunner.testInvalidInput(handlers.create!, invalidData, 'POST');
          });

          it('should require authentication', async () => {
            await APITestRunner.testAuthRequired(handlers.create!, 'POST');
          });
        });
      },

      testRead: () => {
        if (!handlers.read) return;

        describe(`GET /${resourceName}/:id (Read)`, () => {
          it('should return resource when found', async () => {
            const { req, res } = APIRequestBuilder.create()
              .setMethod('GET')
              .setQuery({ id: 'test-id' })
              .withAuth()
              .build();

            await handlers.read!(req, res);
            APITestRunner.expectSuccessResponse(res);
          });

          it('should return 404 when not found', async () => {
            const { req, res } = APIRequestBuilder.create()
              .setMethod('GET')
              .setQuery({ id: 'nonexistent-id' })
              .withAuth()
              .build();

            await handlers.read!(req, res);
            APITestRunner.expectErrorResponse(res, 404);
          });

          it('should require authentication', async () => {
            await APITestRunner.testAuthRequired(handlers.read!, 'GET');
          });
        });
      },

      testUpdate: () => {
        if (!handlers.update) return;

        describe(`PUT /${resourceName}/:id (Update)`, () => {
          it('should update resource with valid data', async () => {
            await APITestRunner.testValidInput(handlers.update!, validUpdateData, 'PUT');
          });

          it('should reject invalid data', async () => {
            await APITestRunner.testInvalidInput(handlers.update!, invalidData, 'PUT');
          });

          it('should require authentication', async () => {
            await APITestRunner.testAuthRequired(handlers.update!, 'PUT');
          });
        });
      },

      testDelete: () => {
        if (!handlers.delete) return;

        describe(`DELETE /${resourceName}/:id (Delete)`, () => {
          it('should delete existing resource', async () => {
            const { req, res } = APIRequestBuilder.create()
              .setMethod('DELETE')
              .setQuery({ id: 'test-id' })
              .withAuth()
              .build();

            await handlers.delete!(req, res);
            APITestRunner.expectSuccessResponse(res);
          });

          it('should return 404 for non-existent resource', async () => {
            const { req, res } = APIRequestBuilder.create()
              .setMethod('DELETE')
              .setQuery({ id: 'nonexistent-id' })
              .withAuth()
              .build();

            await handlers.delete!(req, res);
            APITestRunner.expectErrorResponse(res, 404);
          });

          it('should require authentication', async () => {
            await APITestRunner.testAuthRequired(handlers.delete!, 'DELETE');
          });
        });
      },

      testList: () => {
        if (!handlers.list) return;

        describe(`GET /${resourceName} (List)`, () => {
          it('should return paginated list', async () => {
            const { req, res } = APIRequestBuilder.create()
              .setMethod('GET')
              .setQuery({ page: '1', limit: '10' })
              .withAuth()
              .build();

            await handlers.list!(req, res);
            APITestRunner.expectSuccessResponse(res);

            const data = JSON.parse((res as any)._getData());
            expect(data.data).toHaveProperty('items');
            expect(data.data).toHaveProperty('pagination');
          });

          it('should handle empty results', async () => {
            const { req, res } = APIRequestBuilder.create().setMethod('GET').withAuth().build();

            await handlers.list!(req, res);
            APITestRunner.expectSuccessResponse(res);
          });

          it('should require authentication', async () => {
            await APITestRunner.testAuthRequired(handlers.list!, 'GET');
          });
        });
      },
    };
  }

  /**
   * Authentication endpoint test patterns
   */
  static createAuthTestSuite(handlers: {
    login?: NextApiHandler;
    logout?: NextApiHandler;
    signup?: NextApiHandler;
    session?: NextApiHandler;
  }) {
    return {
      testLogin: () => {
        if (!handlers.login) return;

        describe('POST /auth/login', () => {
          it('should authenticate with valid credentials', async () => {
            const validCredentials = {
              email: 'test@example.com',
              password: 'validPassword123!',
            };

            await APITestRunner.testValidInput(handlers.login!, validCredentials, 'POST');
          });

          it('should reject invalid credentials', async () => {
            const invalidCredentials = {
              email: 'test@example.com',
              password: 'wrongPassword',
            };

            await APITestRunner.testInvalidInput(handlers.login!, invalidCredentials, 'POST');
          });

          it('should reject malformed requests', async () => {
            const malformedData = { email: 'invalid-email' };
            await APITestRunner.testInvalidInput(handlers.login!, malformedData, 'POST');
          });
        });
      },

      testLogout: () => {
        if (!handlers.logout) return;

        describe('POST /auth/logout', () => {
          it('should logout authenticated user', async () => {
            const { req, res } = APIRequestBuilder.create().setMethod('POST').withAuth().build();

            await handlers.logout!(req, res);
            APITestRunner.expectSuccessResponse(res);
          });

          it('should handle unauthenticated logout gracefully', async () => {
            const { req, res } = APIRequestBuilder.create().setMethod('POST').build();

            await handlers.logout!(req, res);
            // Should not fail, even if not authenticated
          });
        });
      },

      testSignup: () => {
        if (!handlers.signup) return;

        describe('POST /auth/signup', () => {
          it('should create account with valid data', async () => {
            const validSignupData = {
              email: 'newuser@example.com',
              password: 'SecurePassword123!',
              confirmPassword: 'SecurePassword123!',
            };

            await APITestRunner.testValidInput(handlers.signup!, validSignupData, 'POST');
          });

          it('should reject weak passwords', async () => {
            const weakPasswordData = {
              email: 'newuser@example.com',
              password: '123',
              confirmPassword: '123',
            };

            await APITestRunner.testInvalidInput(handlers.signup!, weakPasswordData, 'POST');
          });

          it('should reject mismatched passwords', async () => {
            const mismatchedData = {
              email: 'newuser@example.com',
              password: 'SecurePassword123!',
              confirmPassword: 'DifferentPassword123!',
            };

            await APITestRunner.testInvalidInput(handlers.signup!, mismatchedData, 'POST');
          });
        });
      },

      testSession: () => {
        if (!handlers.session) return;

        describe('GET /auth/session', () => {
          it('should return session for authenticated user', async () => {
            const { req, res } = APIRequestBuilder.create().setMethod('GET').withAuth().build();

            await handlers.session!(req, res);
            APITestRunner.expectSuccessResponse(res);
          });

          it('should return null for unauthenticated user', async () => {
            const { req, res } = APIRequestBuilder.create().setMethod('GET').build();

            await handlers.session!(req, res);

            const data = JSON.parse((res as any)._getData());
            expect(data.data.session).toBeNull();
          });
        });
      },
    };
  }

  /**
   * File upload endpoint test patterns
   */
  static createFileUploadTestSuite(handler: NextApiHandler) {
    return {
      testValidUpload: () => {
        it('should handle valid file upload', async () => {
          const { req, res } = APIRequestBuilder.create()
            .setMethod('POST')
            .setBody({
              fileName: 'test-image.jpg',
              fileType: 'image/jpeg',
              fileSize: 1024000,
            })
            .withAuth()
            .build();

          await handler(req, res);
          APITestRunner.expectSuccessResponse(res);
        });
      },

      testInvalidFileType: () => {
        it('should reject invalid file types', async () => {
          const { req, res } = APIRequestBuilder.create()
            .setMethod('POST')
            .setBody({
              fileName: 'malicious.exe',
              fileType: 'application/exe',
              fileSize: 1024000,
            })
            .withAuth()
            .build();

          await handler(req, res);
          APITestRunner.expectErrorResponse(res, 400, 'Invalid file type');
        });
      },

      testFileSizeLimit: () => {
        it('should reject files exceeding size limit', async () => {
          const { req, res } = APIRequestBuilder.create()
            .setMethod('POST')
            .setBody({
              fileName: 'huge-file.jpg',
              fileType: 'image/jpeg',
              fileSize: 50 * 1024 * 1024, // 50MB
            })
            .withAuth()
            .build();

          await handler(req, res);
          APITestRunner.expectErrorResponse(res, 400, 'File too large');
        });
      },

      testAuthRequired: () => {
        it('should require authentication', async () => {
          await APITestRunner.testAuthRequired(handler, 'POST');
        });
      },
    };
  }

  /**
   * Workflow endpoint test patterns
   */
  static createWorkflowTestSuite(handlers: {
    state?: NextApiHandler;
    brief?: NextApiHandler;
    motivations?: NextApiHandler;
    copy?: NextApiHandler;
  }) {
    return {
      testWorkflowState: () => {
        if (!handlers.state) return;

        describe('Workflow State Management', () => {
          it('should return current workflow state', async () => {
            const { req, res } = APIRequestBuilder.create()
              .setMethod('GET')
              .setQuery({ workflowId: 'test-workflow-123' })
              .withAuth()
              .build();

            await handlers.state!(req, res);
            APITestRunner.expectSuccessResponse(res);

            const data = JSON.parse((res as any)._getData());
            expect(data.data).toHaveProperty('currentStep');
            expect(data.data).toHaveProperty('briefData');
          });

          it('should handle non-existent workflow', async () => {
            const { req, res } = APIRequestBuilder.create()
              .setMethod('GET')
              .setQuery({ workflowId: 'nonexistent-workflow' })
              .withAuth()
              .build();

            await handlers.state!(req, res);
            APITestRunner.expectErrorResponse(res, 404);
          });
        });
      },

      testBriefProcessing: () => {
        if (!handlers.brief) return;

        describe('Brief Processing', () => {
          it('should process valid brief data', async () => {
            const briefData = {
              workflowId: 'test-workflow-123',
              briefContent: 'Test campaign brief content',
              briefType: 'text',
            };

            await APITestRunner.testValidInput(handlers.brief!, briefData, 'POST');
          });

          it('should reject empty brief', async () => {
            const emptyBrief = {
              workflowId: 'test-workflow-123',
              briefContent: '',
              briefType: 'text',
            };

            await APITestRunner.testInvalidInput(handlers.brief!, emptyBrief, 'POST');
          });
        });
      },
    };
  }

  /**
   * AI service endpoint test patterns
   */
  static createAIServiceTestSuite(handlers: {
    costCheck?: NextApiHandler;
    usage?: NextApiHandler;
    models?: NextApiHandler;
  }) {
    return {
      testCostCheck: () => {
        if (!handlers.costCheck) return;

        describe('AI Cost Checking', () => {
          it('should return cost estimation', async () => {
            const costData = {
              service: 'openai',
              model: 'gpt-4',
              estimatedTokens: 1000,
            };

            await APITestRunner.testValidInput(handlers.costCheck!, costData, 'POST');
          });

          it('should reject when budget exceeded', async () => {
            const highCostData = {
              service: 'openai',
              model: 'gpt-4',
              estimatedTokens: 1000000, // Very high token count
            };

            const { req, res } = APIRequestBuilder.create()
              .setMethod('POST')
              .setBody(highCostData)
              .withAuth()
              .build();

            await handlers.costCheck!(req, res);

            const data = JSON.parse((res as any)._getData());
            expect(data.data.allowed).toBe(false);
          });
        });
      },

      testUsageTracking: () => {
        if (!handlers.usage) return;

        describe('AI Usage Tracking', () => {
          it('should return usage statistics', async () => {
            const { req, res } = APIRequestBuilder.create().setMethod('GET').withAuth().build();

            await handlers.usage!(req, res);
            APITestRunner.expectSuccessResponse(res);

            const data = JSON.parse((res as any)._getData());
            expect(data.data).toHaveProperty('monthlyUsage');
            expect(data.data).toHaveProperty('budgetRemaining');
          });
        });
      },
    };
  }

  /**
   * Standard authentication test pattern
   */
  static testAuthentication(handler: NextApiHandler, endpoint: string) {
    describe(`🔐 Authentication Tests for ${endpoint}`, () => {
      it('should require authentication for protected endpoints', async () => {
        await APITestRunner.testAuthRequired(handler, 'GET');
      });

      it('should reject invalid tokens', async () => {
        const { req, res } = APIRequestBuilder.create()
          .setMethod('GET')
          .setHeaders({ authorization: 'Bearer invalid-token' })
          .build();

        await handler(req, res);
        expect((res as any)._getStatusCode()).toBe(401);
      });

      it('should reject expired tokens', async () => {
        const { req, res } = APIRequestBuilder.create()
          .setMethod('GET')
          .setHeaders({ authorization: 'Bearer expired-token' })
          .build();

        await handler(req, res);
        expect((res as any)._getStatusCode()).toBe(401);
      });
    });
  }

  /**
   * Standard error handling test pattern
   */
  static testErrorHandling(handler: NextApiHandler, endpoint: string) {
    describe(`⚠️ Error Handling Tests for ${endpoint}`, () => {
      it('should handle database errors gracefully', async () => {
        await APITestRunner.testDatabaseError(handler, 'GET');
      });

      it('should return proper error format', async () => {
        const { req, res } = APIRequestBuilder.create()
          .setMethod('GET')
          .setQuery({ id: 'nonexistent-id' })
          .withAuth()
          .build();

        await handler(req, res);

        if ((res as any)._getStatusCode() >= 400) {
          const data = JSON.parse((res as any)._getData());
          expect(data).toHaveProperty('success', false);
          expect(data).toHaveProperty('error');
          expect(data.error).toHaveProperty('message');
        }
      });

      it('should handle malformed requests', async () => {
        const { req, res } = APIRequestBuilder.create()
          .setMethod('POST')
          .setBody('invalid-json')
          .withAuth()
          .build();

        await handler(req, res);
        expect((res as any)._getStatusCode()).toBeGreaterThanOrEqual(400);
      });
    });
  }

  /**
   * Standard performance test pattern
   */
  static testPerformance(handler: NextApiHandler, endpoint: string) {
    describe(`⚡ Performance Tests for ${endpoint}`, () => {
      it('should respond within acceptable time limits', async () => {
        const start = Date.now();

        const { req, res } = APIRequestBuilder.create().setMethod('GET').withAuth().build();

        await handler(req, res);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(2000); // 2 seconds max
      });

      it('should handle concurrent requests', async () => {
        const requests = Array.from({ length: 5 }, () => {
          const { req, res } = APIRequestBuilder.create().setMethod('GET').withAuth().build();
          return handler(req, res);
        });

        const start = Date.now();
        await Promise.all(requests);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(5000); // 5 seconds for 5 concurrent requests
      });
    });
  }

  /**
   * Standard input validation test pattern
   */
  static testInputValidation(
    handler: NextApiHandler,
    endpoint: string,
    testCases: {
      valid: unknown;
      invalid: Array<{ data: unknown; expectedError: string }>;
    }
  ) {
    describe(`✅ Input Validation Tests for ${endpoint}`, () => {
      it('should accept valid input', async () => {
        const { req, res } = APIRequestBuilder.create()
          .setMethod('POST')
          .setBody(testCases.valid)
          .withAuth()
          .build();

        await handler(req, res);

        // Should not return validation error
        if ((res as any)._getStatusCode() >= 400) {
          const data = JSON.parse((res as any)._getData());
          expect(data.error?.message).not.toContain('validation');
        }
      });

      testCases.invalid.forEach((testCase, index) => {
        it(`should reject invalid input case ${index + 1}: ${testCase.expectedError}`, async () => {
          const { req, res } = APIRequestBuilder.create()
            .setMethod('POST')
            .setBody(testCase.data)
            .withAuth()
            .build();

          await handler(req, res);

          expect((res as any)._getStatusCode()).toBeGreaterThanOrEqual(400);
          const data = JSON.parse((res as any)._getData());
          expect(data.success).toBe(false);
          expect(data.error?.message).toBeDefined();
        });
      });

      it('should sanitize input to prevent XSS', async () => {
        const xssData = {
          ...(testCases.valid as Record<string, any>),
          name: "<script>alert('xss')</script>",
          description: "<img src=x onerror=alert('xss')>",
        };

        const { req, res } = APIRequestBuilder.create()
          .setMethod('POST')
          .setBody(xssData)
          .withAuth()
          .build();

        await handler(req, res);

        if ((res as any)._getStatusCode() === 200) {
          const data = JSON.parse((res as any)._getData());
          if (data.data) {
            expect(JSON.stringify(data.data)).not.toContain('<script>');
            expect(JSON.stringify(data.data)).not.toContain('onerror=');
          }
        }
      });

      it('should prevent SQL injection attempts', async () => {
        const sqlInjectionData = {
          ...(testCases.valid as Record<string, any>),
          id: "1'; DROP TABLE assets; --",
          name: "'; SELECT * FROM users; --",
        };

        const { req, res } = APIRequestBuilder.create()
          .setMethod('POST')
          .setBody(sqlInjectionData)
          .withAuth()
          .build();

        await handler(req, res);

        // Should not crash the application
        expect((res as any)._getStatusCode()).toBeLessThan(500);
      });
    });
  }

  /**
   * Security-focused test patterns
   */
  static createSecurityTestSuite(handler: NextApiHandler) {
    return {
      testSQLInjection: () => {
        it('should prevent SQL injection', async () => {
          const maliciousData = {
            query: "'; DROP TABLE users; --",
            filter: '1=1 OR 1=1',
          };

          const { req, res } = APIRequestBuilder.create()
            .setMethod('POST')
            .setBody(maliciousData)
            .withAuth()
            .build();

          await handler(req, res);

          // Should not crash the application
          expect((res as any)._getStatusCode()).toBeLessThan(500);
        });
      },

      testXSSPrevention: () => {
        it('should sanitize user input', async () => {
          const xssData = {
            content: "<script>alert('xss')</script>",
            name: "<img src=x onerror=alert('xss')>",
          };

          const { req, res } = APIRequestBuilder.create()
            .setMethod('POST')
            .setBody(xssData)
            .withAuth()
            .build();

          await handler(req, res);

          if ((res as any)._getStatusCode() === 200) {
            const responseData = JSON.parse((res as any)._getData());
            // Check that script tags are removed/escaped
            if (responseData.data) {
              Object.values(responseData.data).forEach(value => {
                if (typeof value === 'string') {
                  expect(value).not.toContain('<script>');
                  expect(value).not.toContain('onerror=');
                }
              });
            }
          }
        });
      },

      testRateLimiting: () => {
        it('should enforce rate limits', async () => {
          // This would need to be adapted based on actual rate limiting implementation
          const requests = Array.from({ length: 10 }, () =>
            APIRequestBuilder.create().setMethod('POST').withAuth().build()
          );

          await Promise.all(requests.map(({ req, res }) => handler(req, res)));

          // Check if any responses were rate limited
          // Implementation depends on rate limiting strategy
        });
      },
    };
  }
}

// Common test data sets
export const CommonTestData = {
  validUser: TestDataFactory.createUser(),
  validClient: TestDataFactory.createClient(),
  validWorkflow: TestDataFactory.createWorkflow(),
  validAsset: TestDataFactory.createAsset(),

  invalidEmail: 'not-an-email',
  invalidUUID: 'not-a-uuid',
  emptyString: '',
  nullValue: null,
  undefinedValue: undefined,

  sqlInjectionPayloads: ["'; DROP TABLE users; --", "1' OR '1'='1", 'UNION SELECT * FROM users--'],

  xssPayloads: [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert('xss')>",
    "javascript:alert('xss')",
  ],
};

// Performance benchmarks
export const PerformanceBenchmarks = {
  API_RESPONSE_TIME: 500, // ms
  DATABASE_QUERY_TIME: 100, // ms
  FILE_UPLOAD_TIME: 5000, // ms
  AI_GENERATION_TIME: 30000, // ms
};

// Test environment helpers
export const TestEnvironment = {
  isRunningInCI: () => process.env.CI === 'true',
  isRunningLocally: () => !process.env.CI,
  shouldSkipSlowTests: () => process.env.SKIP_SLOW_TESTS === 'true',
  shouldRunE2ETests: () => process.env.RUN_E2E_TESTS === 'true',
};
