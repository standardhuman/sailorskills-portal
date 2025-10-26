#!/usr/bin/env node

/**
 * Database Query Utility for Supabase Testing
 *
 * This utility provides functions to execute SQL queries against your Supabase database
 * using the node-postgres (pg) library. Perfect for automated testing and data validation.
 *
 * Setup:
 * 1. Get your database connection string from Supabase Dashboard:
 *    - Go to Project Settings → Database → Connection String
 *    - Choose "Session mode" (port 5432) for long-lived connections
 *    - Or "Transaction mode" (port 6543) for serverless/transient connections
 *
 * 2. Add to your .env file:
 *    DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres
 *
 * Usage:
 *    import { query, queryOne, queryAll } from './scripts/test-helpers/db-query.mjs';
 *
 *    // Execute any SQL query
 *    const result = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
 *
 *    // Get single row (returns null if not found)
 *    const customer = await queryOne('SELECT * FROM customers WHERE email = $1', ['test@example.com']);
 *
 *    // Get all rows
 *    const customers = await queryAll('SELECT * FROM customers LIMIT 10');
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env') });

/**
 * Creates a new database client connection
 * @returns {Client} PostgreSQL client instance
 */
export function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL not found in environment variables.\n\n' +
      'To get your connection string:\n' +
      '1. Go to Supabase Dashboard → Project Settings → Database\n' +
      '2. Copy the connection string (Session mode recommended)\n' +
      '3. Add to .env file: DATABASE_URL=postgresql://...\n'
    );
  }

  return new Client({
    connectionString,
    // SSL is required for Supabase
    ssl: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Execute a SQL query and return the full result object
 * @param {string} sql - SQL query string (use $1, $2, etc. for parameters)
 * @param {Array} params - Query parameters (optional)
 * @returns {Promise<Object>} pg result object with rows, rowCount, etc.
 *
 * @example
 * const result = await query('SELECT * FROM customers WHERE id = $1', [123]);
 * console.log(result.rows); // Array of rows
 * console.log(result.rowCount); // Number of rows
 */
export async function query(sql, params = []) {
  const client = createClient();

  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result;
  } catch (error) {
    console.error('Query error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Execute a query and return all rows as an array
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters (optional)
 * @returns {Promise<Array>} Array of row objects
 *
 * @example
 * const customers = await queryAll('SELECT * FROM customers LIMIT 10');
 * customers.forEach(c => console.log(c.name));
 */
export async function queryAll(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Execute a query and return only the first row (or null if no results)
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters (optional)
 * @returns {Promise<Object|null>} First row object or null
 *
 * @example
 * const customer = await queryOne('SELECT * FROM customers WHERE email = $1', ['test@example.com']);
 * if (customer) console.log(customer.name);
 */
export async function queryOne(sql, params = []) {
  const result = await query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Execute a query and return a single value from the first row
 * Useful for COUNT, SUM, and other aggregate queries
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters (optional)
 * @returns {Promise<any>} Single value from first column of first row
 *
 * @example
 * const count = await queryValue('SELECT COUNT(*) FROM customers');
 * console.log(`Total customers: ${count}`);
 */
export async function queryValue(sql, params = []) {
  const result = await query(sql, params);
  if (result.rows.length === 0) return null;
  const firstRow = result.rows[0];
  const firstKey = Object.keys(firstRow)[0];
  return firstRow[firstKey];
}

/**
 * Check if a table exists in the database
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} True if table exists
 *
 * @example
 * const exists = await tableExists('customers');
 * if (!exists) throw new Error('customers table not found!');
 */
export async function tableExists(tableName) {
  const result = await queryValue(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    )`,
    [tableName]
  );
  return result === true;
}

/**
 * Get the count of rows in a table (with optional WHERE clause)
 * @param {string} tableName - Name of the table
 * @param {string} whereClause - Optional WHERE clause (without the WHERE keyword)
 * @param {Array} params - Parameters for WHERE clause
 * @returns {Promise<number>} Row count
 *
 * @example
 * const total = await countRows('customers');
 * const active = await countRows('customers', 'status = $1', ['active']);
 */
export async function countRows(tableName, whereClause = '', params = []) {
  const sql = whereClause
    ? `SELECT COUNT(*) FROM ${tableName} WHERE ${whereClause}`
    : `SELECT COUNT(*) FROM ${tableName}`;

  const count = await queryValue(sql, params);
  return parseInt(count, 10);
}

/**
 * Execute multiple queries in a transaction
 * All queries succeed or all fail together
 * @param {Function} callback - Async function that receives a transaction client
 * @returns {Promise<any>} Result from callback
 *
 * @example
 * await transaction(async (client) => {
 *   await client.query('UPDATE customers SET balance = balance - 100 WHERE id = 1');
 *   await client.query('UPDATE customers SET balance = balance + 100 WHERE id = 2');
 * });
 */
export async function transaction(callback) {
  const client = createClient();

  try {
    await client.connect();
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// If run directly, test the connection
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing database connection...\n');

  try {
    // Test basic connection
    const client = createClient();
    await client.connect();
    console.log('✓ Connected to database successfully');

    // Test simple query
    const result = await client.query('SELECT NOW() as current_time, current_database() as database');
    console.log('✓ Query executed successfully');
    console.log('  Database:', result.rows[0].database);
    console.log('  Server time:', result.rows[0].current_time);

    await client.end();

    // Test helper functions
    console.log('\nTesting helper functions...');
    const tables = await queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
      LIMIT 10
    `);

    console.log('✓ Found', tables.length, 'tables:');
    tables.forEach(t => console.log('  -', t.table_name));

    console.log('\n✓ All tests passed! Database connection is working.\n');

  } catch (error) {
    console.error('\n✗ Connection test failed:', error.message);
    process.exit(1);
  }
}
