import {
  validationSchemas,
  sanitizeSQLString,
  sanitizeObject,
  fileValidation,
  apiValidationSchemas,
  securityValidation} from '../validation-utils';

describe('Validation Utils', () => {
  describe('validationSchemas', () => {
    it('should validate UUIDs correctly', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'invalid-uuid';

      expect(() => validationSchemas.uuid.parse(validUUID)).not.toThrow();
      expect(() => validationSchemas.uuid.parse(invalidUUID)).toThrow();
    });

    it('should validate emails correctly', () => {
      const validEmail = 'test@example.com';
      const invalidEmail = 'invalid-email';

      expect(() => validationSchemas.email.parse(validEmail)).not.toThrow();
      expect(() => validationSchemas.email.parse(invalidEmail)).toThrow();
    });

    it('should enforce password requirements', () => {
      const validPassword = 'Test-password-123!'; // Test password
      const weakPassword = 'weak';
      const noUppercase = 'test-password-123!'; // Test password - no uppercase
      const noLowercase = 'TEST-PASSWORD-123!'; // Test password - no lowercase  
      const noNumber = 'Test-password-abc!'; // Test password - no number
      const noSpecial = 'Test-password-123'; // Test password - no special char

      expect(() => validationSchemas.password.parse(validPassword)).not.toThrow();
      expect(() => validationSchemas.password.parse(weakPassword)).toThrow();
      expect(() => validationSchemas.password.parse(noUppercase)).toThrow();
      expect(() => validationSchemas.password.parse(noLowercase)).toThrow();
      expect(() => validationSchemas.password.parse(noNumber)).toThrow();
      expect(() => validationSchemas.password.parse(noSpecial)).toThrow();
    });

    it('should sanitize safe strings', () => {
      const validString = 'Hello World';
      const stringWithHTML = '<script>alert("xss")</script>';
      const stringWithSpecialChars = 'hello"world';

      expect(() => validationSchemas.safeString.parse(validString)).not.toThrow();
      expect(() => validationSchemas.safeString.parse(stringWithHTML)).toThrow();
      expect(() => validationSchemas.safeString.parse(stringWithSpecialChars)).toThrow();
    });

    it('should validate URLs correctly', () => {
      const validURL = 'https://example.com';
      const validHTTP = 'http://example.com';
      const invalidURL = 'ftp://example.com';
      const noProtocol = 'example.com';

      expect(() => validationSchemas.url.parse(validURL)).not.toThrow();
      expect(() => validationSchemas.url.parse(validHTTP)).not.toThrow();
      expect(() => validationSchemas.url.parse(invalidURL)).toThrow();
      expect(() => validationSchemas.url.parse(noProtocol)).toThrow();
    });

    it('should prevent directory traversal in file paths', () => {
      const validPath = 'uploads/image.jpg';
      const traversalPath = '../../../etc/passwd';
      const homePath = '~/secrets.txt';

      expect(() => validationSchemas.filePath.parse(validPath)).not.toThrow();
      expect(() => validationSchemas.filePath.parse(traversalPath)).toThrow();
      expect(() => validationSchemas.filePath.parse(homePath)).toThrow();
    });

    it('should validate pagination parameters', () => {
      const validPagination = { page: 1, limit: 20 };
      const invalidPage = { page: 0, limit: 20 };
      const invalidLimit = { page: 1, limit: 200 };

      expect(() => validationSchemas.pagination.parse(validPagination)).not.toThrow();
      expect(() => validationSchemas.pagination.parse(invalidPage)).toThrow();
      expect(() => validationSchemas.pagination.parse(invalidLimit)).toThrow();
    });

    it('should validate date ranges', () => {
      const validRange = {
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-12-31T23:59:59Z'};
      const invalidRange = {
        startDate: '2023-12-31T23:59:59Z',
        endDate: '2023-01-01T00:00:00Z'};

      expect(() => validationSchemas.dateRange.parse(validRange)).not.toThrow();
      expect(() => validationSchemas.dateRange.parse(invalidRange)).toThrow();
    });
  });

  describe('sanitizeSQLString', () => {
    it('should remove SQL injection patterns', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const result = sanitizeSQLString(maliciousInput);
      
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
      expect(result).not.toContain('--');
      expect(result).not.toContain('DROP');
    });

    it('should remove SQL keywords', () => {
      const input = 'SELECT * FROM users UNION SELECT password FROM admin';
      const result = sanitizeSQLString(input);
      
      expect(result.toLowerCase()).not.toContain('select');
      expect(result.toLowerCase()).not.toContain('union');
    });

    it('should preserve safe content', () => {
      const safeInput = 'Hello World 123';
      const result = sanitizeSQLString(safeInput);
      
      expect(result).toBe('Hello World 123');
    });
  });

  describe('sanitizeObject', () => {
    it('should remove dangerous prototype properties', () => {
      const dangerousObject = {
        name: 'test',
        normalProperty: 'value'};
      
      // Manually add dangerous properties to test sanitization
      (dangerousObject as Record<string, unknown>)['__proto__'] = { isAdmin: true };
      (dangerousObject as Record<string, unknown>)['constructor'] = { prototype: { isAdmin: true } };

      const result = sanitizeObject(dangerousObject);

      expect(result).toHaveProperty('name', 'test');
      expect(result).toHaveProperty('normalProperty', 'value');
      
      // Check that dangerous keys are not in the result
      expect(Object.keys(result)).not.toContain('__proto__');
      expect(Object.keys(result)).not.toContain('constructor');
    });

    it('should recursively sanitize nested objects', () => {
      const nestedObject = {
        user: {
          name: 'test',
          profile: {
            age: 25
          }
        }
      };
      
      // Add dangerous properties to nested objects
      (nestedObject.user as Record<string, unknown>)['__proto__'] = { isAdmin: true };
      (nestedObject.user.profile as Record<string, unknown>)['constructor'] = { dangerous: true };

      const result = sanitizeObject(nestedObject);

      expect(result.user).toHaveProperty('name', 'test');
      expect(result.user.profile).toHaveProperty('age', 25);
      
      // Check that dangerous keys are not in the results
      expect(Object.keys(result.user)).not.toContain('__proto__');
      expect(Object.keys(result.user.profile)).not.toContain('constructor');
    });
  });

  describe('fileValidation', () => {
    it('should validate allowed file types', () => {
      const imageFile = {
        type: 'image/jpeg',
        size: 1024 * 1024, // 1MB
        name: 'test.jpg'};

      expect(() => fileValidation.validate(imageFile, 'image')).not.toThrow();
    });

    it('should reject disallowed file types', () => {
      const executableFile = {
        type: 'application/x-executable',
        size: 1024,
        name: 'malware.exe'};

      expect(() => fileValidation.validate(executableFile, 'image')).toThrow();
    });

    it('should reject oversized files', () => {
      const largeFile = {
        type: 'image/jpeg',
        size: 20 * 1024 * 1024, // 20MB (over 10MB limit)
        name: 'huge.jpg'};

      expect(() => fileValidation.validate(largeFile, 'image')).toThrow();
    });

    it('should validate file extension matches MIME type', () => {
      const mismatchedFile = {
        type: 'image/jpeg',
        size: 1024,
        name: 'test.png', // PNG extension with JPEG MIME type
      };

      expect(() => fileValidation.validate(mismatchedFile, 'image')).toThrow();
    });

    it('should allow files with correct extension and MIME type', () => {
      const correctFile = {
        type: 'image/png',
        size: 1024,
        name: 'test.png'};

      expect(() => fileValidation.validate(correctFile, 'image')).not.toThrow();
    });
  });

  describe('apiValidationSchemas', () => {
    it('should validate login schema', () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'password123'};
      const invalidLogin = {
        email: 'invalid-email',
        password: ''};

      expect(() => apiValidationSchemas.login.parse(validLogin)).not.toThrow();
      expect(() => apiValidationSchemas.login.parse(invalidLogin)).toThrow();
    });

    it('should validate signup schema', () => {
      const validSignup = {
        email: 'test@example.com',
        password: 'Test-password-123!', // Test password
        name: 'John Doe'};
      const invalidSignup = {
        email: 'invalid-email',
        password: 'weak',
        name: 'J'};

      expect(() => apiValidationSchemas.signup.parse(validSignup)).not.toThrow();
      expect(() => apiValidationSchemas.signup.parse(invalidSignup)).toThrow();
    });

    it('should validate createClient schema', () => {
      const validClient = {
        name: 'Test Client',
        description: 'A test client description',
        brandColor: '#FF5733',
        secondaryColor: '#33C3FF'};
      const invalidClient = {
        name: 'T', // Too short
        brandColor: 'invalid-color',
        secondaryColor: '#ZZZZZZ', // Invalid hex
      };

      expect(() => apiValidationSchemas.createClient.parse(validClient)).not.toThrow();
      expect(() => apiValidationSchemas.createClient.parse(invalidClient)).toThrow();
    });

    it('should validate uploadAsset schema', () => {
      const validAsset = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'image' as const,
        tags: ['logo', 'brand']};
      const invalidAsset = {
        clientId: 'invalid-uuid',
        category: 'invalid-category'};

      expect(() => apiValidationSchemas.uploadAsset.parse(validAsset)).not.toThrow();
      expect(() => apiValidationSchemas.uploadAsset.parse(invalidAsset)).toThrow();
    });

    it('should validate createBrief schema', () => {
      const validBrief = {
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Marketing Brief',
        content: 'Brief content here',
        objectives: ['Increase brand awareness'],
        targetAudience: 'Young adults 18-35'};
      const invalidBrief = {
        clientId: 'invalid-uuid',
        title: 'AB', // Too short
        content: ''};

      expect(() => apiValidationSchemas.createBrief.parse(validBrief)).not.toThrow();
      expect(() => apiValidationSchemas.createBrief.parse(invalidBrief)).toThrow();
    });
  });

  describe('securityValidation', () => {
    describe('XSS detection', () => {
      it('should detect XSS patterns', () => {
        const xssPatterns = [
          '<script>alert("xss")</script>',
          'javascript:alert("xss")',
          'onmouseover="alert(1)"',
          '<img src="x" onerror="alert(1)">',
          '<iframe src="javascript:alert(1)"></iframe>',
          'vbscript:msgbox(1)',
          'data:text/html,<script>alert(1)</script>',
        ];

        xssPatterns.forEach(pattern => {
          expect(securityValidation.containsXSS(pattern)).toBe(true);
        });
      });

      it('should not flag safe content as XSS', () => {
        const safePatterns = [
          'Hello world',
          'This is a normal string',
          'Email: user@example.com',
          'Price: $19.99',
        ];

        safePatterns.forEach(pattern => {
          expect(securityValidation.containsXSS(pattern)).toBe(false);
        });
      });
    });

    describe('SQL injection detection', () => {
      it('should detect SQL injection patterns', () => {
        const sqlPatterns = [
          "'; DROP TABLE users; --",
          "1' OR '1'='1",
          "1; DELETE FROM users WHERE 1=1; --",
          "UNION SELECT password FROM admin",
          "INSERT INTO users VALUES ('hacker', 'password')",
          "' AND 1=1 --",
          "admin'--",
          "' UNION SELECT NULL,NULL,NULL--",
        ];

        sqlPatterns.forEach(pattern => {
          expect(securityValidation.containsSQLInjection(pattern)).toBe(true);
        });
      });

      it('should not flag safe content as SQL injection', () => {
        const safePatterns = [
          'Hello world',
          'My password is secure',
          'User name: admin',
          'Search query: hello',
        ];

        safePatterns.forEach(pattern => {
          expect(securityValidation.containsSQLInjection(pattern)).toBe(false);
        });
      });
    });

    describe('Path traversal detection', () => {
      it('should detect path traversal patterns', () => {
        const pathPatterns = [
          '../../../etc/passwd',
          '..\\..\\windows\\system32',
          '~/secrets.txt',
          '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
          '%252e%252e%252f',
          '..\\..\\..',
          '../..',
        ];

        pathPatterns.forEach(pattern => {
          expect(securityValidation.containsPathTraversal(pattern)).toBe(true);
        });
      });

      it('should not flag safe paths as traversal', () => {
        const safePaths = [
          'uploads/image.jpg',
          'documents/report.pdf',
          'assets/logo.png',
          'folder/subfolder/file.txt',
        ];

        safePaths.forEach(path => {
          expect(securityValidation.containsPathTraversal(path)).toBe(false);
        });
      });
    });

    describe('Prototype pollution detection', () => {
      it('should detect prototype pollution patterns', () => {
        const pollutionPatterns = [
          '__proto__',
          'constructor.prototype',
          'prototype.constructor',
          'obj.__proto__.isAdmin',
          'user.constructor.prototype.role',
        ];

        pollutionPatterns.forEach(pattern => {
          expect(securityValidation.containsPrototypePollution(pattern)).toBe(true);
        });
      });

      it('should not flag safe object property access', () => {
        const safePatterns = [
          'user.name',
          'object.property',
          'config.settings',
          'data.results',
        ];

        safePatterns.forEach(pattern => {
          expect(securityValidation.containsPrototypePollution(pattern)).toBe(false);
        });
      });
    });

    describe('General malicious pattern detection', () => {
      it('should detect any malicious pattern', () => {
        const maliciousPatterns = [
          '<script>alert(1)</script>', // XSS
          "'; DROP TABLE users; --", // SQL injection
          '../../../etc/passwd', // Path traversal
          '__proto__.isAdmin = true', // Prototype pollution
        ];

        maliciousPatterns.forEach(pattern => {
          expect(securityValidation.containsMaliciousPattern(pattern)).toBe(true);
        });
      });

      it('should not flag safe content as malicious', () => {
        const safePatterns = [
          'Hello world',
          'user@example.com',
          'uploads/image.jpg',
          'user.name',
          'This is a normal string with numbers 123',
        ];

        safePatterns.forEach(pattern => {
          expect(securityValidation.containsMaliciousPattern(pattern)).toBe(false);
        });
      });
    });
  });

  describe('Edge cases and comprehensive security', () => {
    it('should handle empty and null-like values', () => {
      expect(() => validationSchemas.uuid.parse('')).toThrow();
      expect(() => validationSchemas.email.parse('')).toThrow();
      expect(() => validationSchemas.safeString.parse('')).not.toThrow(); // Empty string is safe

      // Test handling of whitespace
      const whitespaceString = '   ';
      const result = validationSchemas.safeString.parse(whitespaceString);
      expect(result).toBe(''); // Should be trimmed
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      expect(() => validationSchemas.safeString.parse(longString)).not.toThrow();
    });

    it('should handle unicode and special characters safely', () => {
      const unicodeString = '🚀 Hello 世界 café';
      expect(() => validationSchemas.safeString.parse(unicodeString)).not.toThrow();
    });

    it('should handle complex nested sanitization', () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              safe: 'value'
            }
          }
        },
        normalField: 'normal'
      };
      
      // Add dangerous properties to test sanitization
      (complexObject.level1.level2.level3 as Record<string, unknown>)['__proto__'] = { dangerous: true };
      (complexObject.level1.level2.level3 as Record<string, unknown>)['constructor'] = { evil: true };
      (complexObject.level1 as Record<string, unknown>)['__proto__'] = { admin: true };

      const sanitized = sanitizeObject(complexObject);
      
      expect(sanitized.normalField).toBe('normal');
      expect(sanitized.level1.level2.level3.safe).toBe('value');
      
      // Check that dangerous keys are not in the results
      expect(Object.keys(sanitized.level1.level2.level3)).not.toContain('__proto__');
      expect(Object.keys(sanitized.level1.level2.level3)).not.toContain('constructor');
      expect(Object.keys(sanitized.level1)).not.toContain('__proto__');
    });

    it('should handle arrays in object sanitization', () => {
      const objectWithArrays = {
        tags: ['tag1', 'tag2'],
        nested: {
          items: [{ name: 'item1' }, { name: 'item2' }]
        }
      };
      
      // Add dangerous property to test sanitization
      (objectWithArrays.nested as Record<string, unknown>)['__proto__'] = { evil: true };

      const sanitized = sanitizeObject(objectWithArrays);
      
      expect(Array.isArray(sanitized.tags)).toBe(true);
      expect(sanitized.tags).toEqual(['tag1', 'tag2']);
      expect(Array.isArray(sanitized.nested.items)).toBe(true);
      expect(sanitized.nested.items[0].name).toBe('item1');
      
      // Check that dangerous keys are not in the result
      expect(Object.keys(sanitized.nested)).not.toContain('__proto__');
    });

    it('should validate complex file scenarios', () => {
      const edgeCaseFiles = [
        // File with no extension
        { type: 'image/jpeg', size: 1024, name: 'noextension'  }
        // File with multiple dots
        { type: 'image/png', size: 1024, name: 'file.backup.png'  }
        // File with uppercase extension
        { type: 'image/jpeg', size: 1024, name: 'IMAGE.JPG'  }
      ];

      // No extension should throw
      expect(() => fileValidation.validate(edgeCaseFiles[0], 'image')).toThrow();
      
      // Multiple dots should work (takes last extension)
      expect(() => fileValidation.validate(edgeCaseFiles[1], 'image')).not.toThrow();
      
      // Uppercase extension should work (converted to lowercase)
      expect(() => fileValidation.validate(edgeCaseFiles[2], 'image')).not.toThrow();
    });
  });
});