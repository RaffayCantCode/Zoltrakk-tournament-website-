-- Live DB fix: tournament RLS + leaderboard table
-- Run in Supabase Dashboard > SQL Editor

-- 1) Fix tournament RLS so non-creators can join teams
DROP POLICY IF EXISTS "Owners can update their tournaments" ON tournaments;
DROP POLICY IF EXISTS "Authenticated users can update tournaments" ON tournaments;
CREATE POLICY "Authenticated users can update tournaments"
  ON tournaments FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 2) Create leaderboard entries table
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_name TEXT NOT NULL,
  game TEXT NOT NULL DEFAULT '',
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view leaderboard entries" ON leaderboard_entries;
CREATE POLICY "Anyone can view leaderboard entries"
  ON leaderboard_entries FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert leaderboard entries" ON leaderboard_entries;
CREATE POLICY "Admins can insert leaderboard entries"
  ON leaderboard_entries FOR INSERT
  WITH CHECK (is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update leaderboard entries" ON leaderboard_entries;
CREATE POLICY "Admins can update leaderboard entries"
  ON leaderboard_entries FOR UPDATE
  USING (is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete leaderboard entries" ON leaderboard_entries;
CREATE POLICY "Admins can delete leaderboard entries"
  ON leaderboard_entries FOR DELETE
  USING (is_user_admin(auth.uid()));

-- 3) Ensure update_updated_at function exists and trigger is set
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_leaderboard_entries_updated ON leaderboard_entries;
CREATE TRIGGER on_leaderboard_entries_updated
  BEFORE UPDATE ON leaderboard_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4) Enable realtime for leaderboard_entries
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_entries;

-- Verify
SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('tournaments', 'leaderboard_entries') ORDER BY tablename, policyname;
