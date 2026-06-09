-- Zoltrakk Arena - Supabase Migration 00001
-- Creates the full database schema for the tournament platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- Extends Supabase Auth users with app-specific profile data
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, age)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'firstName', ''),
    COALESCE(NEW.raw_user_meta_data->>'lastName', ''),
    (NEW.raw_user_meta_data->>'age')::INTEGER
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TOURNAMENTS
-- The main tournament data stored as JSONB to preserve the
-- existing nested data structure (teams, matches, requests, etc.)
-- indexed columns for commonly queried fields
-- ============================================================
CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournaments_owner ON tournaments(owner_id);
CREATE INDEX idx_tournaments_created ON tournaments(created_at DESC);
CREATE INDEX idx_tournaments_data_gin ON tournaments USING GIN (data jsonb_path_ops);

-- ============================================================
-- USER PLAYERS (Squad)
-- Each user's personal player roster (up to 10 players)
-- ============================================================
CREATE TABLE user_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_players_user ON user_players(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- PROFILES RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- TOURNAMENTS RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create tournaments"
  ON tournaments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can update their tournaments"
  ON tournaments FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their tournaments"
  ON tournaments FOR DELETE
  USING (auth.uid() = owner_id);

-- USER PLAYERS RLS
ALTER TABLE user_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own players"
  ON user_players FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own players"
  ON user_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own players"
  ON user_players FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own players"
  ON user_players FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_tournaments_updated
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_user_players_updated
  BEFORE UPDATE ON user_players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CONTACT MESSAGES 
-- ============================================================
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  dob TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact messages"
  ON contact_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view contact messages"
  ON contact_messages FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- PROFILE COLUMNS
-- ============================================================

-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_pref TEXT DEFAULT 'light';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
