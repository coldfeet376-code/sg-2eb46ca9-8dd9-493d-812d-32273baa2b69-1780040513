-- Create the SIMPLEST possible policies - allow ANY authenticated user EVERYTHING
-- STAFF TABLE
CREATE POLICY "allow_all_authenticated_staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);