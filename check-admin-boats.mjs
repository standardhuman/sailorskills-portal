/**
 * Check if Brian is admin and what boats getUserBoats returns
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAdminBoats() {
  console.log('🔍 Checking Brian\'s account and boat access...\n');

  // Find Brian's account
  const { data: accounts, error: accountsError } = await supabase
    .from('customer_accounts')
    .select('*')
    .eq('email', 'standardhuman@gmail.com');

  if (accountsError) {
    console.error('❌ Error querying customer_accounts:', accountsError);
    return;
  }

  if (!accounts || accounts.length === 0) {
    console.log('No account found for standardhuman@gmail.com');
    return;
  }

  const account = accounts[0];
  console.log('📧 Account:', account.email);
  console.log('🆔 Account ID:', account.id);
  console.log('👑 Is Admin:', account.is_admin);
  console.log('');

  // Check boat access
  const { data: boatAccess, error: accessError } = await supabase
    .from('customer_boat_access')
    .select(`
      *,
      boat:boats(id, boat_name, name)
    `)
    .eq('customer_account_id', account.id);

  if (accessError) {
    console.error('❌ Error querying boat access:', accessError);
  } else {
    console.log(`⛵ Boat Access (${boatAccess?.length || 0} boats):`);
    if (boatAccess && boatAccess.length > 0) {
      boatAccess.forEach((access, idx) => {
        console.log(`  ${idx + 1}. ${access.boat.boat_name || access.boat.name} (${access.boat.id})`);
        console.log(`     Primary: ${access.is_primary}`);
      });
    } else {
      console.log('  No boat access granted');
    }
  }

  console.log('\n' + '━'.repeat(80));

  // If admin, show first 5 boats alphabetically (what Portal would show)
  if (account.is_admin) {
    console.log('\n👑 User is ADMIN - Portal will show ALL boats');
    console.log('First 5 boats alphabetically (what Portal defaults to):\n');

    const { data: allBoats, error: boatsError } = await supabase
      .from('boats')
      .select('id, boat_name, name')
      .order('name', { ascending: true })
      .limit(5);

    if (boatsError) {
      console.error('❌ Error querying boats:', boatsError);
    } else if (allBoats) {
      allBoats.forEach((boat, idx) => {
        console.log(`  ${idx + 1}. ${boat.boat_name || boat.name} (${boat.id})`);
        if (idx === 0) {
          console.log('     ⬆️  THIS IS THE BOAT THE PORTAL SHOWS BY DEFAULT!');
        }
      });
    }
  }
}

checkAdminBoats().catch(console.error);
