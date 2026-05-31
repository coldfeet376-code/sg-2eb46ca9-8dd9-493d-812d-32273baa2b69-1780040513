-- Drop the old constraint and recreate with correct values
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_type_check;

-- Add new constraint that accepts: available, rest, holiday, sick
ALTER TABLE availability 
ADD CONSTRAINT availability_type_check 
CHECK (type IN ('available', 'rest', 'holiday', 'sick'));

-- Verify the new constraint
SELECT 
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'availability'::regclass
  AND conname = 'availability_type_check';