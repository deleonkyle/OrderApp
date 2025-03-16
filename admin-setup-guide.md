# Admin Setup Guide for Order Management App

This guide explains how to set up the admin functionality for the Order Management App.

## Setting up the Admins Table in Supabase

### Step 1: Initial Setup (Open Access Policy)

1. **Log in to your Supabase Dashboard**
2. **Navigate to the SQL Editor**
3. **Create a New Query**
4. **Copy the SQL code from the file `supabase/migrations/create_admins_table.sql`**
5. **Paste the SQL code into the query editor**
6. **Run the query**

This will create:
- The `admins` table
- A temporary open access policy to allow the first admin creation
- Helper functions for admin management

### Step 2: Create the First Admin Account

1. **Open the Order Management App**
2. **Click the "Admin Setup" button on the landing screen**
3. **Complete the registration form**
4. **Submit the form**

### Step 3: Finalize Security (After First Admin Creation)

After successfully creating the first admin account, you must secure the admin table:

1. **Return to the Supabase Dashboard**
2. **Navigate to the SQL Editor**
3. **Create a New Query**
4. **Copy the SQL code from the file `supabase/migrations/finalize_admin_security.sql`**
5. **Paste the SQL code into the query editor**
6. **Run the query**

This will:
- Remove the temporary open access policy
- Add proper security policies that restrict access to admins only

> ⚠️ **IMPORTANT**: Don't skip Step 3! The initial setup uses an open policy to avoid recursion errors. You must run the second migration to secure your admin table after creating the first admin.

## Technical Details

### Why the Two-Step Approach?

The initial implementation had a recursion issue in the RLS policies. When checking if the table was empty with `NOT EXISTS (SELECT 1 FROM admins)`, it would trigger the same policy check again, creating an infinite loop.

Our solution:
1. First migration: Create the table with a permissive policy
2. Create the first admin
3. Second migration: Apply proper restrictive policies

### Manual Setup (Alternative)

If you prefer to set up the table manually:

1. **Log in to your Supabase Dashboard**
2. **Navigate to the Table Editor**
3. **Create a new table called `admins` with the following columns:**
   - `id` (UUID, PRIMARY KEY, References auth.users.id ON DELETE CASCADE)
   - `name` (TEXT, NOT NULL)
   - `email` (TEXT, NOT NULL, UNIQUE)
   - `phone` (TEXT)
   - `role` (TEXT, NOT NULL, DEFAULT 'admin')
   - `created_at` (TIMESTAMP WITH TIME ZONE, NOT NULL, DEFAULT now())
   - `updated_at` (TIMESTAMP WITH TIME ZONE, DEFAULT now())

4. **Set up Row Level Security (RLS) policies**
   - Initially keep RLS disabled until the first admin is created
   - Enable RLS and add policies after creating the first admin

## Creating Additional Admin Accounts

Once you've set up the first admin account and finalized security:

1. **Log in as an admin**
2. **Go to admin settings or user management section**
3. **Use the "Create Admin" function**

Additional admin accounts require the setup key: `OrderManagement2024!`

## Security Notes

- The admin setup key is hardcoded as `OrderManagement2024!` in the app
- For production, this should be changed to a more secure value
- Complete all three setup steps to ensure proper security

## Troubleshooting

If you encounter issues:

1. **Infinite Recursion Error**: Make sure you're using the updated migration files that avoid recursion
2. **Cannot Create First Admin**: Verify that you've run the first migration successfully
3. **Access Denied After First Admin**: Make sure to run the second migration to apply proper policies
4. **Check Supabase Logs**: For detailed error messages

## Additional Security Measures

For production deployments, consider:

1. **Environment Variables**: Move the admin setup key to an environment variable
2. **Email Verification**: Require email verification for admin accounts
3. **Two-Factor Authentication**: Implement 2FA for admin accounts
4. **IP Restrictions**: Limit admin access to specific IP addresses 