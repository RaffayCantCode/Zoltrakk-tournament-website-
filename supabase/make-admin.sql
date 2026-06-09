-- ============================================================
-- Make a user an admin
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- Step 1: Find the user's ID
-- (run this first to check if they've signed up)
SELECT id, email, created_at FROM auth.users WHERE email = 'teacher@email.com';

-- Step 2: Grant admin privileges
-- Replace 'teacher@email.com' with their actual email
UPDATE profiles
SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE email = 'teacher@email.com');

-- Step 3: Verify
SELECT u.email, p.is_admin, p.first_name, p.last_name
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_admin = TRUE;
