# Database Testing Utilities

SQL query utilities for testing and automating Supabase database operations in Claude Code.

## 🎯 Purpose

These utilities enable you to run SQL queries against your Supabase database from:
- Command line (for quick testing)
- Node.js scripts (for automation)
- Playwright tests (for data validation)

## 📋 Setup

### 1. Get Your Database Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **Sailor Skills**
3. Go to **Project Settings** → **Database**
4. Click **Connection String** tab
5. Choose **Session mode** (port 5432) - recommended for testing
6. Copy the connection string (format: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@...`)

### 2. Add to Environment Variables

Add the connection string to your `.env` file:

```bash
DATABASE_URL=postgresql://postgres.fzygakldvvzxmahkdylq:[YOUR_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

> **Note:** Replace `[YOUR_PASSWORD]` with your actual database password from the dashboard.

### 3. Test the Connection

Run the test connection script:

```bash
node scripts/test-helpers/db-query.mjs
```

If successful, you should see:
```
✓ Connected to database successfully
✓ Query executed successfully
  Database: postgres
  Server time: 2025-10-26...
✓ All tests passed!
```

## 🛠 Available Utilities

### Core Query Functions (`db-query.mjs`)

```javascript
import { query, queryOne, queryAll, queryValue } from './scripts/test-helpers/db-query.mjs';
```

**`query(sql, params)`** - Execute SQL and return full result object
```javascript
const result = await query('SELECT * FROM customers WHERE id = $1', [123]);
console.log(result.rows, result.rowCount);
```

**`queryAll(sql, params)`** - Return all rows as array
```javascript
const customers = await queryAll('SELECT * FROM customers LIMIT 10');
customers.forEach(c => console.log(c.name));
```

**`queryOne(sql, params)`** - Return first row (or null)
```javascript
const customer = await queryOne('SELECT * FROM customers WHERE email = $1', ['test@example.com']);
if (customer) console.log(customer.name);
```

**`queryValue(sql, params)`** - Return single value
```javascript
const count = await queryValue('SELECT COUNT(*) FROM customers');
console.log(`Total: ${count}`);
```

**`tableExists(tableName)`** - Check if table exists
```javascript
const exists = await tableExists('customers');
```

**`countRows(tableName, whereClause, params)`** - Count rows in table
```javascript
const total = await countRows('customers');
const active = await countRows('customers', 'status = $1', ['active']);
```

**`transaction(callback)`** - Execute multiple queries in transaction
```javascript
await transaction(async (client) => {
  await client.query('UPDATE customers SET balance = balance - 100 WHERE id = 1');
  await client.query('UPDATE customers SET balance = balance + 100 WHERE id = 2');
});
```

## 📝 Example Scripts

### 1. Verify Customer Data
```bash
node scripts/test-helpers/example-verify-customer.mjs standardhuman@gmail.com
```

Checks:
- Customer exists
- Boats associated with customer
- Service history
- Invoice totals

### 2. Check Database Schema
```bash
node scripts/test-helpers/example-check-schema.mjs
```

Validates:
- All required tables exist
- Required columns are present
- Schema integrity

### 3. Run Quick SQL Query
```bash
node scripts/test-helpers/example-quick-query.mjs "SELECT * FROM customers LIMIT 5"
```

Execute any SQL query from command line with formatted output.

### 4. Playwright Integration

See `example-playwright-integration.mjs` for patterns:
- Setup test data before tests
- Validate database state after UI actions
- Clean up test data
- Check data consistency

## 🔒 Alternative: Using psql

You can also run queries using the PostgreSQL `psql` command-line tool:

### One-time Query
```bash
psql "$DATABASE_URL" -c "SELECT * FROM customers LIMIT 5"
```

### Interactive Session
```bash
psql "$DATABASE_URL"
```

Then run SQL interactively:
```sql
postgres=> SELECT COUNT(*) FROM customers;
postgres=> \dt  -- list all tables
postgres=> \d customers  -- describe customers table
postgres=> \q  -- quit
```

### Common psql Commands
- `\dt` - List all tables
- `\d table_name` - Describe table structure
- `\l` - List databases
- `\q` - Quit
- `\?` - Help

## 🚀 Usage in Playwright Tests

### Import in your test file:
```javascript
import { queryOne, queryAll, queryValue } from './scripts/test-helpers/db-query.mjs';
```

### Example: Verify data before test
```javascript
test('customer portal shows correct data', async ({ page }) => {
  // Get expected data from database
  const customer = await queryOne(
    'SELECT * FROM customers WHERE email = $1',
    ['standardhuman@gmail.com']
  );

  const boatCount = await queryValue(
    'SELECT COUNT(*) FROM boats WHERE customer_id = $1',
    [customer.id]
  );

  // Test UI matches database
  await page.goto('https://portal.sailorskills.com/portal');
  await expect(page.locator('.boat-card')).toHaveCount(parseInt(boatCount));
});
```

## 🔐 Security Notes

- Never commit `.env` file with real credentials
- Use read-only queries when possible
- Database password is different from API keys
- Connection uses SSL for security
- Suitable for testing/development, not production client-side code

## 📚 Common Queries

### Check customer exists
```javascript
const customer = await queryOne(
  'SELECT * FROM customers WHERE email = $1',
  ['standardhuman@gmail.com']
);
```

### Get boat count
```javascript
const count = await queryValue(
  'SELECT COUNT(*) FROM boats WHERE customer_id = $1',
  [customerId]
);
```

### List recent services
```javascript
const services = await queryAll(
  `SELECT sl.*, b.name as boat_name
   FROM service_logs sl
   JOIN boats b ON sl.boat_id = b.id
   WHERE b.customer_id = $1
   ORDER BY sl.service_date DESC
   LIMIT 10`,
  [customerId]
);
```

### Check invoice total
```javascript
const total = await queryValue(
  'SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = $1',
  [customerId]
);
```

## 🔄 Running Migrations

You can run database migrations directly from Claude Code!

### Quick Start

```bash
# 1. Create a migration file
cat > migrations/add_column.sql << 'EOF'
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
EOF

# 2. Test with dry-run
node scripts/test-helpers/run-migration.mjs migrations/add_column.sql --dry-run

# 3. Run the migration
node scripts/test-helpers/run-migration.mjs migrations/add_column.sql
```

### Or use psql directly

```bash
source db-env.sh
psql "$DATABASE_URL" -f migrations/add_column.sql
```

### Features

- **Transaction support** - Automatic rollback on error (default)
- **Dry-run mode** - Test migrations without making changes
- **Idempotent** - Use `IF NOT EXISTS` to run safely multiple times
- **Safe** - All changes logged and verified

### Full Documentation

See `MIGRATIONS.md` in this directory for:
- Migration best practices
- Common patterns (add columns, indexes, tables)
- Safety guidelines
- Rollback strategies
- Complete examples

## 🐛 Troubleshooting

### "DATABASE_URL not found"
- Make sure DATABASE_URL is in your `.env` file
- Check the connection string format is correct

### "Connection refused"
- Verify your database password is correct
- Check you're using the right connection string (Session mode recommended)
- Ensure your IP is allowed in Supabase dashboard

### "relation does not exist"
- Table name might be wrong (check spelling)
- Table might not exist (run schema check script)
- Check you're connected to the right database

### "SSL connection required"
- Connection requires SSL (this is configured automatically)
- Don't use `sslmode=disable` with Supabase

## 📖 Resources

- [Supabase Database Docs](https://supabase.com/docs/guides/database)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres (pg) Documentation](https://node-postgres.com/)

---

**Part of the Sailorskills testing infrastructure**
