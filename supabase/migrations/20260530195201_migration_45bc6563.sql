-- AVAILABILITY TABLE
DO $$ 
BEGIN
  -- Drop all existing policies on availability
  DROP POLICY IF EXISTS "availability_select_all" ON availability;
  DROP POLICY IF EXISTS "availability_insert_all" ON availability;
  DROP POLICY IF EXISTS "availability_update_all" ON availability;
  DROP POLICY IF EXISTS "availability_delete_all" ON availability;
  DROP POLICY IF EXISTS "Enable read access for all users" ON availability;
  DROP POLICY IF EXISTS "authenticated_insert_availability" ON availability;
  DROP POLICY IF EXISTS "authenticated_update_availability" ON availability;
  DROP POLICY IF EXISTS "authenticated_delete_availability" ON availability;
  DROP POLICY IF EXISTS "auth_insert" ON availability;
  DROP POLICY IF EXISTS "auth_update" ON availability;
  DROP POLICY IF EXISTS "auth_delete" ON availability;
END $$;