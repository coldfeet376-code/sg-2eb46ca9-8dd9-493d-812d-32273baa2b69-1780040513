-- Add admin role system to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Make your account an admin (update with your actual email)
UPDATE profiles 
SET is_admin = true 
WHERE email = 'coldfeet376@gmail.com';

-- Also grant admin to any admin@ emails
UPDATE profiles 
SET is_admin = true 
WHERE email LIKE 'admin@%';

COMMENT ON COLUMN profiles.is_admin IS 'Whether this user has admin privileges';