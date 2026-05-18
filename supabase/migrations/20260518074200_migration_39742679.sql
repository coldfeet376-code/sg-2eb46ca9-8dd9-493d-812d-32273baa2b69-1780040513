-- Create manager_availability table
CREATE TABLE IF NOT EXISTS manager_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rest', 'holiday', 'sick', 'available')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(manager_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manager_availability_date ON manager_availability(date);
CREATE INDEX IF NOT EXISTS idx_manager_availability_manager_id ON manager_availability(manager_id);

-- Enable RLS
ALTER TABLE manager_availability ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public access since we're using shared password auth)
CREATE POLICY "public_read_manager_availability" ON manager_availability FOR SELECT USING (true);
CREATE POLICY "public_insert_manager_availability" ON manager_availability FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_manager_availability" ON manager_availability FOR UPDATE USING (true);
CREATE POLICY "public_delete_manager_availability" ON manager_availability FOR DELETE USING (true);