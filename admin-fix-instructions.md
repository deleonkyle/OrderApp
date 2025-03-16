# Fix Admin Authentication Issues

Follow these instructions to resolve the "Invalid credentials" error when trying to log in as an admin.

## The Problem

You're encountering this issue because:

1. Your app is now using Supabase Auth for admin login.
2. Your admin exists in the `admins` table but not in Supabase Auth system.
3. Or, your admin may exist in both places but there are permission issues.

## Quick Fix - Run SQL Script

1. Go to the Supabase Dashboard for your project.
2. Navigate to SQL Editor.
3. Copy and paste the contents of `scripts/fix-admin-auth.sql` file.
4. Make these important edits to the script:
   - Replace `7fc8d9fe-82d8-4440-839b-0ade2aea9e7b` with your admin UUID.
   - Change `new-admin-password` to your desired password (ideally a secure one).
5. Run the SQL script.
6. Return to your app and try logging in with:
   - The email associated with this admin account
   - The password you set in the script

## Explanation of What the Fix Does:

1. Updates the admin record in Supabase Auth system
2. Sets a known password for the admin
3. Clears any stale tokens
4. Ensures Row Level Security policies are correctly set up
5. Creates or updates the `is_admin()` function
6. Verifies the admin exists in both `auth.users` and `public.admins` tables

## If You Still Have Issues:

1. Verify that the email matches exactly in both tables:
```sql
SELECT a.email AS admin_email, u.email AS auth_email 
FROM public.admins a
JOIN auth.users u ON a.id = u.id
WHERE a.id = 'your-admin-uuid';
```

2. Check for any constraints or triggers that might be interfering:
```sql
SELECT * FROM pg_constraint 
WHERE conrelid = 'public.admins'::regclass;
```

3. Try using the magic link option on the login screen, which sends a login link to your email.

## Long-term Solution

1. The app has been updated to use proper Supabase Auth, which is more secure than the previous method.
2. Always create admin accounts through the app's admin registration screen, not directly in the database.
3. If you create admins in the database, make sure to also create corresponding records in `auth.users`. 