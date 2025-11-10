-- Grant Portal Access to All Boat Owners
-- This script creates customer_accounts and grants boat access for all customers who own boats

-- Step 1: Create customer_accounts for customers who don't have portal accounts yet
INSERT INTO customer_accounts (id, email, magic_link_enabled, password_enabled, is_admin)
SELECT
  gen_random_uuid() as id,
  c.email,
  true as magic_link_enabled,
  false as password_enabled,
  false as is_admin
FROM customers c
WHERE c.is_test = false
  AND c.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customer_accounts ca WHERE ca.email = c.email
  )
ON CONFLICT (email) DO NOTHING;

-- Step 2: Grant boat access to all customers for their boats
-- Uses the customer's email to match customer_accounts to boats via customers table
INSERT INTO customer_boat_access (customer_account_id, boat_id, is_primary)
SELECT
  ca.id as customer_account_id,
  b.id as boat_id,
  (ROW_NUMBER() OVER (PARTITION BY ca.id ORDER BY b.created_at ASC) = 1) as is_primary
FROM boats b
JOIN customers c ON b.customer_id = c.id
JOIN customer_accounts ca ON ca.email = c.email
WHERE c.is_test = false
  AND NOT EXISTS (
    SELECT 1
    FROM customer_boat_access cba
    WHERE cba.customer_account_id = ca.id
    AND cba.boat_id = b.id
  )
ON CONFLICT (customer_account_id, boat_id) DO NOTHING;

-- Step 3: Report results
SELECT
  'Summary' as report_type,
  COUNT(DISTINCT ca.id) as total_customer_accounts,
  COUNT(DISTINCT cba.boat_id) as total_boats_with_access,
  COUNT(DISTINCT c.id) as total_customers_with_boats
FROM customers c
JOIN boats b ON c.id = b.customer_id
JOIN customer_accounts ca ON ca.email = c.email
LEFT JOIN customer_boat_access cba ON ca.id = cba.customer_account_id
WHERE c.is_test = false;
