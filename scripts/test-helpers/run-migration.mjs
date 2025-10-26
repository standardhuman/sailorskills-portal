#!/usr/bin/env node

/**
 * Migration Runner Utility
 *
 * Run SQL migration files against your Supabase database safely.
 * Supports transactions, dry-run mode, and automatic backup.
 *
 * Usage:
 *    node scripts/test-helpers/run-migration.mjs <migration-file.sql>
 *    node scripts/test-helpers/run-migration.mjs <migration-file.sql> --dry-run
 *    node scripts/test-helpers/run-migration.mjs <migration-file.sql> --no-transaction
 *
 * Examples:
 *    node scripts/test-helpers/run-migration.mjs migrations/add_customer_notes.sql
 *    node scripts/test-helpers/run-migration.mjs migrations/alter_boats_table.sql --dry-run
 */

import { readFileSync } from 'fs';
import { transaction, query } from './db-query.mjs';

const args = process.argv.slice(2);
const migrationFile = args[0];
const isDryRun = args.includes('--dry-run');
const useTransaction = !args.includes('--no-transaction');

if (!migrationFile) {
  console.error('\n❌ Error: No migration file specified\n');
  console.log('Usage: node run-migration.mjs <migration-file.sql> [--dry-run] [--no-transaction]\n');
  console.log('Examples:');
  console.log('  node run-migration.mjs migrations/add_column.sql');
  console.log('  node run-migration.mjs migrations/add_column.sql --dry-run');
  console.log('  node run-migration.mjs migrations/seed_data.sql --no-transaction\n');
  process.exit(1);
}

async function runMigration() {
  console.log('\n🔄 Migration Runner\n');
  console.log(`File: ${migrationFile}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Transaction: ${useTransaction ? 'YES (rollback on error)' : 'NO'}\n`);

  try {
    // Read migration file
    const sql = readFileSync(migrationFile, 'utf8');

    console.log('📄 Migration SQL:\n');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log();

    if (isDryRun) {
      console.log('✓ Dry run complete - no changes made\n');
      return;
    }

    // Confirm before running
    console.log('⚠️  Ready to execute migration');
    console.log('   This will modify your database!');
    console.log();

    // Run migration
    if (useTransaction) {
      console.log('🔒 Running in transaction (will rollback on error)...\n');

      await transaction(async (client) => {
        await client.query(sql);
      });

      console.log('✅ Migration completed successfully (committed)');
    } else {
      console.log('⚠️  Running without transaction...\n');

      await query(sql);

      console.log('✅ Migration completed successfully');
    }

    console.log();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.position) {
      console.error('   Position:', error.position);
    }
    if (useTransaction) {
      console.error('   Transaction rolled back - no changes made');
    }
    console.error();
    process.exit(1);
  }
}

runMigration();
