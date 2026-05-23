-- Drop existing admin policies that only recognize admin@*
DROP POLICY IF EXISTS admin_insert ON invitations;
DROP POLICY IF EXISTS admin_update ON invitations;
DROP POLICY IF EXISTS admin_view_all ON invitations;

-- Recreate policies to include coldfeet376@gmail.com as admin
CREATE POLICY admin_insert ON invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email ILIKE 'admin@%'
        OR auth.users.email = 'coldfeet376@gmail.com'
      )
    )
  );

CREATE POLICY admin_update ON invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email ILIKE 'admin@%'
        OR auth.users.email = 'coldfeet376@gmail.com'
      )
    )
  );

CREATE POLICY admin_view_all ON invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email ILIKE 'admin@%'
        OR auth.users.email = 'coldfeet376@gmail.com'
      )
    )
  );