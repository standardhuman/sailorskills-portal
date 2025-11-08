/**
 * Debug script to find all boats named "Maris" in the database
 * Usage: node debug-maris-boats.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Need: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findMarisBoats() {
  console.log('🔍 Searching for all boats named "Maris"...\n');

  // Query boats table for all boats named "Maris"
  const { data: boats, error: boatsError } = await supabase
    .from('boats')
    .select('*')
    .ilike('boat_name', 'Maris');

  if (boatsError) {
    console.error('❌ Error querying boats:', boatsError);
    return;
  }

  if (!boats || boats.length === 0) {
    console.log('No boats named "Maris" found');
    return;
  }

  console.log(`Found ${boats.length} boat(s) named "Maris":\n`);

  for (const boat of boats) {
    console.log('━'.repeat(80));
    console.log(`Boat ID: ${boat.id}`);
    console.log(`Boat Name: ${boat.boat_name || boat.name}`);
    console.log(`Customer ID: ${boat.customer_id}`);
    console.log(`Created: ${boat.created_at}`);
    console.log(`Updated: ${boat.updated_at}`);
    console.log(`All fields:`, JSON.stringify(boat, null, 2));

    // Get service logs for this boat
    const { data: serviceLogs, error: logsError } = await supabase
      .from('service_logs')
      .select('*')
      .eq('boat_id', boat.id)
      .order('service_date', { ascending: false });

    if (logsError) {
      console.error('  ❌ Error fetching service logs:', logsError);
    } else {
      console.log(`\n  📋 Service Logs (${serviceLogs?.length || 0} total):`);
      if (serviceLogs && serviceLogs.length > 0) {
        serviceLogs.forEach((log, idx) => {
          console.log(`    ${idx + 1}. ${log.service_date} - Source: ${log.data_source} - ID: ${log.id}`);
        });
      } else {
        console.log('    No service logs found');
      }
    }

    // Get customer info
    if (boat.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', boat.customer_id)
        .single();

      if (customerError) {
        console.error('\n  ❌ Error fetching customer:', customerError);
      } else if (customer) {
        console.log(`\n  👤 Customer: ${customer.name} (${customer.email})`);
        console.log(`     Customer ID: ${customer.id}`);
      }
    }

    console.log('\n');
  }

  console.log('━'.repeat(80));
  console.log('\n📊 Summary:');
  console.log(`Total boats named "Maris": ${boats.length}`);

  if (boats.length > 1) {
    console.log('\n⚠️  DUPLICATE BOATS DETECTED!');
    console.log('Boat IDs:', boats.map(b => b.id).join(', '));
  }
}

findMarisBoats().catch(console.error);
