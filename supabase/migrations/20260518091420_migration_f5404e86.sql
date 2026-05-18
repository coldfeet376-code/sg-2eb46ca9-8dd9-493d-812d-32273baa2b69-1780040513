-- Add recurring_rest_days column to managers table
ALTER TABLE managers ADD COLUMN IF NOT EXISTS recurring_rest_days integer[] DEFAULT '{}';

COMMENT ON COLUMN managers.recurring_rest_days IS 'Array of day numbers (0=Sunday, 1=Monday, etc.) when this manager has recurring rest days every week';