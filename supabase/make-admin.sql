-- ============================================================
-- Make a user an admin
-- Run this in your Supabase Dashboard > SQL Editor
-- Replace 'teacher@email.com' with the actual email
-- ============================================================

UPDATE profiles
SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE email = 'teacher@email.com');

-- Verify:
SELECT u.email, p.is_admin
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_admin = TRUE;
