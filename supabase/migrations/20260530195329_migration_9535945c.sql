-- NUCLEAR OPTION: Drop ALL policies on staff and availability, then recreate ONLY the simple ones
-- STAFF TABLE - Remove all old policies
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'staff'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON staff', pol.policyname);
  END LOOP;
END $$;