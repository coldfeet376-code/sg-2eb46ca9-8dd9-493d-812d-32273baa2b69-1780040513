-- Force column refresh by renaming it and renaming it back
ALTER TABLE public.rotas RENAME COLUMN assignments TO _assignments;
ALTER TABLE public.rotas RENAME COLUMN _assignments TO assignments;

-- Ensure all web roles have access to the table
GRANT ALL ON TABLE public.rotas TO authenticated;
GRANT ALL ON TABLE public.rotas TO anon;
GRANT ALL ON TABLE public.rotas TO service_role;

-- Force the API engine to reload the schema mapping
NOTIFY pgrst, 'reload schema';