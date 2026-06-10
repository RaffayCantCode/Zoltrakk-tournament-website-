-- Fix tournament RLS so non-creators can join teams
-- Run in Supabase Dashboard > SQL Editor

DROP POLICY IF EXISTS "Owners can update their tournaments" ON tournaments;
DROP POLICY IF EXISTS "Authenticated users can update tournaments" ON tournaments;

CREATE POLICY "Authenticated users can update tournaments"
  ON tournaments FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Verify
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'tournaments';
