-- Restore the constraint to include 'available' (original had all 4 values)
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_type_check;

ALTER TABLE availability 
  ADD CONSTRAINT availability_type_check 
  CHECK (type IN ('rest', 'holiday', 'sick', 'available'));