-- Create task_config table to store daily task requirements
CREATE TABLE IF NOT EXISTS task_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task TEXT NOT NULL,
  sunday INTEGER NOT NULL DEFAULT 0,
  monday INTEGER NOT NULL DEFAULT 0,
  tuesday INTEGER NOT NULL DEFAULT 0,
  wednesday INTEGER NOT NULL DEFAULT 0,
  thursday INTEGER NOT NULL DEFAULT 0,
  friday INTEGER NOT NULL DEFAULT 0,
  saturday INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task)
);

-- Enable RLS
ALTER TABLE task_config ENABLE ROW LEVEL SECURITY;

-- Public access policies (matching staff table pattern)
CREATE POLICY "public_read_task_config" ON task_config FOR SELECT USING (true);
CREATE POLICY "public_insert_task_config" ON task_config FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_task_config" ON task_config FOR UPDATE USING (true);
CREATE POLICY "public_delete_task_config" ON task_config FOR DELETE USING (true);

-- Insert default configuration for all 6 tasks
INSERT INTO task_config (task, sunday, monday, tuesday, wednesday, thursday, friday, saturday)
VALUES 
  ('Frozen', 2, 2, 2, 2, 2, 2, 1),
  ('Milk', 2, 2, 2, 2, 2, 2, 1),
  ('TWI', 1, 1, 1, 1, 1, 1, 0),
  ('Inbound', 2, 3, 3, 3, 3, 3, 1),
  ('Outbound', 2, 3, 3, 3, 3, 3, 1),
  ('Marshaling', 1, 2, 2, 2, 2, 2, 1)
ON CONFLICT (task) DO NOTHING;