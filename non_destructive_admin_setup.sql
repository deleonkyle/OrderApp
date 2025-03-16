-- Non-destructive approach to fix tables and add admin user
-- This script preserves existing data where possible

-- If tables don't exist, create them
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if admin_users table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_tables 
                   WHERE schemaname = 'public' 
                   AND tablename = 'admin_users') THEN
        -- Create admin_users table
        CREATE TABLE admin_users (
            id UUID PRIMARY KEY REFERENCES users(id),
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Check if admin_users table needs to be altered to add the foreign key constraint
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'admin_users_id_fkey'
            AND conrelid = 'admin_users'::regclass
        ) THEN
            -- Temporarily save existing admin_users data
            CREATE TEMP TABLE admin_users_backup AS SELECT * FROM admin_users;
            
            -- Drop and recreate the admin_users table with proper constraint
            DROP TABLE admin_users;
            CREATE TABLE admin_users (
                id UUID PRIMARY KEY REFERENCES users(id),
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- For each admin in the backup, ensure there's a corresponding user record
            INSERT INTO users (id, email)
            SELECT id, email FROM admin_users_backup
            ON CONFLICT (id) DO NOTHING;
            
            -- Restore admin_users data
            INSERT INTO admin_users (id, email, name, role, created_at, updated_at)
            SELECT id, email, name, role,
                   COALESCE(created_at, CURRENT_TIMESTAMP),
                   COALESCE(updated_at, CURRENT_TIMESTAMP)
            FROM admin_users_backup
            ON CONFLICT (id) DO NOTHING;
            
            -- Clean up temp table
            DROP TABLE admin_users_backup;
        END IF;
    END IF;
END $$;

-- Create a function to easily add new admin users
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
    ON CONFLICT (id) DO UPDATE SET email = admin_email;
    
    -- Insert into admin_users table
    INSERT INTO admin_users (id, email, name, role) 
    VALUES (admin_id, admin_email, admin_name, admin_role)
    ON CONFLICT (id) DO UPDATE SET 
        email = admin_email,
        name = admin_name,
        role = admin_role;
END;
$$ LANGUAGE plpgsql;

-- Example usage (uncomment and fill in values to use):
-- SELECT create_admin(
--     'YOUR-USER-UUID-HERE', 
--     'admin@example.com', 
--     'Admin User',
--     'admin'
-- ); 