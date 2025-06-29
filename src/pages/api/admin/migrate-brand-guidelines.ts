import { NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { loggers } from '@/lib/logger';
import { withEnhancedSecurity, SecurityConfigs } from '@/middleware/withEnhancedSecurity';
import { withRoles, AuthenticatedRequest } from '@/middleware/withAuth';
import { UserRole } from '@/types/auth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Log admin operation attempt
    loggers.general.warn('Admin database migration attempted', {
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      operation: 'brand_guidelines_column_migration',
      ip: Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });
    // Add the brand_guidelines column if it doesn't exist
    process.env.NODE_ENV === 'development' &&
      loggers.general.error('Adding brand_guidelines column...');
    if (!supabase) {
      return res.status(500).json({ error: 'Database client not available' });
    }
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'clients' AND column_name = 'brand_guidelines'
          ) THEN
            ALTER TABLE clients ADD COLUMN brand_guidelines JSONB DEFAULT '{}' NOT NULL;
            
            -- Add comment to describe the column
            COMMENT ON COLUMN clients.brand_guidelines IS 'JSON object containing brand guidelines including colors, fonts, logos, and style preferences';
            
            -- Create an index for better query performance
            CREATE INDEX idx_clients_brand_guidelines ON clients USING GIN (brand_guidelines);
            
            RAISE NOTICE 'Added brand_guidelines column successfully';
          ELSE
            RAISE NOTICE 'brand_guidelines column already exists';
          END IF;
        END $$;
      `,
    });

    if (columnError) {
      console.error('❌ Migration failed:', columnError);
      return res.status(500).json({
        error: 'Migration failed',
        details: columnError.message,
      });
    }

    // Verify the column was added
    if (!supabase) {
      return res.status(500).json({ error: 'Database client not available' });
    }
    const { data: verification, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'clients')
      .eq('column_name', 'brand_guidelines');

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      return res.status(500).json({
        error: 'Verification failed',
        details: verifyError.message,
      });
    }

    // Log successful migration
    loggers.general.info('Admin database migration completed successfully', {
      userId: req.user?.id,
      userEmail: req.user?.email,
      operation: 'brand_guidelines_column_migration',
      success: true,
    });

    return res.json({
      success: true,
      message: 'brand_guidelines column added successfully',
      verification: verification,
    });
  } catch (error: any) {
    // Log migration failure
    loggers.general.error('Admin database migration failed', {
      userId: req.user?.id,
      userEmail: req.user?.email,
      operation: 'brand_guidelines_column_migration',
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    });

    console.error('❌ Unexpected error:', error);
    return res.status(500).json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Apply enhanced security with admin role requirement
export default withRoles(UserRole.ADMIN)(
  withEnhancedSecurity(
    {
      ...SecurityConfigs.admin,
      rateLimit: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 requests per hour (very restrictive for admin operations)
      analysis: {
        ...SecurityConfigs.admin.analysis,
        checkUserAgent: true,
        checkOrigin: true,
        checkReferer: true,
        detectBots: true,
        logSuspiciousActivity: true,
      },
    },
    handler
  )
);
