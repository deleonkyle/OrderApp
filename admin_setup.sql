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

-- Now, let's create a function to easily add a new admin
-- This function will:
-- 1. Insert the user into the users table
-- 2. Insert the admin info into the admin_users table
CREATE OR REPLACE FUNCTION create_admin(
    admin_id UUID,
    admin_email TEXT,
    admin_name TEXT,
    admin_role TEXT DEFAULT 'admin'
) RETURNS VOID AS $$
BEGIN
    -- Insert into users table
    INSERT INTO users (id, email) 
    VALUES (admin_id, admin_email)
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert into admin_users table
    INSERT INTO admin_users (id, email, name, role) 
    VALUES (admin_id, admin_email, admin_name, admin_role)
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Example usage: 
-- SELECT create_admin('your-auth-user-uuid', 'admin@example.com', 'Admin User', 'admin'); 