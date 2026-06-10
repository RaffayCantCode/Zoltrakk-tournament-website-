-- ============================================================
-- Admin Management Functions
-- Creates helper functions + revokes public execute.
-- After running this, use the examples below in SQL Editor.
-- ============================================================

-- Run this whole file ONCE to set up the functions.
-- Then to manage admins, only run the SELECT statements below.

-- ── Create functions (safe to re-run) ────────────────────────

CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE(email TEXT, first_name TEXT, last_name TEXT, is_admin BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT u.email::TEXT, p.first_name::TEXT, p.last_name::TEXT, p.is_admin
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  ORDER BY p.is_admin DESC, u.email;
$$;

CREATE OR REPLACE FUNCTION admin_promote(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = target_email;
  IF uid IS NULL THEN RETURN 'User not found: ' || target_email; END IF;
  UPDATE public.profiles SET is_admin = TRUE WHERE id = uid;
  RETURN target_email || ' promoted to admin';
END;
$$;

CREATE OR REPLACE FUNCTION admin_demote(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = target_email;
  IF uid IS NULL THEN RETURN 'User not found: ' || target_email; END IF;
  UPDATE public.profiles SET is_admin = FALSE WHERE id = uid;
  RETURN target_email || ' demoted from admin';
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_promote(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_demote(TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- USAGE — run these from Supabase SQL Editor (requires login):
-- ============================================================

-- List all users with admin status:
--   SELECT * FROM admin_list_users();

-- Promote a user:
--   SELECT admin_promote('someone@email.com');

-- Demote a user:
--   SELECT admin_demote('someone@email.com');
