-- GIST ROTA COMPLETE DATABASE MIGRATION
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  trained_tasks TEXT[] NOT NULL DEFAULT '{}',
  shift_pattern TEXT NOT NULL DEFAULT 'DAYS',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rotas table
CREATE TABLE IF NOT EXISTS rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  task TEXT NOT NULL,
  shift_start TEXT DEFAULT 'EARLY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task requirements table
CREATE TABLE IF NOT EXISTS task_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  task TEXT NOT NULL,
  required_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_of_week, task)
);

-- Availability table
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('REST', 'HOLIDAY', 'ABSENT')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Managers table
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  shift_pattern TEXT NOT NULL DEFAULT 'DAYS',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manager assignments table
CREATE TABLE IF NOT EXISTS manager_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  duty TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager_id, week_start, day_of_week)
);

-- Manager availability table
CREATE TABLE IF NOT EXISTS manager_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('REST', 'HOLIDAY', 'ABSENT')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager_id, date)
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Two factor auth table
CREATE TABLE IF NOT EXISTS two_factor_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_auth ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users full access
CREATE POLICY "auth_all_staff" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_rotas" ON rotas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_assignments" ON assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_task_requirements" ON task_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_availability" ON availability FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_managers" ON managers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_manager_assignments" ON manager_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_manager_availability" ON manager_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_invitations" ON invitations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_two_factor" ON two_factor_auth FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default task requirements
INSERT INTO task_requirements (day_of_week, task, required_count) VALUES
(0, 'Frozen', 2), (0, 'Milk', 2), (0, 'Twi', 2), (0, 'Inbound', 3), (0, 'Outbound', 3), (0, 'Marshaling', 2),
(1, 'Frozen', 2), (1, 'Milk', 2), (1, 'Twi', 2), (1, 'Inbound', 3), (1, 'Outbound', 3), (1, 'Marshaling', 2),
(2, 'Frozen', 2), (2, 'Milk', 2), (2, 'Twi', 2), (2, 'Inbound', 3), (2, 'Outbound', 3), (2, 'Marshaling', 2),
(3, 'Frozen', 2), (3, 'Milk', 2), (3, 'Twi', 2), (3, 'Inbound', 3), (3, 'Outbound', 3), (3, 'Marshaling', 2),
(4, 'Frozen', 2), (4, 'Milk', 2), (4, 'Twi', 2), (4, 'Inbound', 3), (4, 'Outbound', 3), (4, 'Marshaling', 2),
(5, 'Frozen', 2), (5, 'Milk', 2), (5, 'Twi', 2), (5, 'Inbound', 3), (5, 'Outbound', 3), (5, 'Marshaling', 2),
(6, 'Frozen', 2), (6, 'Milk', 2), (6, 'Twi', 2), (6, 'Inbound', 3), (6, 'Outbound', 3), (6, 'Marshaling', 2)
ON CONFLICT (day_of_week, task) DO NOTHING;