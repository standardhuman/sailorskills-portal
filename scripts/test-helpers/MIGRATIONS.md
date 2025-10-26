# Database Migrations Guide

How to safely run database migrations using Claude Code.

## 🚀 Quick Start

### Method 1: Using the Migration Runner (Recommended)

```bash
# 1. Create a migration file
cat > migrations/add_customer_notes.sql << 'EOF'
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN customers.notes IS 'Internal notes about the customer';
EOF

# 2. Test with dry-run
node scripts/test-helpers/run-migration.mjs migrations/add_customer_notes.sql --dry-run

# 3. Run the migration
node scripts/test-helpers/run-migration.mjs migrations/add_customer_notes.sql
```

### Method 2: Using psql Directly

```bash
# Load database connection
source db-env.sh

# Run migration file
psql "$DATABASE_URL" -f migrations/add_customer_notes.sql

# Or run inline SQL
psql "$DATABASE_URL" -c "ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;"
```

## 📋 Migration Best Practices

### ✅ Safe Migrations

**Add columns (nullable):**
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
```

**Add indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
```

**Add new tables:**
```sql
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Add constraints (with validation):**
```sql
-- Add constraint without validating existing data
ALTER TABLE customers ADD CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$') NOT VALID;

-- Validate in a separate step (can be done later)
ALTER TABLE customers VALIDATE CONSTRAINT valid_email;
```

### ⚠️ Risky Migrations

**Dropping columns (avoid - mark as deprecated instead):**
```sql
-- DON'T DO THIS:
-- ALTER TABLE customers DROP COLUMN old_field;

-- DO THIS INSTEAD:
COMMENT ON COLUMN customers.old_field IS 'DEPRECATED: Use new_field instead';
```

**Changing column types:**
```sql
-- Requires careful migration of existing data
-- 1. Add new column
ALTER TABLE customers ADD COLUMN phone_new BIGINT;

-- 2. Migrate data
UPDATE customers SET phone_new = phone::BIGINT WHERE phone ~ '^[0-9]+$';

-- 3. Check for errors
SELECT id, phone FROM customers WHERE phone_new IS NULL AND phone IS NOT NULL;

-- 4. After verification, rename columns
-- ALTER TABLE customers RENAME COLUMN phone TO phone_old;
-- ALTER TABLE customers RENAME COLUMN phone_new TO phone;
```

**Adding NOT NULL constraints:**
```sql
-- 1. Add column as nullable first
ALTER TABLE customers ADD COLUMN status TEXT;

-- 2. Backfill existing data
UPDATE customers SET status = 'active' WHERE status IS NULL;

-- 3. Add NOT NULL constraint
ALTER TABLE customers ALTER COLUMN status SET NOT NULL;
```

## 🛠️ Migration Runner Features

### Dry Run Mode
Test your migration without making changes:
```bash
node scripts/test-helpers/run-migration.mjs migrations/my-migration.sql --dry-run
```

### Transaction Mode (Default)
Runs in a transaction - rolls back on error:
```bash
node scripts/test-helpers/run-migration.mjs migrations/my-migration.sql
```

### No Transaction Mode
For migrations that can't run in transactions (like CREATE INDEX CONCURRENTLY):
```bash
node scripts/test-helpers/run-migration.mjs migrations/my-migration.sql --no-transaction
```

## 📝 Migration Workflow

### 1. Plan the Migration
```bash
# Check current schema
psql "$DATABASE_URL" -c "\d customers"

# Check existing data
node scripts/test-helpers/example-quick-query.mjs "SELECT * FROM customers LIMIT 1"
```

### 2. Write the Migration
Create a `.sql` file in a `migrations/` directory:

```sql
-- migrations/2025-10-26-add-customer-notes.sql
-- Description: Add notes field to customers table
-- Author: Claude Code
-- Date: 2025-10-26

-- Add column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment
COMMENT ON COLUMN customers.notes IS 'Internal notes about the customer';

-- Add index if needed
CREATE INDEX IF NOT EXISTS idx_customers_notes
ON customers USING gin(to_tsvector('english', notes));
```

### 3. Test with Dry Run
```bash
node scripts/test-helpers/run-migration.mjs migrations/2025-10-26-add-customer-notes.sql --dry-run
```

### 4. Run the Migration
```bash
node scripts/test-helpers/run-migration.mjs migrations/2025-10-26-add-customer-notes.sql
```

### 5. Verify the Migration
```bash
# Check schema changed
psql "$DATABASE_URL" -c "\d customers"

# Test the new column
node scripts/test-helpers/example-quick-query.mjs "SELECT id, email, notes FROM customers LIMIT 5"
```

### 6. Document the Migration
Update `MIGRATION_SUMMARY.md` at the repo root:
```markdown
## 2025-10-26 - Add Customer Notes
- Added `notes` TEXT column to `customers` table
- Added full-text search index on notes
- Affected services: Operations, Portal, Dashboard
```

## 🔒 Safety Features

### Transactions (Default)
- All changes are wrapped in a transaction
- If anything fails, everything is rolled back
- No partial migrations

### Idempotent Migrations
Always use `IF NOT EXISTS` and `IF EXISTS`:
```sql
-- Good - can run multiple times safely
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_email ON customers(email);

-- Bad - will fail if run twice
ALTER TABLE customers ADD COLUMN notes TEXT;
CREATE INDEX idx_email ON customers(email);
```

## 📊 Common Migration Patterns

### Add Column with Default Value
```sql
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
```

### Create Table with Foreign Key
```sql
CREATE TABLE IF NOT EXISTS customer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer_id
ON customer_preferences(customer_id);
```

### Add RLS Policies
```sql
-- Enable RLS
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;

-- Add policy for customers to see only their own preferences
CREATE POLICY customer_preferences_select_policy ON customer_preferences
  FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY customer_preferences_update_policy ON customer_preferences
  FOR UPDATE
  USING (customer_id = auth.uid());
```

### Create Function
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_preferences_updated_at
  BEFORE UPDATE ON customer_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 🐛 Troubleshooting

### Migration Failed - What Now?

**If using transaction mode (default):**
- ✅ No changes were made (automatic rollback)
- Fix the SQL and try again

**If using --no-transaction:**
- ⚠️ Partial changes may have been made
- Check what succeeded: `\d table_name`
- Manually revert if needed
- Fix and re-run

### Common Errors

**"column already exists"**
- Use `IF NOT EXISTS` clause
- Check if migration was already run

**"constraint violation"**
- Existing data doesn't meet new constraint
- Migrate data first, then add constraint

**"syntax error"**
- Check SQL syntax
- Test in dry-run mode first
- Run smaller chunks separately

## 📚 Resources

- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
- [Supabase Migrations](https://supabase.com/docs/guides/database/migrations)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## ✅ Migration Checklist

Before running a migration:
- [ ] Test with `--dry-run` first
- [ ] Use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- [ ] Consider impact on running applications
- [ ] Have a rollback plan
- [ ] Document in MIGRATION_SUMMARY.md
- [ ] Verify affected services still work

---

**You can now safely run database migrations from Claude Code!** 🚀
