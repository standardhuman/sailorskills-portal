/**
 * Check Twilight Zone service logs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTwilightZone() {
  const twilightZoneId = '64a476c8-bd30-4134-9abd-45dba194e610';

  console.log('🔍 Checking Twilight Zone boat and service logs...\n');

  // Get boat details
  const { data: boat, error: boatError } = await supabase
    .from('boats')
    .select('*')
    .eq('id', twilightZoneId)
    .single();

  if (boatError) {
    console.error('❌ Error fetching boat:', boatError);
    return;
  }

  console.log('⛵ Boat: Twilight Zone');
  console.log(`   ID: ${boat.id}`);
  console.log(`   Customer ID: ${boat.customer_id}`);
  console.log(`   Marina: ${boat.marina || boat.marina_location}`);

  // Get service logs
  const { data: logs, error: logsError } = await supabase
    .from('service_logs')
    .select('*')
    .eq('boat_id', twilightZoneId)
    .order('service_date', { ascending: false });

  if (logsError) {
    console.error('❌ Error fetching service logs:', logsError);
    return;
  }

  console.log(`\n📋 Service Logs (${logs?.length || 0} total):`);
  if (logs && logs.length > 0) {
    logs.forEach((log, idx) => {
      console.log(`  ${idx + 1}. ${log.service_date} (source: ${log.data_source})`);
    });
  } else {
    console.log('  No service logs found');
  }

  // Get customer
  if (boat.customer_id) {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', boat.customer_id)
      .single();

    if (!customerError && customer) {
      console.log(`\n👤 Owner: ${customer.name} (${customer.email})`);
    }
  }
}

checkTwilightZone().catch(console.error);
