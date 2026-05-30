-- AVAILABILITY TABLE
CREATE POLICY "allow_all_authenticated_availability"
  ON availability
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);