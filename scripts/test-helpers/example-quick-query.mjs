#!/usr/bin/env node

/**
 * Example Test Script: Quick SQL Query Runner
 *
 * Run any SQL query from the command line and see formatted results.
 * Great for quick testing and debugging.
 *
 * Usage:
 *    node scripts/test-helpers/example-quick-query.mjs "SELECT * FROM customers LIMIT 5"
 *
 * Examples:
 *    node scripts/test-helpers/example-quick-query.mjs "SELECT COUNT(*) FROM boats"
 *    node scripts/test-helpers/example-quick-query.mjs "SELECT * FROM invoices WHERE status = 'unpaid'"
 */

import { query } from './db-query.mjs';

async function runQuery(sql) {
  if (!sql) {
    console.error('\nError: Please provide a SQL query\n');
    console.log('Usage: node example-quick-query.mjs "SELECT * FROM customers LIMIT 5"\n');
    process.exit(1);
  }

  console.log('\nExecuting query...\n');
  console.log('SQL:', sql, '\n');

  try {
    const result = await query(sql);

    console.log(`✓ Query executed successfully\n`);
    console.log(`  Rows returned: ${result.rowCount}`);

    if (result.rows.length > 0) {
      console.log('\nResults:\n');

      // Format as table
      console.table(result.rows);

      // Also show first row in detail
      if (result.rows.length === 1) {
        console.log('\nFirst row details:');
        Object.entries(result.rows[0]).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
    } else {
      console.log('\n  No rows returned');
    }

    console.log();

  } catch (error) {
    console.error('\n✗ Query failed:', error.message);
    process.exit(1);
  }
}

// Get SQL from command line
const sql = process.argv[2];
runQuery(sql);
