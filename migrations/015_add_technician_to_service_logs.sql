-- Migration 015: Add technician column to service_logs
-- Date: 2025-10-27
-- Service: Portal, Operations
-- Tables: service_logs
--
-- Purpose:
-- Add technician field to service logs for tracking which technician
-- performed the service. Backfills from existing created_by field.
--
-- Impact:
-- - Portal can display technician name in service history
-- - Operations can filter services by technician
-- - Dashboard can generate technician performance reports

-- =============================================================================
-- ADD COLUMN
-- =============================================================================

ALTER TABLE service_logs
ADD COLUMN IF NOT EXISTS technician TEXT;

-- =============================================================================
-- BACKFILL DATA
-- =============================================================================

-- Copy existing created_by values to technician
UPDATE service_logs
SET technician = created_by
WHERE technician IS NULL AND created_by IS NOT NULL;

-- =============================================================================
-- ADD INDEX FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_service_logs_technician
ON service_logs(technician);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_backfilled_count INT;
  v_null_count INT;
BEGIN
  -- Check if column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'service_logs'
    AND column_name = 'technician'
  ) INTO v_column_exists;

  IF v_column_exists THEN
    -- Count backfilled records
    SELECT COUNT(*) INTO v_backfilled_count
    FROM service_logs
    WHERE technician IS NOT NULL;

    -- Count null technicians
    SELECT COUNT(*) INTO v_null_count
    FROM service_logs
    WHERE technician IS NULL;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 015 Verification';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ technician column added to service_logs';
    RAISE NOTICE '✅ % records have technician populated', v_backfilled_count;
    IF v_null_count > 0 THEN
      RAISE NOTICE '⚠️  % records have NULL technician', v_null_count;
    ELSE
      RAISE NOTICE '✅ All records have technician populated';
    END IF;
    RAISE NOTICE '✅ Index idx_service_logs_technician created';
    RAISE NOTICE '========================================';
  ELSE
    RAISE EXCEPTION 'Column technician was not created';
  END IF;
END $$;
