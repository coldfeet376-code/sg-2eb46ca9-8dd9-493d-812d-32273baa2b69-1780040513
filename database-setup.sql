-- COMPLETE DATABASE SETUP FOR WAREHOUSE ROTA SYSTEM
-- Run this entire script in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CREATE STAFF TABLE
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  trained_tasks TEXT[] NOT NULL DEFAULT '{}',
  shift_start TEXT NOT NULL DEFAULT '06:00' CHECK (shift_start IN ('06:00', '08:00')),
  shift_pattern TEXT DEFAULT 'All',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE AVAILABILITY TABLE
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('available', 'rest_day', 'absent', 'holiday')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- 3. CREATE TASK CONFIG TABLE
CREATE TABLE IF NOT EXISTS task_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task TEXT NOT NULL UNIQUE,
  sunday INTEGER NOT NULL DEFAULT 0,
  monday INTEGER NOT NULL DEFAULT 0,
  tuesday INTEGER NOT NULL DEFAULT 0,
  wednesday INTEGER NOT NULL DEFAULT 0,
  thursday INTEGER NOT NULL DEFAULT 0,
  friday INTEGER NOT NULL DEFAULT 0,
  saturday INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start TEXT NOT NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  task TEXT NOT NULL,
  date TEXT NOT NULL,
  shift_pattern TEXT DEFAULT 'All',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CREATE ROTA BACKUPS TABLE
CREATE TABLE IF NOT EXISTS rota_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start TEXT NOT NULL,
  assignments JSONB NOT NULL,
  locked_assignments JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- 6. CREATE MANAGERS TABLE
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  can_intake BOOLEAN NOT NULL DEFAULT true,
  can_out_loading BOOLEAN NOT NULL DEFAULT true,
  can_admin BOOLEAN NOT NULL DEFAULT true,
  can_floor BOOLEAN NOT NULL DEFAULT true,
  preferred_shift TEXT NULL CHECK (preferred_shift IN ('06:00', '08:00')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CREATE MANAGER AVAILABILITY TABLE
CREATE TABLE IF NOT EXISTS manager_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('available', 'rest_day', 'absent', 'holiday')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(manager_id, date)
);

-- 8. CREATE ROTAS TABLE
CREATE TABLE IF NOT EXISTS rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. CREATE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  details JSONB,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. CREATE INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT unique_pending_email UNIQUE (email, status)
);

-- 11. CREATE TWO-FACTOR AUTH TABLE
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_codes ENABLE ROW LEVEL SECURITY;

-- CREATE RLS POLICIES (PUBLIC ACCESS FOR ALL OPERATIONS)
-- Staff table policies
CREATE POLICY "public_read_staff" ON staff FOR SELECT USING (true);
CREATE POLICY "public_insert_staff" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_staff" ON staff FOR UPDATE USING (true);
CREATE POLICY "public_delete_staff" ON staff FOR DELETE USING (true);

-- Availability table policies
CREATE POLICY "public_read_availability" ON availability FOR SELECT USING (true);
CREATE POLICY "public_insert_availability" ON availability FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_availability" ON availability FOR UPDATE USING (true);
CREATE POLICY "public_delete_availability" ON availability FOR DELETE USING (true);

-- Task config policies
CREATE POLICY "public_read_task_config" ON task_config FOR SELECT USING (true);
CREATE POLICY "public_insert_task_config" ON task_config FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_task_config" ON task_config FOR UPDATE USING (true);
CREATE POLICY "public_delete_task_config" ON task_config FOR DELETE USING (true);

-- Assignments policies
CREATE POLICY "public_read_assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "public_insert_assignments" ON assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_assignments" ON assignments FOR UPDATE USING (true);
CREATE POLICY "public_delete_assignments" ON assignments FOR DELETE USING (true);

-- Rota backups policies
CREATE POLICY "public_read_backups" ON rota_backups FOR SELECT USING (true);
CREATE POLICY "public_insert_backups" ON rota_backups FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_backups" ON rota_backups FOR UPDATE USING (true);
CREATE POLICY "public_delete_backups" ON rota_backups FOR DELETE USING (true);

-- Managers policies
CREATE POLICY "public_read_managers" ON managers FOR SELECT USING (true);
CREATE POLICY "public_insert_managers" ON managers FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_managers" ON managers FOR UPDATE USING (true);
CREATE POLICY "public_delete_managers" ON managers FOR DELETE USING (true);

-- Manager availability policies
CREATE POLICY "public_read_manager_availability" ON manager_availability FOR SELECT USING (true);
CREATE POLICY "public_insert_manager_availability" ON manager_availability FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_manager_availability" ON manager_availability FOR UPDATE USING (true);
CREATE POLICY "public_delete_manager_availability" ON manager_availability FOR DELETE USING (true);

-- Rotas policies
CREATE POLICY "public_read_rotas" ON rotas FOR SELECT USING (true);
CREATE POLICY "public_insert_rotas" ON rotas FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_rotas" ON rotas FOR UPDATE USING (true);
CREATE POLICY "public_delete_rotas" ON rotas FOR DELETE USING (true);

-- Audit log policies
CREATE POLICY "public_read_audit" ON audit_log FOR SELECT USING (true);
CREATE POLICY "public_insert_audit" ON audit_log FOR INSERT WITH CHECK (true);

-- Invitations policies (admin only for most operations)
CREATE POLICY "admin_view_all" ON invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE 'admin@%'
    )
  );

CREATE POLICY "admin_insert" ON invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE 'admin@%'
    )
  );

CREATE POLICY "admin_update" ON invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE 'admin@%'
    )
  );

CREATE POLICY "public_validate" ON invitations
  FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Two-factor codes policies
CREATE POLICY "user_own_2fa" ON two_factor_codes
  FOR ALL
  USING (auth.uid() = user_id);

-- CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_availability_staff ON availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(date);
CREATE INDEX IF NOT EXISTS idx_assignments_week ON assignments(week_start);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
CREATE INDEX IF NOT EXISTS idx_backups_week ON rota_backups(week_start);
CREATE INDEX IF NOT EXISTS idx_manager_availability_manager ON manager_availability(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_availability_date ON manager_availability(date);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_2fa_user ON two_factor_codes(user_id);

-- INSERT DEFAULT TASK CONFIGURATION
INSERT INTO task_config (task, sunday, monday, tuesday, wednesday, thursday, friday, saturday) VALUES
('Frozen', 4, 4, 4, 4, 4, 4, 4),
('Milk', 3, 3, 3, 3, 3, 3, 3),
('Twi', 2, 2, 2, 2, 2, 2, 2),
('Inbound', 3, 3, 3, 3, 3, 3, 3),
('Inbound Late', 2, 2, 2, 2, 2, 2, 2),
('Outbound', 4, 4, 4, 4, 4, 4, 4),
('Marshaling', 2, 2, 2, 2, 2, 2, 2)
ON CONFLICT (task) DO NOTHING;

-- SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE '✅ Database setup complete! All tables, policies, and indexes created successfully.';
END $$;