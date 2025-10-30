import pg from "pg";

/**
 * Database Utilities for Testing
 *
 * Provides helpers for database queries in tests
 */

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Execute a parameterized query
 *
 * @param {string} query - SQL query with $1, $2, etc. placeholders
 * @param {Array} params - Array of parameters
 * @returns {Promise<Array>} Query results
 */
export async function queryDatabase(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return a single row
 *
 * @param {string} query - SQL query
 * @param {Array} params - Array of parameters
 * @returns {Promise<Object|null>} Single row or null
 */
export async function queryOne(query, params = []) {
  const results = await queryDatabase(query, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute multiple queries in a transaction
 *
 * @param {Function} callback - Async function that receives client
 * @returns {Promise<any>} Result from callback
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the connection pool
 */
export async function closePool() {
  await pool.end();
}
