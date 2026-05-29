-- Create a dummy table to trigger Supabase's internal DDL event triggers
CREATE TABLE public._dummy_refresh_trigger (id int);
-- Immediately drop it
DROP TABLE public._dummy_refresh_trigger;
-- Also explicitly notify
NOTIFY pgrst, 'reload schema';