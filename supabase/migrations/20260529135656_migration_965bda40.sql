-- Force PostgREST to reload by making a schema change it cannot ignore
ALTER TABLE public.rotas ALTER COLUMN rota_data TYPE jsonb USING rota_data::jsonb;
ALTER TABLE public.rotas ALTER COLUMN fairness_metrics TYPE jsonb USING fairness_metrics::jsonb;

-- Add explicit column comments with timestamp to force cache invalidation
COMMENT ON COLUMN public.rotas.rota_data IS 'Rota assignments - refreshed at 2026-05-29 13:56:29';
COMMENT ON COLUMN public.rotas.fairness_metrics IS 'Fairness metrics - refreshed at 2026-05-29 13:56:29';

-- Revoke and re-grant permissions to trigger policy reload
REVOKE ALL ON public.rotas FROM authenticated;
REVOKE ALL ON public.rotas FROM anon;
GRANT ALL ON public.rotas TO authenticated;
GRANT ALL ON public.rotas TO anon;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';