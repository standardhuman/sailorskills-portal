/**
 * Check actual paint_condition_overall values in database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPaintValues() {
  console.log('🔍 Checking paint_condition_overall values in database...\n');

  // Get all unique paint condition values
  const { data: logs, error } = await supabase
    .from('service_logs')
    .select('paint_condition_overall')
    .not('paint_condition_overall', 'is', null)
    .order('paint_condition_overall');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Get unique values
  const uniqueValues = [...new Set(logs.map(log => log.paint_condition_overall))];

  console.log(`Found ${uniqueValues.length} unique paint condition values:\n`);

  uniqueValues.forEach((value, idx) => {
    const normalized = value.toLowerCase().trim();
    console.log(`${idx + 1}. "${value}"`);
    console.log(`   Normalized: "${normalized}"`);
    console.log(`   Has comma: ${value.includes(',')}`);
    console.log(`   Has space: ${value.includes(' ')}`);
    console.log('');
  });
}

checkPaintValues().catch(console.error);
