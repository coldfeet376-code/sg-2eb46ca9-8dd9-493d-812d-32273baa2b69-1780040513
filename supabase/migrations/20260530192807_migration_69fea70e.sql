-- Create simple, permissive policies for staff table
-- Allow ALL authenticated users full access (no user_id checks)
CREATE POLICY "staff_select_all" ON staff
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "staff_insert_all" ON staff
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "staff_update_all" ON staff
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "staff_delete_all" ON staff
  FOR DELETE
  TO authenticated
  USING (true);