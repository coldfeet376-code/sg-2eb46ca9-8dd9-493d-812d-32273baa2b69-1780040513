-- Add a policy to allow authenticated users to read all staff
CREATE POLICY "allow_authenticated_read_staff" ON staff
FOR SELECT
TO authenticated
USING (true);