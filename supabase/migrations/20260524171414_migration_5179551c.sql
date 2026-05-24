-- Add SELECT policy to availability table so frontend can read the data
CREATE POLICY "allow_authenticated_select" ON availability
  FOR SELECT
  USING (auth.uid() IS NOT NULL);