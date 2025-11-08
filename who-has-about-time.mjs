/**
 * Check who has access to "About Time"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function whoHasAboutTime() {
  const aboutTimeId = '6b9c23f0-86d2-4ef9-b2e4-bc2b5b9e9728';

  console.log('🔍 Checking who has portal access to "About Time"...\n');

  // Get boat details
  const { data: boat, error: boatError } = await supabase
    .from('boats')
    .select('*')
    .eq('id', aboutTimeId)
    .single();

  if (boatError) {
    console.error('❌ Error fetching boat:', boatError);
    return;
  }

  console.log('⛵ About Time');
  console.log(`   ID: ${boat.id}`);
  console.log(`   Customer ID: ${boat.customer_id}`);

  // Get customer
  if (boat.customer_id) {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', boat.customer_id)
      .single();

    if (!customerError && customer) {
      console.log(`   Owner (customer): ${customer.name} (${customer.email})`);
    }
  }

  // Get portal access
  console.log('\n📋 Portal Access Grants:');
  const { data: access, error: accessError } = await supabase
    .from('customer_boat_access')
    .select(`
      *,
      account:customer_accounts(id, email, is_admin)
    `)
    .eq('boat_id', aboutTimeId);

  if (accessError) {
    console.error('❌ Error fetching access:', accessError);
  } else if (access && access.length > 0) {
    access.forEach((a, idx) => {
      console.log(`\n  ${idx + 1}. ${a.account.email}`);
      console.log(`     Account ID: ${a.account.id}`);
      console.log(`     Is Admin: ${a.account.is_admin}`);
      console.log(`     Is Primary: ${a.is_primary}`);
      console.log(`     Granted: ${a.granted_at}`);
    });
  } else {
    console.log('  No portal access grants found');
  }

  // Also check if there are any admin accounts
  console.log('\n\n👑 Admin Accounts (can see ALL boats):');
  const { data: admins, error: adminsError } = await supabase
    .from('customer_accounts')
    .select('id, email, is_admin')
    .eq('is_admin', true);

  if (adminsError) {
    console.error('❌ Error fetching admins:', adminsError);
  } else if (admins && admins.length > 0) {
    admins.forEach((admin, idx) => {
      console.log(`  ${idx + 1}. ${admin.email} (${admin.id})`);
    });
  } else {
    console.log('  No admin accounts found');
  }
}

whoHasAboutTime().catch(console.error);
