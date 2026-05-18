-- Create managers table with duty training flags
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

-- Enable RLS
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

-- Public access policies (matching other tables in the system)
CREATE POLICY "public_read_managers" ON managers FOR SELECT USING (true);
CREATE POLICY "public_insert_managers" ON managers FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_managers" ON managers FOR UPDATE USING (true);
CREATE POLICY "public_delete_managers" ON managers FOR DELETE USING (true);

-- Insert default managers
INSERT INTO managers (name, can_intake, can_out_loading, can_admin, can_floor, preferred_shift) VALUES
('John Smith', true, true, true, true, '06:00'),
('Sarah Jones', true, true, false, true, '08:00'),
('Mike Wilson', false, true, true, true, '06:00'),
('Emma Davis', true, false, true, true, '08:00')
ON CONFLICT (id) DO NOTHING;