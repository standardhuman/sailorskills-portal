/**
 * Check customer_accounts table structure
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fzygakldvvzxmahkdylq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWdha2xkdnZ6eG1haGtkeWxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDA4Mzg5OCwiZXhwIjoyMDY5NjU5ODk4fQ.2yijB4vVm1CLBDT0-ifiA0suOwcoStqA-qMqBHjUlV0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTable() {
  try {
    console.log('🔍 Checking customer_accounts table...');

    // Try to query the table
    const { data, error } = await supabase
      .from('customer_accounts')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error:', error.message);
      if (error.message.includes('does not exist')) {
        console.log('\n⚠️  customer_accounts table does not exist.');
        console.log('   The table might be managed by Supabase Auth or needs to be created.');
      }
      return;
    }

    console.log('✅ customer_accounts table exists!');

    if (data && data.length > 0) {
      console.log('\n📊 Sample record:');
      console.log(JSON.stringify(data[0], null, 2));
      console.log('\n📋 Available columns:', Object.keys(data[0]));

      // Check if is_admin exists
      if ('is_admin' in data[0]) {
        console.log('\n✅ is_admin column already exists!');
      } else {
        console.log('\n⚠️  is_admin column does NOT exist - migration needed');
      }
    } else {
      console.log('📊 Table exists but is empty');
    }

    // Check for admin account
    const { data: adminData, error: adminError } = await supabase
      .from('customer_accounts')
      .select('*')
      .eq('email', 'admin@sailorskills.com')
      .maybeSingle();

    if (adminData) {
      console.log('\n👤 Admin account found:');
      console.log(JSON.stringify(adminData, null, 2));
    } else {
      console.log('\n⚠️  Admin account (admin@sailorskills.com) not found');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTable();
