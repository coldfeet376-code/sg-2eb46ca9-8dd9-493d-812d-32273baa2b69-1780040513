-- Add a policy to allow authenticated users to delete staff
CREATE POLICY "allow_authenticated_delete_staff" ON staff
FOR DELETE
TO authenticated
USING (true);