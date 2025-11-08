/**
 * Find which boat has the 11 Notion service logs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findNotionLogs() {
  console.log('🔍 Searching for boats with Notion service logs from 2023-2025...\n');

  // Query for service logs with these specific dates
  const targetDates = [
    '2025-10-22', '2025-07-15', '2025-04-03', '2025-01-10',
    '2024-10-14', '2024-06-03', '2024-03-06',
    '2023-12-06', '2023-09-07', '2023-06-05', '2023-03-06'
  ];

  const { data: logs, error: logsError } = await supabase
    .from('service_logs')
    .select('*')
    .in('service_date', targetDates)
    .eq('data_source', 'notion')
    .order('service_date', { ascending: false });

  if (logsError) {
    console.error('❌ Error querying service logs:', logsError);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log('No service logs found with those dates');
    return;
  }

  console.log(`Found ${logs.length} service logs with those dates:\n`);

  // Group by boat_id
  const logsByBoat = {};
  logs.forEach(log => {
    if (!logsByBoat[log.boat_id]) {
      logsByBoat[log.boat_id] = [];
    }
    logsByBoat[log.boat_id].push(log);
  });

  // For each boat, get boat details
  for (const [boatId, boatLogs] of Object.entries(logsByBoat)) {
    console.log('━'.repeat(80));
    console.log(`Boat ID: ${boatId}`);
    console.log(`Service Logs: ${boatLogs.length}`);

    const { data: boat, error: boatError } = await supabase
      .from('boats')
      .select('*')
      .eq('id', boatId)
      .single();

    if (boatError) {
      console.error('  ❌ Error fetching boat:', boatError);
    } else if (boat) {
      console.log(`Boat Name: ${boat.boat_name || boat.name}`);
      console.log(`Customer ID: ${boat.customer_id}`);
      console.log(`Marina: ${boat.marina || boat.marina_location}`);

      // Get customer
      if (boat.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', boat.customer_id)
          .single();

        if (!customerError && customer) {
          console.log(`Customer: ${customer.name} (${customer.email})`);
        }
      }
    }

    console.log('\n📋 Service Log Dates:');
    boatLogs.forEach((log, idx) => {
      console.log(`  ${idx + 1}. ${log.service_date} (${log.data_source})`);
    });
    console.log('');
  }

  console.log('━'.repeat(80));
}

findNotionLogs().catch(console.error);
