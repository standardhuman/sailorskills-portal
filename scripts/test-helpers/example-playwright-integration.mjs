#!/usr/bin/env node

/**
 * Example: Using Database Queries in Playwright Tests
 *
 * This example shows how to integrate database queries into Playwright tests
 * for data setup, validation, and cleanup.
 *
 * You can import these functions into your Playwright test files.
 */

import { test, expect } from '@playwright/test';
import { queryOne, queryAll, queryValue, transaction } from './db-query.mjs';

/**
 * Example 1: Verify data before running UI tests
 */
test('customer portal shows correct data', async ({ page }) => {
  const testEmail = 'standardhuman@gmail.com';

  // Query database to get expected data
  const customer = await queryOne(
    'SELECT * FROM customers WHERE email = $1',
    [testEmail]
  );

  expect(customer).not.toBeNull();

  const boatCount = await queryValue(
    'SELECT COUNT(*) FROM boats WHERE customer_id = $1',
    [customer.id]
  );

  // Now test the UI shows the same data
  await page.goto('https://portal.sailorskills.com/portal');

  // Login
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'KLRss!650');
  await page.click('button[type="submit"]');

  // Verify boat count matches database
  await expect(page.locator('.boat-card')).toHaveCount(parseInt(boatCount));

  // Verify customer name is displayed
  await expect(page.locator('.customer-name')).toContainText(customer.name);
});

/**
 * Example 2: Data cleanup after test
 */
test('test data cleanup', async ({ page }) => {
  // Create test data
  const testEmail = 'test-' + Date.now() + '@example.com';

  // ... run your test ...

  // Clean up test data after test
  await transaction(async (client) => {
    const result = await client.query(
      'DELETE FROM customers WHERE email = $1 RETURNING id',
      [testEmail]
    );

    if (result.rowCount > 0) {
      console.log('Cleaned up test customer:', testEmail);
    }
  });
});

/**
 * Example 3: Setup test data before test
 */
test.beforeEach(async () => {
  // Verify required test data exists
  const testCustomer = await queryOne(
    'SELECT id FROM customers WHERE email = $1',
    ['standardhuman@gmail.com']
  );

  if (!testCustomer) {
    throw new Error('Test customer not found - run data seed script first');
  }
});

/**
 * Example 4: Validate database state after UI action
 */
test('submitting service request creates database record', async ({ page }) => {
  const testEmail = 'standardhuman@gmail.com';

  // Get current request count
  const initialCount = await queryValue(
    `SELECT COUNT(*) FROM service_requests sr
     JOIN customers c ON sr.customer_id = c.id
     WHERE c.email = $1`,
    [testEmail]
  );

  // Submit request via UI
  await page.goto('https://portal.sailorskills.com/portal-request-service');
  // ... fill form and submit ...

  // Verify database was updated
  const newCount = await queryValue(
    `SELECT COUNT(*) FROM service_requests sr
     JOIN customers c ON sr.customer_id = c.id
     WHERE c.email = $1`,
    [testEmail]
  );

  expect(parseInt(newCount)).toBe(parseInt(initialCount) + 1);

  // Verify the latest request has correct data
  const latestRequest = await queryOne(
    `SELECT sr.* FROM service_requests sr
     JOIN customers c ON sr.customer_id = c.id
     WHERE c.email = $1
     ORDER BY sr.created_at DESC
     LIMIT 1`,
    [testEmail]
  );

  expect(latestRequest.status).toBe('pending');
});

/**
 * Example 5: Check for data consistency issues
 */
test('database consistency check', async () => {
  // Find boats without customers
  const orphanedBoats = await queryAll(
    `SELECT b.id, b.name
     FROM boats b
     LEFT JOIN customers c ON b.customer_id = c.id
     WHERE c.id IS NULL`
  );

  expect(orphanedBoats.length).toBe(0);

  // Find service logs without boats
  const orphanedServices = await queryAll(
    `SELECT sl.id, sl.service_date
     FROM service_logs sl
     LEFT JOIN boats b ON sl.boat_id = b.id
     WHERE b.id IS NULL`
  );

  expect(orphanedServices.length).toBe(0);

  console.log('✓ Database consistency checks passed');
});

console.log(`
This file contains example patterns for integrating database queries
into Playwright tests. To use these patterns:

1. Copy the relevant test patterns into your actual test files
2. Import the db-query functions at the top of your test file:
   import { queryOne, queryAll, queryValue } from './scripts/test-helpers/db-query.mjs';

3. Use the queries to:
   - Setup test data before tests
   - Validate database state after UI actions
   - Clean up test data after tests
   - Verify data consistency

Note: These are example patterns, not runnable tests.
Integrate them into your actual Playwright test suite.
`);
