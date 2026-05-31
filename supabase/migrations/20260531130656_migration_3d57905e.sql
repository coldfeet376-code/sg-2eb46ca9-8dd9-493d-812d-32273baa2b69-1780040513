-- Drop all existing restrictive policies and grant full access to authenticated users
-- This removes data isolation and security boundaries

-- Staff table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON staff;
DROP POLICY IF EXISTS "authenticated_all_staff" ON staff;
CREATE POLICY "authenticated_all_staff" ON staff
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Availability table (already has this policy, but recreating to be sure)
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON availability;
DROP POLICY IF EXISTS "authenticated_all_availability" ON availability;
CREATE POLICY "authenticated_all_availability" ON availability
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Rotas table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON rotas;
DROP POLICY IF EXISTS "auth_select_rotas" ON rotas;
DROP POLICY IF EXISTS "auth_insert_rotas" ON rotas;
DROP POLICY IF EXISTS "auth_update_rotas" ON rotas;
DROP POLICY IF EXISTS "auth_delete_rotas" ON rotas;
CREATE POLICY "authenticated_all_rotas" ON rotas
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Assignments table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON assignments;
DROP POLICY IF EXISTS "authenticated_read_assignments" ON assignments;
DROP POLICY IF EXISTS "authenticated_insert_assignments" ON assignments;
DROP POLICY IF EXISTS "authenticated_update_assignments" ON assignments;
DROP POLICY IF EXISTS "authenticated_delete_assignments" ON assignments;
CREATE POLICY "authenticated_all_assignments" ON assignments
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Task config table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON task_config;
DROP POLICY IF EXISTS "public_read_task_config" ON task_config;
DROP POLICY IF EXISTS "authenticated_insert_task_config" ON task_config;
DROP POLICY IF EXISTS "authenticated_update_task_config" ON task_config;
DROP POLICY IF EXISTS "authenticated_delete_task_config" ON task_config;
CREATE POLICY "authenticated_all_task_config" ON task_config
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Managers table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON managers;
DROP POLICY IF EXISTS "authenticated_read_managers" ON managers;
DROP POLICY IF EXISTS "authenticated_insert_managers" ON managers;
DROP POLICY IF EXISTS "authenticated_update_managers" ON managers;
DROP POLICY IF EXISTS "authenticated_delete_managers" ON managers;
CREATE POLICY "authenticated_all_managers" ON managers
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Manager availability table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON manager_availability;
DROP POLICY IF EXISTS "authenticated_read_manager_availability" ON manager_availability;
DROP POLICY IF EXISTS "authenticated_insert_manager_availability" ON manager_availability;
DROP POLICY IF EXISTS "authenticated_update_manager_availability" ON manager_availability;
DROP POLICY IF EXISTS "authenticated_delete_manager_availability" ON manager_availability;
CREATE POLICY "authenticated_all_manager_availability" ON manager_availability
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Profiles table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "authenticated_all_profiles" ON profiles
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Invitations table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON invitations;
DROP POLICY IF EXISTS "admin_view_all" ON invitations;
DROP POLICY IF EXISTS "admin_insert" ON invitations;
DROP POLICY IF EXISTS "admin_update" ON invitations;
DROP POLICY IF EXISTS "public_validate" ON invitations;
CREATE POLICY "authenticated_all_invitations" ON invitations
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Audit log table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON audit_log;
DROP POLICY IF EXISTS "auth_select_audit" ON audit_log;
DROP POLICY IF EXISTS "auth_insert_audit" ON audit_log;
CREATE POLICY "authenticated_all_audit_log" ON audit_log
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Rota backups table
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON rota_backups;
DROP POLICY IF EXISTS "authenticated_read_rota_backups" ON rota_backups;
DROP POLICY IF EXISTS "authenticated_insert_rota_backups" ON rota_backups;
DROP POLICY IF EXISTS "authenticated_delete_rota_backups" ON rota_backups;
CREATE POLICY "authenticated_all_rota_backups" ON rota_backups
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);