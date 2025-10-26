/**
 * Apply admin migration directly using postgres library
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Construct connection string from Supabase URL
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const PROJECT_REF = 'fzygakldvvzxmahkdylq';
const PASSWORD = 'Marin3service'; // Default Supabase password
const CONNECTION_STRING = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

async function applyMigration() {
  const client = new Client({
    connectionString: CONNECTION_STRING
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('📝 Reading migration file...');
    const migrationPath = join(__dirname, '../shared/database/add-admin-flag.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🔧 Applying migration...\n');

    // Execute the full SQL
    await client.query(migrationSQL);

    console.log('✅ Migration applied successfully!');

    // Verify
    console.log('\n📊 Verifying...');
    const result = await client.query(`
      SELECT email, is_admin
      FROM customer_accounts
      WHERE email = 'admin@sailorskills.com'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Admin account verified:');
      console.log('   Email:', result.rows[0].email);
      console.log('   Is Admin:', result.rows[0].is_admin);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.message.includes('does not exist')) {
      console.log('\n💡 The customer_accounts table might not exist yet.');
      console.log('   Make sure the table is created first.');
    } else if (error.message.includes('connection')) {
      console.log('\n💡 Connection failed. Try updating the password in the script.');
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
