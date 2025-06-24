import { NextApiRequest, NextApiResponse } from 'next';
import { getErrorMessage } from '@/utils/errorUtils';

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  errorId: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  buildInfo?: {
    version: string;
    commit?: string;
    environment: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const errorReport: ErrorReport = req.body;
    
    // Validate required fields
    if (!errorReport.message || !errorReport.errorId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Add server-side metadata
    const enhancedReport = {
      ...errorReport,
      serverTimestamp: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      buildInfo: {},
  version: process.env.npm_package_version || '1.0.0',
        commit: process.env.VERCEL_GITHUB_COMMIT_SHA || process.env.GIT_COMMIT,
        environment: process.env.NODE_ENV}};

    // Log error for server monitoring
    console.error('Client Error Report:', {
      errorId: errorReport.errorId,
      message: errorReport.message,
      url: errorReport.url,
      timestamp: errorReport.timestamp,
      userAgent: errorReport.userAgent});

    // In production, you would:
    // 1. Store in database for analysis
    // 2. Send to error monitoring service (Sentry, LogRocket, etc.)
    // 3. Alert on critical errors
    // 4. Aggregate for reporting

    if (process.env.NODE_ENV === 'production') {
      // Example: Store in database
      // await storeErrorReport(enhancedReport);
      
      // Example: Send to monitoring service
      // await sendToMonitoringService(enhancedReport);
      
      // Example: Check if this is a critical error and alert
      // if (isCriticalError(errorReport)) {
      //   await sendAlert(enhancedReport);
      // }
    }

    return res.status(200).json({
      success: true,
      errorId: errorReport.errorId,
      message: 'Error report received'});

  } catch (error: any) {
    console.error('Error processing error report:', error);
    return res.status(500).json({
      error: 'Failed to process error report',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined});
  }
}

// Helper functions for production error handling

async function storeErrorReport(report: any) {
  // Example implementation - store in your database
  // const { supabase } = require('@/lib/supabase/client');
  // 
  // await supabase.from('error_reports').insert({
  //   error_id: report.errorId,
  //   message: report.message,
  //   stack: report.stack,
  //   component_stack: report.componentStack,
  //   url: report.url,
  //   user_agent: report.userAgent,
  //   ip_address: report.ip,
  //   timestamp: report.timestamp,
  //   build_info: report.buildInfo,
  // });
}

async function sendToMonitoringService(report: any) {
  // Example: Send to external monitoring service
  // if (process.env.ERROR_REPORTING_URL) {
  //   await fetch(process.env.ERROR_REPORTING_URL, {
  //     method: 'POST',
  //     headers: {},
        //       'Content-Type': 'application/json',
  //       'Authorization': `Bearer ${process.env.ERROR_REPORTING_TOKEN
      }`,
  //     },
  //     body: JSON.stringify(report),
  //   });
  // }
}

function isCriticalError(report: ErrorReport): boolean {
  const criticalPatterns = [
    /ChunkLoadError/,
    /Loading chunk \d+ failed/,
    /Network Error/,
    /TypeError.*undefined/,
    /ReferenceError/,
  ];

  return criticalPatterns.some(pattern => 
    pattern.test(report.message) || 
    (report.stack && pattern.test(report.stack))
  );
}

async function sendAlert(report: any) {
  // Example: Send alert for critical errors
  // Could integrate with Slack, email, SMS, etc.
  console.error('CRITICAL ERROR DETECTED:', {
    errorId: report.errorId,
    message: report.message,
    url: report.url,
    timestamp: report.timestamp});
}