-- Create ONLY ONE policy per table - the simplest possible
CREATE POLICY "authenticated_all_staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all_availability"
  ON availability
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);