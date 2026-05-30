-- Drop the broken constraint and create the correct one
-- The frontend sends: 'rest', 'holiday', 'sick', 'available'
-- But maybe the constraint has different capitalization or values

ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_type_check;

ALTER TABLE availability 
  ADD CONSTRAINT availability_type_check 
  CHECK (type IN ('rest', 'holiday', 'sick', 'available'));