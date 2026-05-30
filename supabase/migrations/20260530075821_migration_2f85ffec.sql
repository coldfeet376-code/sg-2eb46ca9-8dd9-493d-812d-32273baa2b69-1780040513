-- Add a policy to allow authenticated users to update staff
CREATE POLICY "allow_authenticated_update_staff" ON staff
FOR UPDATE
TO authenticated
USING (true);