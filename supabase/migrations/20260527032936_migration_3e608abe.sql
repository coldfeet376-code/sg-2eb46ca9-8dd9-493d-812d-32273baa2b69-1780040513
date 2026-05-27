-- Phase 1: Add version columns for optimistic locking (only existing tables)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE managers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Phase 2: Add indexes for pagination performance
CREATE INDEX IF NOT EXISTS idx_availability_date_range ON availability(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_week ON assignments(week_start);
CREATE INDEX IF NOT EXISTS idx_manager_availability_date_range ON manager_availability(manager_id, date);

-- Phase 3: Fix RLS policies to require authentication
-- Note: Some tables already have proper auth policies (rotas, audit_log, invitations)
-- We only need to fix the tables with public access (staff, availability, task_config, assignments, etc.)

-- Staff table
DROP POLICY IF EXISTS "public_read_staff" ON staff;
DROP POLICY IF EXISTS "public_insert_staff" ON staff;
DROP POLICY IF EXISTS "public_update_staff" ON staff;
DROP POLICY IF EXISTS "public_delete_staff" ON staff;

CREATE POLICY "authenticated_read_staff" ON staff
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_staff" ON staff
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_staff" ON staff
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_staff" ON staff
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Availability table
DROP POLICY IF EXISTS "public_read_availability" ON availability;
DROP POLICY IF EXISTS "public_insert_availability" ON availability;
DROP POLICY IF EXISTS "public_update_availability" ON availability;
DROP POLICY IF EXISTS "public_delete_availability" ON availability;

CREATE POLICY "authenticated_read_availability" ON availability
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_availability" ON availability
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_availability" ON availability
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_availability" ON availability
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Task config table
DROP POLICY IF EXISTS "public_read_task_config" ON task_config;
DROP POLICY IF EXISTS "public_insert_task_config" ON task_config;
DROP POLICY IF EXISTS "public_update_task_config" ON task_config;
DROP POLICY IF EXISTS "public_delete_task_config" ON task_config;

CREATE POLICY "authenticated_read_task_config" ON task_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_task_config" ON task_config
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_task_config" ON task_config
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_task_config" ON task_config
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Assignments table
DROP POLICY IF EXISTS "public_read_assignments" ON assignments;
DROP POLICY IF EXISTS "public_insert_assignments" ON assignments;
DROP POLICY IF EXISTS "public_update_assignments" ON assignments;
DROP POLICY IF EXISTS "public_delete_assignments" ON assignments;

CREATE POLICY "authenticated_read_assignments" ON assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_assignments" ON assignments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_assignments" ON assignments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_assignments" ON assignments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Rota backups table
DROP POLICY IF EXISTS "public_read_backups" ON rota_backups;
DROP POLICY IF EXISTS "public_insert_backups" ON rota_backups;
DROP POLICY IF EXISTS "public_update_backups" ON rota_backups;
DROP POLICY IF EXISTS "public_delete_backups" ON rota_backups;

CREATE POLICY "authenticated_read_rota_backups" ON rota_backups
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_rota_backups" ON rota_backups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_rota_backups" ON rota_backups
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Managers table
DROP POLICY IF EXISTS "public_read_managers" ON managers;
DROP POLICY IF EXISTS "public_insert_managers" ON managers;
DROP POLICY IF EXISTS "public_update_managers" ON managers;
DROP POLICY IF EXISTS "public_delete_managers" ON managers;

CREATE POLICY "authenticated_read_managers" ON managers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_managers" ON managers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_managers" ON managers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_managers" ON managers
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Manager availability table
DROP POLICY IF EXISTS "public_read_manager_availability" ON manager_availability;
DROP POLICY IF EXISTS "public_insert_manager_availability" ON manager_availability;
DROP POLICY IF EXISTS "public_update_manager_availability" ON manager_availability;
DROP POLICY IF EXISTS "public_delete_manager_availability" ON manager_availability;

CREATE POLICY "authenticated_read_manager_availability" ON manager_availability
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_manager_availability" ON manager_availability
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_manager_availability" ON manager_availability
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_manager_availability" ON manager_availability
  FOR DELETE USING (auth.uid() IS NOT NULL);