/**
 * Check database schema to find correct column names
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  // Get one service log to see column names
  const { data: serviceLogs, error: logsError } = await supabase
    .from('service_logs')
    .select('*')
    .limit(1);

  if (logsError) {
    console.error('❌ Error fetching service logs:', logsError);
  } else if (serviceLogs && serviceLogs.length > 0) {
    console.log('📋 SERVICE_LOGS columns:');
    console.log(Object.keys(serviceLogs[0]).join(', '));
    console.log('\nSample row:', JSON.stringify(serviceLogs[0], null, 2));
  }

  console.log('\n' + '━'.repeat(80) + '\n');

  // Get one customer to see column names
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .limit(1);

  if (customersError) {
    console.error('❌ Error fetching customers:', customersError);
  } else if (customers && customers.length > 0) {
    console.log('👤 CUSTOMERS columns:');
    console.log(Object.keys(customers[0]).join(', '));
    console.log('\nSample row:', JSON.stringify(customers[0], null, 2));
  }

  console.log('\n' + '━'.repeat(80) + '\n');

  // Get one boat to see column names
  const { data: boats, error: boatsError } = await supabase
    .from('boats')
    .select('*')
    .limit(1);

  if (boatsError) {
    console.error('❌ Error fetching boats:', boatsError);
  } else if (boats && boats.length > 0) {
    console.log('⛵ BOATS columns:');
    console.log(Object.keys(boats[0]).join(', '));
  }
}

checkSchema().catch(console.error);
