-- Fix task_config RLS: Allow public read, require auth for write
-- This allows rota generation to work without authentication timing issues

-- Drop the restrictive authenticated read policy
DROP POLICY IF EXISTS authenticated_read_task_config ON task_config;

-- Create public read policy (task config is not sensitive data)
CREATE POLICY public_read_task_config ON task_config 
  FOR SELECT 
  USING (true);

-- Verify all policies on task_config
SELECT policyname, cmd, qual::text, with_check::text 
FROM pg_policies 
WHERE tablename = 'task_config'
ORDER BY policyname;