-- ======================================================
-- FIX ADMIN AUTHENTICATION SCRIPT
-- ======================================================
-- Run this script to fix authentication issues with admin accounts
-- Replace the UUID with your actual admin ID from the admins table
-- ======================================================

-- STEP 1: Make sure the admin exists in auth.users with proper settings
-- This updates an existing user in auth.users if it exists
-- Replace '7fc8d9fe-82d8-4440-839b-0ade2aea9e7b' with your admin UUID
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW(), -- This will only update if not a generated column
  is_sso_user = FALSE,
  banned_until = NULL,
  raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', 'admin'),
  raw_user_meta_data = jsonb_build_object('name', (SELECT name FROM public.admins WHERE id = '7fc8d9fe-82d8-4440-839b-0ade2aea9e7b'))
WHERE id = '7fc8d9fe-82d8-4440-839b-0ade2aea9e7b';

-- STEP 2: Set a new password for the admin user
-- This sets a known password - change 'new-admin-password' to your desired password
-- WARNING: The password is set in plain text here and will be hashed by Supabase
UPDATE auth.users
SET 
  encrypted_password = crypt('new-admin-password', gen_salt('bf'))
WHERE id = '7fc8d9fe-82d8-4440-839b-0ade2aea9e7b';

-- STEP 3: Clear any stale tokens for this user
DELETE FROM auth.refresh_tokens
WHERE user_id = '7fc8d9fe-82d8-4440-839b-0ade2aea9e7b';

-- STEP 4: Make sure RLS policies are working correctly for this admin
-- Remove any temporary policies that might interfere
DROP POLICY IF EXISTS "Temporary open policy" ON public.admins;

-- Make sure the admin can view admin records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admins' AND policyname = 'Admins can view admin records'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view admin records" ON public.admins FOR SELECT USING (is_admin())';
  END IF;
END $$;

-- Make sure the admin can update their own record
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admins' AND policyname = 'Admins can update own record'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can update own record" ON public.admins FOR UPDATE USING (auth.uid() = id)';
  END IF;
END $$;

-- STEP 5: Create a function to check if is_admin if it doesn't already exist
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = COALESCE(user_id, auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 6: Verify the admin now has the right permissions
-- This will show '1' if the user exists properly in both tables
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = '7fc8d9fe-82d8-4440-839b-0ade2aea9e7b') THEN 1 ELSE 0 END as auth_user_exists,
  CASE WHEN EXISTS (SELECT 1 FROM public.admins WHERE id = '7fc8d9fe-82d8-4440-839b-0ade2aea9e7b') THEN 1 ELSE 0 END as admin_exists; 