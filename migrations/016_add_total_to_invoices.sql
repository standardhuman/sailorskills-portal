-- Migration 016: Add total column to invoices
-- Date: 2025-10-27
-- Service: Portal, Billing, Dashboard
-- Tables: invoices
--
-- Purpose:
-- Add total column as computed/generated column that mirrors amount.
-- This provides expected column name for schema validation and Portal display.
--
-- Impact:
-- - Portal invoice display works with expected 'total' column
-- - Dashboard revenue calculations can use 'total'
-- - Maintains compatibility with existing 'amount' column

-- =============================================================================
-- ADD COMPUTED COLUMN
-- =============================================================================

-- Add total as generated column (automatically stays in sync with amount)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS total NUMERIC
GENERATED ALWAYS AS (amount) STORED;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_total_count INT;
  v_mismatch_count INT;
BEGIN
  -- Check if column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'invoices'
    AND column_name = 'total'
  ) INTO v_column_exists;

  IF v_column_exists THEN
    -- Count invoices with total
    SELECT COUNT(*) INTO v_total_count
    FROM invoices
    WHERE total IS NOT NULL;

    -- Count any mismatches (should be zero for computed column)
    SELECT COUNT(*) INTO v_mismatch_count
    FROM invoices
    WHERE total != amount;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 016 Verification';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ total column added to invoices';
    RAISE NOTICE '✅ Column is GENERATED (auto-syncs with amount)';
    RAISE NOTICE '✅ % invoices have total populated', v_total_count;
    IF v_mismatch_count > 0 THEN
      RAISE EXCEPTION '❌ Found % invoices where total != amount', v_mismatch_count;
    ELSE
      RAISE NOTICE '✅ All invoices: total = amount (verified)';
    END IF;
    RAISE NOTICE '========================================';
  ELSE
    RAISE EXCEPTION 'Column total was not created';
  END IF;
END $$;
