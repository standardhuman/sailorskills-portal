/**
 * Setup admin account
 * Note: The is_admin column must be added via SQL Editor in Supabase Dashboard first
 * Run the SQL in shared/database/add-admin-flag.sql
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fzygakldvvzxmahkdylq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWdha2xkdnZ6eG1haGtkeWxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDA4Mzg5OCwiZXhwIjoyMDY5NjU5ODk4fQ.2yijB4vVm1CLBDT0-ifiA0suOwcoStqA-qMqBHjUlV0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupAdmin() {
  try {
    console.log('👤 Setting up admin account...\n');

    // Step 1: Check if admin auth user exists
    console.log('1️⃣  Checking for admin auth user...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }

    let adminAuthUser = users.find(u => u.email === 'admin@sailorskills.com');

    if (!adminAuthUser) {
      console.log('   ⚠️  Admin auth user not found. Creating...');

      // Create admin auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@sailorskills.com',
        password: 'KLRss!650',
        email_confirm: true,
        user_metadata: {
          name: 'Admin',
          role: 'admin'
        }
      });

      if (createError) {
        console.error('❌ Error creating admin user:', createError.message);
        return;
      }

      adminAuthUser = newUser.user;
      console.log('   ✅ Admin auth user created:', adminAuthUser.id);
    } else {
      console.log('   ✅ Admin auth user exists:', adminAuthUser.id);
    }

    // Step 2: Check if customer_accounts record exists
    console.log('\n2️⃣  Checking customer_accounts record...');
    const { data: existingAccount, error: checkError } = await supabase
      .from('customer_accounts')
      .select('*')
      .eq('id', adminAuthUser.id)
      .maybeSingle();

    if (checkError && !checkError.message.includes('0 rows')) {
      console.error('❌ Error checking customer_accounts:', checkError.message);
    }

    if (!existingAccount) {
      console.log('   ⚠️  customer_accounts record not found. Creating...');

      // Create customer_accounts record
      const accountData = {
        id: adminAuthUser.id,
        email: 'admin@sailorskills.com',
        name: 'Admin',
        phone: null,
        magic_link_enabled: true,
        password_enabled: true
      };

      // Check if is_admin column exists by trying to insert with it
      try {
        const { data, error: insertError } = await supabase
          .from('customer_accounts')
          .insert({ ...accountData, is_admin: true })
          .select()
          .single();

        if (insertError) {
          if (insertError.message.includes('is_admin')) {
            console.log('   ⚠️  is_admin column does not exist. Creating without it...');
            const { error: insertError2 } = await supabase
              .from('customer_accounts')
              .insert(accountData)
              .select()
              .single();

            if (insertError2) {
              console.error('❌ Error creating customer_accounts:', insertError2.message);
              return;
            }

            console.log('   ✅ customer_accounts record created (without is_admin)');
            console.log('\n⚠️  IMPORTANT: Run the SQL migration to add is_admin column:');
            console.log('   File: shared/database/add-admin-flag.sql');
          } else {
            console.error('❌ Error inserting:', insertError.message);
            return;
          }
        } else {
          console.log('   ✅ customer_accounts record created with is_admin=true');
        }
      } catch (e) {
        console.error('❌ Unexpected error:', e.message);
        return;
      }
    } else {
      console.log('   ✅ customer_accounts record exists');

      // Try to update is_admin to true
      console.log('\n3️⃣  Updating is_admin flag...');
      const { error: updateError } = await supabase
        .from('customer_accounts')
        .update({ is_admin: true })
        .eq('id', adminAuthUser.id);

      if (updateError) {
        if (updateError.message.includes('is_admin') || updateError.message.includes('column')) {
          console.log('   ⚠️  is_admin column does not exist');
          console.log('\n📝 MANUAL STEP REQUIRED:');
          console.log('   1. Go to Supabase Dashboard → SQL Editor');
          console.log('   2. Run this SQL:\n');
          console.log('   ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;');
          console.log(`   UPDATE customer_accounts SET is_admin = TRUE WHERE id = '${adminAuthUser.id}';`);
        } else {
          console.error('❌ Error updating is_admin:', updateError.message);
        }
      } else {
        console.log('   ✅ is_admin flag set to true');
      }
    }

    console.log('\n✅ Admin setup complete!');
    console.log('📧 Email: admin@sailorskills.com');
    console.log('🔑 Password: KLRss!650');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupAdmin();
