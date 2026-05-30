-- AVAILABILITY TABLE - Remove all old policies
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'availability'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON availability', pol.policyname);
  END LOOP;
END $$;