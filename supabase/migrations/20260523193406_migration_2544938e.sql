-- First, let's check if email confirmation is required
-- We need to disable it via Supabase Auth config, not SQL

-- Instead, let's create a simple way to auto-confirm your account
-- We'll use a database trigger to auto-confirm accounts with your email

CREATE OR REPLACE FUNCTION auto_confirm_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm coldfeet376@gmail.com
  IF NEW.email = 'coldfeet376@gmail.com' THEN
    NEW.email_confirmed_at = NOW();
    NEW.confirmed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if we have access)
-- Note: This might fail if we don't have access to auth schema
DO $$
BEGIN
  DROP TRIGGER IF EXISTS auto_confirm_admin_trigger ON auth.users;
  CREATE TRIGGER auto_confirm_admin_trigger
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_confirm_admin();
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Cannot create trigger on auth.users - need to disable email confirmation via Supabase dashboard';
END $$;