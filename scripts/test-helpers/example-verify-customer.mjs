#!/usr/bin/env node

/**
 * Example Test Script: Verify Customer Data
 *
 * This script demonstrates how to use the db-query utility to verify
 * that customer data exists and is correctly structured in the database.
 *
 * Usage:
 *    node scripts/test-helpers/example-verify-customer.mjs [email]
 *
 * Example:
 *    node scripts/test-helpers/example-verify-customer.mjs standardhuman@gmail.com
 */

import { queryOne, queryAll, queryValue } from './db-query.mjs';

async function verifyCustomer(email) {
  console.log(`\nVerifying customer: ${email}\n`);

  try {
    // Check if customer exists
    const customer = await queryOne(
      'SELECT * FROM customers WHERE email = $1',
      [email]
    );

    if (!customer) {
      console.log('✗ Customer not found');
      process.exit(1);
    }

    console.log('✓ Customer found');
    console.log('  ID:', customer.id);
    console.log('  Name:', customer.name);
    console.log('  Email:', customer.email);
    console.log('  Phone:', customer.phone || 'N/A');

    // Check how many boats this customer has
    const boatCount = await queryValue(
      'SELECT COUNT(*) FROM boats WHERE customer_id = $1',
      [customer.id]
    );

    console.log('\n✓ Boats:', boatCount);

    if (boatCount > 0) {
      const boats = await queryAll(
        'SELECT id, name, model, length FROM boats WHERE customer_id = $1',
        [customer.id]
      );

      boats.forEach(boat => {
        console.log(`  - ${boat.name} (${boat.model}, ${boat.length}ft)`);
      });
    }

    // Check service history
    const serviceCount = await queryValue(
      `SELECT COUNT(*)
       FROM service_logs sl
       JOIN boats b ON sl.boat_id = b.id
       WHERE b.customer_id = $1`,
      [customer.id]
    );

    console.log('\n✓ Service history:', serviceCount, 'services');

    // Check invoices
    const invoiceCount = await queryValue(
      'SELECT COUNT(*) FROM invoices WHERE customer_id = $1',
      [customer.id]
    );

    const totalBilled = await queryValue(
      'SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = $1',
      [customer.id]
    );

    console.log('\n✓ Invoices:', invoiceCount);
    console.log('  Total billed: $' + (totalBilled || 0));

    console.log('\n✓ Customer verification complete!\n');

  } catch (error) {
    console.error('\n✗ Verification failed:', error.message);
    process.exit(1);
  }
}

// Get email from command line or use default test email
const email = process.argv[2] || 'standardhuman@gmail.com';
verifyCustomer(email);
