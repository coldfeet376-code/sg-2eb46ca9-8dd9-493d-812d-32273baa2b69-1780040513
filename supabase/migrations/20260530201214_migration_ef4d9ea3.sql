-- Drop the old check constraint and create a new one that allows rest, holiday, sick
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_type_check;

ALTER TABLE availability 
  ADD CONSTRAINT availability_type_check 
  CHECK (type IN ('rest', 'holiday', 'sick'));