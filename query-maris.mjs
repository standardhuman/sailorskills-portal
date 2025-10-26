import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fzygakldvvzxmahkdylq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWdha2xkdnZ6eG1haGtkeWxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDA4Mzg5OCwiZXhwIjoyMDY5NjU5ODk4fQ.2yijB4vVm1CLBDT0-ifiA0suOwcoStqA-qMqBHjUlV0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryMaris() {
  console.log('🔍 Looking for Maris vessel...');

  // Find Maris boat
  const { data: boat, error: boatError } = await supabase
    .from('boats')
    .select('*')
    .ilike('name', '%maris%')
    .single();

  if (boatError) {
    console.error('Error finding Maris:', boatError);
    return;
  }

  console.log('✅ Found boat:', JSON.stringify(boat, null, 2));

  // Get latest service log with conditions
  const { data: serviceLogs, error: logError } = await supabase
    .from('service_logs')
    .select('*')
    .eq('boat_id', boat.id)
    .order('service_date', { ascending: false })
    .limit(5);

  if (logError) {
    console.error('Error fetching service logs:', logError);
    return;
  }

  console.log('\n📋 Latest service logs:');
  if (serviceLogs.length > 0) {
    console.log('\n🔑 Service log fields:', Object.keys(serviceLogs[0]));
  }
  serviceLogs.forEach((log, idx) => {
    console.log(`\n${idx + 1}. Service ${log.id} (${log.service_date})`);
    console.log('   Type:', log.service_type);
    console.log('   Paint condition overall:', log.paint_condition_overall);
    console.log('   Paint keel:', log.paint_detail_keel);
    console.log('   Paint waterline:', log.paint_detail_waterline);
    console.log('   Growth level:', log.growth_level);
    console.log('   Propellers:', log.propellers);
    console.log('   Photos:', log.photos?.length || 0, 'photos');
  });
}

queryMaris().catch(console.error);
