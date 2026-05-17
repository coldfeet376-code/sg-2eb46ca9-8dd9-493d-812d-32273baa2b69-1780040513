-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  trained_tasks TEXT[] NOT NULL DEFAULT '{}',
  shift_start TEXT NOT NULL DEFAULT '06:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create availability table
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rest', 'holiday', 'sick', 'available')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_availability_staff_id ON availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(date);

-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

-- Public policies (no authentication required - work environment scenario)
-- Anyone can read all staff
CREATE POLICY "public_read_staff" ON staff FOR SELECT USING (true);
-- Anyone can insert staff
CREATE POLICY "public_insert_staff" ON staff FOR INSERT WITH CHECK (true);
-- Anyone can update staff
CREATE POLICY "public_update_staff" ON staff FOR UPDATE USING (true);
-- Anyone can delete staff
CREATE POLICY "public_delete_staff" ON staff FOR DELETE USING (true);

-- Anyone can read all availability
CREATE POLICY "public_read_availability" ON availability FOR SELECT USING (true);
-- Anyone can insert availability
CREATE POLICY "public_insert_availability" ON availability FOR INSERT WITH CHECK (true);
-- Anyone can update availability
CREATE POLICY "public_update_availability" ON availability FOR UPDATE USING (true);
-- Anyone can delete availability
CREATE POLICY "public_delete_availability" ON availability FOR DELETE USING (true);