-- Force a complete schema cache reload for all Supabase PostgREST nodes
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Drop and recreate a dummy function to trigger DDL event
CREATE OR REPLACE FUNCTION public.force_cache_refresh() RETURNS void AS $$
BEGIN
  -- This function exists only to trigger cache refresh
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.force_cache_refresh();