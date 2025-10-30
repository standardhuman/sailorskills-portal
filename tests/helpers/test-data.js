import { queryDatabase, queryOne } from "./db-utils.js";

/**
 * Test Data Management Utilities
 *
 * Helpers for creating and cleaning up test data
 */

// Generate unique test run ID for this test session
export const TEST_RUN_ID = process.env.TEST_RUN_ID || `test-${Date.now()}`;

/**
 * Create a test customer
 *
 * @param {Object} overrides - Optional field overrides
 * @returns {Promise<string>} Customer ID
 */
export async function createTestCustomer(overrides = {}) {
  const defaults = {
    email: `test-${Date.now()}@example.test`,
    name: "Test Customer",
    is_test: true,
    test_scenario_id: TEST_RUN_ID,
  };

  const data = { ...defaults, ...overrides };

  const customer = await queryOne(
    `INSERT INTO customers (email, name, is_test, test_scenario_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [data.email, data.name, data.is_test, data.test_scenario_id],
  );

  return customer.id;
}

/**
 * Create a test service log
 *
 * @param {Object} overrides - Optional field overrides
 * @returns {Promise<Object>} Service log record
 */
export async function createTestServiceLog(overrides = {}) {
  const defaults = {
    customer_id: overrides.customer_id,
    service_type: "Test Service",
    status: "pending",
    is_test: true,
    test_scenario_id: TEST_RUN_ID,
  };

  const data = { ...defaults, ...overrides };

  const serviceLog = await queryOne(
    `INSERT INTO service_logs (customer_id, service_type, status, is_test, test_scenario_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.customer_id,
      data.service_type,
      data.status,
      data.is_test,
      data.test_scenario_id,
    ],
  );

  return serviceLog;
}

/**
 * Create a test invoice
 *
 * @param {Object} overrides - Optional field overrides
 * @returns {Promise<Object>} Invoice record
 */
export async function createTestInvoice(overrides = {}) {
  const defaults = {
    customer_id: overrides.customer_id,
    amount: 100.0,
    status: "pending",
    is_test: true,
    test_scenario_id: TEST_RUN_ID,
  };

  const data = { ...defaults, ...overrides };

  const invoice = await queryOne(
    `INSERT INTO invoices (customer_id, amount, status, is_test, test_scenario_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.customer_id,
      data.amount,
      data.status,
      data.is_test,
      data.test_scenario_id,
    ],
  );

  return invoice;
}

/**
 * Clean up all data for a specific customer
 *
 * @param {string} customerId - Customer ID to clean up
 */
export async function cleanupTestData(customerId) {
  // Delete in correct order (respect foreign keys)
  await queryDatabase("DELETE FROM invoices WHERE customer_id = $1", [
    customerId,
  ]);
  await queryDatabase("DELETE FROM service_logs WHERE customer_id = $1", [
    customerId,
  ]);
  await queryDatabase("DELETE FROM boats WHERE customer_id = $1", [customerId]);
  await queryDatabase("DELETE FROM customers WHERE id = $1", [customerId]);
}

/**
 * Clean up all test data from current test run
 */
export async function cleanupAllTestData() {
  const testRunId = TEST_RUN_ID;

  // Delete all test data from this run
  await queryDatabase("DELETE FROM invoices WHERE test_scenario_id = $1", [
    testRunId,
  ]);
  await queryDatabase("DELETE FROM service_logs WHERE test_scenario_id = $1", [
    testRunId,
  ]);
  await queryDatabase("DELETE FROM boats WHERE test_scenario_id = $1", [
    testRunId,
  ]);
  await queryDatabase("DELETE FROM customers WHERE test_scenario_id = $1", [
    testRunId,
  ]);
}

/**
 * Clean up all test data (use with caution!)
 */
export async function cleanupAllTestDataEverywhere() {
  await queryDatabase("DELETE FROM customers WHERE is_test = true");
}
