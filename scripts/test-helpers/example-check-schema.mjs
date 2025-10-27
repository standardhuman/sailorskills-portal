#!/usr/bin/env node

/**
 * Example Test Script: Check Database Schema
 *
 * This script verifies that all required tables and columns exist
 * in the database. Useful for validating migrations and schema changes.
 *
 * Usage:
 *    node scripts/test-helpers/example-check-schema.mjs
 */

import { queryAll, tableExists } from './db-query.mjs';

// Define required tables and their critical columns
const REQUIRED_SCHEMA = {
  customers: ['id', 'email', 'name', 'phone'],
  boats: ['id', 'customer_id', 'name', 'model', 'length'],
  service_logs: ['id', 'boat_id', 'service_date', 'technician'],
  invoices: ['id', 'customer_id', 'total', 'status'],
  service_requests: ['id', 'customer_account_id', 'status', 'created_at'], // Fixed: customer_account_id
  customer_messages: ['id', 'customer_account_id', 'message_text', 'created_at'] // Fixed: table name & column
};

async function checkSchema() {
  console.log('\nChecking database schema...\n');

  let allPassed = true;

  try {
    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
      // Check if table exists
      const exists = await tableExists(tableName);

      if (!exists) {
        console.log(`✗ Table "${tableName}" not found`);
        allPassed = false;
        continue;
      }

      console.log(`✓ Table "${tableName}" exists`);

      // Get actual columns from the table
      const columns = await queryAll(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
         AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      );

      const columnNames = columns.map(c => c.column_name);

      // Check required columns
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));

      if (missingColumns.length > 0) {
        console.log(`  ✗ Missing columns: ${missingColumns.join(', ')}`);
        allPassed = false;
      } else {
        console.log(`  ✓ All required columns present (${requiredColumns.join(', ')})`);
      }

      // Show total column count
      console.log(`  ${columns.length} total columns\n`);
    }

    if (allPassed) {
      console.log('✓ Schema validation passed!\n');
      process.exit(0);
    } else {
      console.log('✗ Schema validation failed - missing tables or columns\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Schema check failed:', error.message);
    process.exit(1);
  }
}

checkSchema();
