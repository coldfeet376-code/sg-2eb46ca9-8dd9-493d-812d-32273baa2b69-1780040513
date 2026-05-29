ALTER TABLE public.rotas RENAME COLUMN assignments TO rota_data;
NOTIFY pgrst, 'reload schema';