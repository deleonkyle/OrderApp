# Creating an Admin User in Supabase

Follow these steps to create an admin user and set up the necessary tables correctly:

## Step 1: Create a User in Supabase Auth

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to "Authentication" → "Users"
4. Click "Add User" 
5. Enter the email and password for your admin user
6. After creating the user, note the UUID (it will look like `0cd7562d-ba7e-49b9-a4c3-e44a1528a4c0`)

## Step 2: Set Up Database Tables Using SQL Editor

1. In your Supabase dashboard, go to "SQL Editor"
2. Create a new query
3. Copy and paste the following SQL:

```sql
-- First, drop the tables with foreign key constraints first
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS users;

-- Create or recreate the users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create or recreate the admin_users table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY REFERENCES users(id),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

4. Click "Run" to execute the SQL and set up your tables

## Step 3: Add Your Admin User to Both Tables

1. In the SQL Editor, create another new query
2. Replace the placeholders with your actual values in the following SQL:

```sql
-- Insert user into the users table
INSERT INTO users (id, email) 
VALUES ('YOUR-USER-UUID', 'admin@example.com');

-- Insert admin into the admin_users table
INSERT INTO admin_users (id, email, name, role) 
VALUES ('YOUR-USER-UUID', 'admin@example.com', 'Admin User', 'admin');
```

3. Replace:
   - `YOUR-USER-UUID` with the UUID from Step 1
   - `admin@example.com` with your admin email
   - `Admin User` with your admin name
   - `admin` with the role (admin or manager)
   
4. Click "Run" to execute the SQL

## Step 4: Verify Your Setup

1. Go to the "Table Editor" in Supabase
2. Check the "users" and "admin_users" tables to confirm your user is in both
3. You should now be able to log in with your admin credentials

## Important Notes

- The SQL drops and recreates the tables. If you have existing data, modify the script to preserve it.
- Be careful with the UUID; it must be exactly the same as the one from Supabase Auth.
- If you get a foreign key constraint error, make sure the UUID exists in the users table first. 