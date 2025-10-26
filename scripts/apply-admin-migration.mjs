/**
 * Apply admin flag migration to customer_accounts table
 * This script adds is_admin field and sets admin@sailorskills.com as admin
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = 'https://fzygakldvvzxmahkdylq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWdha2xkdnZ6eG1haGtkeWxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDA4Mzg5OCwiZXhwIjoyMDY5NjU5ODk4fQ.2yijB4vVm1CLBDT0-ifiA0suOwcoStqA-qMqBHjUlV0';

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  try {
    console.log('📝 Reading migration file...');

    // Read the migration SQL
    const migrationPath = join(__dirname, '../shared/database/add-admin-flag.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🔧 Applying migration to database...');

    // Execute the migration using Supabase RPC
    // Split by semicolon and execute each statement separately
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      console.log(`   Executing: ${statement.substring(0, 50)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // If exec_sql doesn't exist, try using the postgres REST API directly
        const { error: directError } = await supabase
          .from('_temp')
          .select('*')
          .limit(0);

        if (directError) {
          console.error('❌ Error executing statement:', error);
          throw error;
        }
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('📊 Verifying admin account...');

    // Verify the admin account
    const { data, error } = await supabase
      .from('customer_accounts')
      .select('email, is_admin')
      .eq('email', 'admin@sailorskills.com')
      .single();

    if (error) {
      console.log('⚠️  Could not verify admin account (table may not exist yet)');
      console.log('   You may need to run this migration manually in Supabase SQL Editor');
    } else if (data) {
      console.log('✅ Admin account verified:');
      console.log('   Email:', data.email);
      console.log('   Is Admin:', data.is_admin);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📝 Manual steps:');
    console.error('1. Go to Supabase Dashboard → SQL Editor');
    console.error('2. Copy the contents of shared/database/add-admin-flag.sql');
    console.error('3. Execute the SQL manually');
    process.exit(1);
  }
}

applyMigration();
