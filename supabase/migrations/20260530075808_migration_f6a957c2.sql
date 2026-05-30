-- Add a policy to allow authenticated users to insert staff
CREATE POLICY "allow_authenticated_insert_staff" ON staff
FOR INSERT
TO authenticated
WITH CHECK (true);