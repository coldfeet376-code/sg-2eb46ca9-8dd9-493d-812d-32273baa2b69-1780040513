-- Drop existing policies that query auth.users table
DROP POLICY IF EXISTS admin_insert ON invitations;
DROP POLICY IF EXISTS admin_update ON invitations;
DROP POLICY IF EXISTS admin_view_all ON invitations;

-- Recreate policies using auth.jwt() to safely access user email
CREATE POLICY admin_insert ON invitations FOR INSERT
  WITH CHECK (
    (auth.jwt()->>'email')::text ILIKE 'admin@%' OR 
    (auth.jwt()->>'email')::text = 'coldfeet376@gmail.com'
  );

CREATE POLICY admin_update ON invitations FOR UPDATE
  USING (
    (auth.jwt()->>'email')::text ILIKE 'admin@%' OR 
    (auth.jwt()->>'email')::text = 'coldfeet376@gmail.com'
  );

CREATE POLICY admin_view_all ON invitations FOR SELECT
  USING (
    (auth.jwt()->>'email')::text ILIKE 'admin@%' OR 
    (auth.jwt()->>'email')::text = 'coldfeet376@gmail.com'
  );