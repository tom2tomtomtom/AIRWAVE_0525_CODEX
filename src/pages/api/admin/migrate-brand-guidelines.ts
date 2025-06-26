import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { loggers } from '@/lib/logger';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Add the brand_guidelines column if it doesn't exist
    process.env.NODE_ENV === 'development' && loggers.general.error('Adding brand_guidelines column...');
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
        details: columnError.message });
    }

    // Verify the column was added
    const { data: verification, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'clients')
      .eq('column_name', 'brand_guidelines');

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      return res.status(500).json({
        error: 'Verification failed',
        details: verifyError.message });
    }

    process.env.NODE_ENV === 'development' && loggers.general.error('Migration completed successfully');
    return res.json({
      success: true,
      message: 'brand_guidelines column added successfully',
      verification: verification });
  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return res.status(500).json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error' });
  }
}
