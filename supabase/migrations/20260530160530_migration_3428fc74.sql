-- Add unique constraint on (staff_id, date) if it doesn't exist
-- This is required for upsert to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'availability'::regclass 
    AND conname = 'availability_staff_id_date_key'
  ) THEN
    ALTER TABLE availability 
    ADD CONSTRAINT availability_staff_id_date_key 
    UNIQUE (staff_id, date);
  END IF;
END $$;