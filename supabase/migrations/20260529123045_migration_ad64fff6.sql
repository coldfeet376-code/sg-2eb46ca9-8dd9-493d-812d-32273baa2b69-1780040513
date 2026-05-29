-- If RLS is blocking, let's disable it temporarily to test
ALTER TABLE public.rotas DISABLE ROW LEVEL SECURITY;

-- Force schema reload
NOTIFY pgrst, 'reload schema';