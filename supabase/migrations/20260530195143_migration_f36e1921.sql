-- COMPLETE RLS RESET - Drop all policies and start fresh
-- STAFF TABLE
DO $$ 
BEGIN
  -- Drop all existing policies on staff
  DROP POLICY IF EXISTS "staff_select_all" ON staff;
  DROP POLICY IF EXISTS "staff_insert_all" ON staff;
  DROP POLICY IF EXISTS "staff_update_all" ON staff;
  DROP POLICY IF EXISTS "staff_delete_all" ON staff;
  DROP POLICY IF EXISTS "Enable read access for all users" ON staff;
  DROP POLICY IF EXISTS "authenticated_insert_staff" ON staff;
  DROP POLICY IF EXISTS "authenticated_update_staff" ON staff;
  DROP POLICY IF EXISTS "authenticated_delete_staff" ON staff;
END $$;