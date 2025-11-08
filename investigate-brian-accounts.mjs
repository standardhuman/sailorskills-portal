/**
 * Investigate Brian's customer and account records
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function investigateBrianAccounts() {
  console.log('🔍 Investigating Brian\'s records across tables...\n');

  // 1. Check customers table
  console.log('1️⃣  CUSTOMERS TABLE:');
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .eq('email', 'standardhuman@gmail.com');

  if (customersError) {
    console.error('❌ Error:', customersError);
  } else if (customers && customers.length > 0) {
    customers.forEach((customer, idx) => {
      console.log(`\n  Customer ${idx + 1}:`);
      console.log(`  ID: ${customer.id}`);
      console.log(`  Name: ${customer.name}`);
      console.log(`  Email: ${customer.email}`);
    });
  } else {
    console.log('  No customers found');
  }

  // 2. Check customer_accounts table
  console.log('\n\n2️⃣  CUSTOMER_ACCOUNTS TABLE:');
  const { data: accounts, error: accountsError } = await supabase
    .from('customer_accounts')
    .select('*')
    .eq('email', 'standardhuman@gmail.com');

  if (accountsError) {
    console.error('❌ Error:', accountsError);
  } else if (accounts && accounts.length > 0) {
    accounts.forEach((account, idx) => {
      console.log(`\n  Account ${idx + 1}:`);
      console.log(`  ID: ${account.id}`);
      console.log(`  Email: ${account.email}`);
      console.log(`  Is Admin: ${account.is_admin}`);
      console.log(`  Customer ID: ${account.customer_id || 'NULL'}`);
    });
  } else {
    console.log('  No accounts found');
  }

  // 3. Find all boats owned by customer records
  if (customers && customers.length > 0) {
    console.log('\n\n3️⃣  BOATS OWNED (via customers table):');
    for (const customer of customers) {
      const { data: boats, error: boatsError } = await supabase
        .from('boats')
        .select('id, boat_name, name')
        .eq('customer_id', customer.id);

      if (!boatsError && boats && boats.length > 0) {
        console.log(`\n  Customer ${customer.name} owns:`);
        boats.forEach(boat => {
          console.log(`    - ${boat.boat_name || boat.name} (${boat.id})`);
        });
      }
    }
  }

  // 4. Find all boats with portal access
  if (accounts && accounts.length > 0) {
    console.log('\n\n4️⃣  BOATS WITH PORTAL ACCESS (via customer_boat_access):');
    for (const account of accounts) {
      const { data: access, error: accessError } = await supabase
        .from('customer_boat_access')
        .select(`
          *,
          boat:boats(id, boat_name, name)
        `)
        .eq('customer_account_id', account.id);

      if (!accessError && access && access.length > 0) {
        console.log(`\n  Account ${account.email} has access to:`);
        access.forEach(a => {
          console.log(`    - ${a.boat.boat_name || a.boat.name} (${a.boat.id}) ${a.is_primary ? '[PRIMARY]' : ''}`);
        });
      } else {
        console.log(`\n  Account ${account.email}: No boat access granted`);
      }
    }
  }

  console.log('\n\n' + '━'.repeat(80));
  console.log('\n📊 SUMMARY:');
  console.log(`  Customers found: ${customers?.length || 0}`);
  console.log(`  Accounts found: ${accounts?.length || 0}`);
  console.log('\n💡 DIAGNOSIS:');
  console.log('  - "Maris" is owned by a CUSTOMER record (via boats.customer_id)');
  console.log('  - Portal access is granted via CUSTOMER_ACCOUNT (customer_boat_access table)');
  console.log('  - These are TWO SEPARATE systems!');
  console.log('  - To see "Maris" in the portal, Brian\'s account needs a customer_boat_access record');
}

investigateBrianAccounts().catch(console.error);
