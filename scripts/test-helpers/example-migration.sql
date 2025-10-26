-- Example Migration: Add notes column to customers table
--
-- This is an example of a safe migration that:
-- 1. Adds a new column (doesn't break existing code)
-- 2. Makes it nullable (no data migration needed)
-- 3. Can be rolled back easily
--
-- To run:
--   node scripts/test-helpers/run-migration.mjs scripts/test-helpers/example-migration.sql --dry-run
--   node scripts/test-helpers/run-migration.mjs scripts/test-helpers/example-migration.sql

-- Add notes column to customers table
-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for searching notes (optional)
-- CREATE INDEX IF NOT EXISTS idx_customers_notes ON customers USING gin(to_tsvector('english', notes));

-- Add a comment
-- COMMENT ON COLUMN customers.notes IS 'Internal notes about the customer';

-- Example: Update existing data (optional)
-- UPDATE customers SET notes = 'Migrated from old system' WHERE created_at < '2025-01-01';

-- Example: Add a trigger (optional)
-- CREATE OR REPLACE FUNCTION update_customer_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER customer_updated_at
--   BEFORE UPDATE ON customers
--   FOR EACH ROW
--   EXECUTE FUNCTION update_customer_updated_at();

-- This migration is commented out so it can be used as a template
-- Uncomment the lines you want to run, or create your own migration file
