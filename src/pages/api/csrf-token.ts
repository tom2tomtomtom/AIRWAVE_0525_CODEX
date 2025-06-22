import { NextApiRequest, NextApiResponse } from 'next';
import { createCSRFTokenHandler } from '@/middleware/security/csrf';

// CSRF token endpoint
export default createCSRFTokenHandler;