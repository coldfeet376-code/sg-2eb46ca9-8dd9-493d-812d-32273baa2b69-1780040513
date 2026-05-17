-- Add shift_pattern column to staff table for Early/Late/All day shifts
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shift_pattern text DEFAULT 'All';

-- Add shift_pattern to assignments (will be populated during rota generation)
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start text NOT NULL,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  task text NOT NULL,
  date text NOT NULL,
  shift_pattern text DEFAULT 'All',
  created_at timestamp with time zone DEFAULT now()
);

-- Create rota_backups table for automatic backup system
CREATE TABLE IF NOT EXISTS rota_backups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start text NOT NULL,
  assignments jsonb NOT NULL,
  locked_assignments jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by text
);

-- Add RLS policies
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "public_insert_assignments" ON assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_assignments" ON assignments FOR UPDATE USING (true);
CREATE POLICY "public_delete_assignments" ON assignments FOR DELETE USING (true);

CREATE POLICY "public_read_backups" ON rota_backups FOR SELECT USING (true);
CREATE POLICY "public_insert_backups" ON rota_backups FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_backups" ON rota_backups FOR UPDATE USING (true);
CREATE POLICY "public_delete_backups" ON rota_backups FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignments_week ON assignments(week_start);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
CREATE INDEX IF NOT EXISTS idx_backups_week ON rota_backups(week_start);