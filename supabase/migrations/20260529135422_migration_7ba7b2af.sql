-- Nuclear option: Drop and recreate the problematic columns to force PostgREST cache invalidation
ALTER TABLE public.rotas DROP COLUMN IF EXISTS rota_data CASCADE;
ALTER TABLE public.rotas DROP COLUMN IF EXISTS fairness_metrics CASCADE;

-- Recreate with explicit structure
ALTER TABLE public.rotas ADD COLUMN rota_data jsonb;
ALTER TABLE public.rotas ADD COLUMN fairness_metrics jsonb;

-- Grant explicit permissions to all roles
GRANT ALL ON public.rotas TO authenticated;
GRANT ALL ON public.rotas TO anon;
GRANT ALL ON public.rotas TO service_role;

-- Comment to force DDL event
COMMENT ON COLUMN public.rotas.rota_data IS 'Rota assignment data (recreated)';
COMMENT ON COLUMN public.rotas.fairness_metrics IS 'Fairness calculation metrics (recreated)';

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';