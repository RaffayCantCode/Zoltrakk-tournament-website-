# Zoltrakk Arena — Tournament Platform

Next-generation tournament platform built with vanilla JS, Supabase database, and Netlify hosting.

## Architecture

- **Frontend:** Static HTML/CSS/JS (no frameworks)
- **Database:** Supabase (PostgreSQL) — primary source of truth for all tournament data
- **Auth:** Supabase Auth (email/password)
- **Hosting:** Netlify (static files + serverless functions)
- **Backup:** JSON export/import for tournament files

## Supabase Setup

### Prerequisites
1. Create a Supabase project at https://supabase.com
2. Your project reference: `pdhukukrfeuvikfitred`
3. Supabase URL: `https://pdhukukrfeuvikfitred.supabase.co`

### Run Migrations
The migration file is at `supabase/migrations/00001_initial_schema.sql`.

**Option 1: Supabase Dashboard (SQL Editor)**
1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Paste the contents of `supabase/migrations/00001_initial_schema.sql`
4. Run the query

**Option 2: Supabase CLI**
```bash
supabase link --project-ref pdhukukrfeuvikfitred
supabase db push
```

**Option 3: psql direct**
```bash
psql "postgresql://postgres.pdhukukrfeuvikfitred:YOUR-PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres" -f supabase/migrations/00001_initial_schema.sql
```

### Get Your Anon Key
1. In Supabase dashboard, go to **Settings > API**
2. Copy the **anon public** key (not the service_role key)
3. Save it for the Netlify setup below

## Netlify Setup

### Required Environment Variables
Set these in your Netlify dashboard under **Site settings > Environment variables**:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://pdhukukrfeuvikfitred.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon public key |

### Deploy
1. Connect your Git repository to Netlify
2. Build command: (none — static site)
3. Publish directory: `files`
4. Functions directory: `netlify/functions`
5. Deploy

Alternatively, use the Netlify CLI:
```bash
netlify deploy --prod
```

### Local Development
1. Create a `.env` file with your Supabase credentials:
```
SUPABASE_URL=https://pdhukukrfeuvikfitred.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

2. Serve the `files/` directory locally:
```bash
npx serve files
```

Or use the Netlify dev server:
```bash
netlify dev
```

## Verify Data Storage

1. Create a tournament on the live site
2. Go to Supabase dashboard > **Table Editor** > `tournaments`
3. You should see a row with your tournament's JSON data
4. Create a user account — you should see a row in `profiles`
5. Add players to your squad — you should see rows in `user_players`

## Export/Import Feature

**Export:** On any tournament page, click "Export Backup" to download a `.json` file with all tournament data (teams, matches, settings, etc.)

**Import:** On the My Hub page (`my-tournaments.html`), use the "Import Tournament Backup" section to upload a previously exported `.json` file. The imported tournament will be created as a new tournament in Supabase with fresh IDs.

## What Changed

### Removed
- Netlify Blobs store function (`netlify/functions/store.mjs`)
- Legacy player catalog function (`netlify/functions/players.js`)
- Utility file (`netlify/functions/_utils.js`)
- Custom PBKDF2 authentication
- All localStorage-based data storage for tournaments/users/players
- Cloud sync system with periodic pull/push

### Added
- Supabase database for all live data storage
- Supabase Auth (email/password) — secure password hashing
- In-memory cache layer for fast reads
- Loading states and error handling
- Tournament export (JSON download)
- Tournament import (JSON upload with validation)
- `netlify/functions/supabase-config.mjs` — provides Supabase config to frontend
- `supabase/migrations/00001_initial_schema.sql` — database schema

### Kept
- All rendering logic and UI (unchanged)
- MetaMask / Web3 integration
- Theme toggle (localStorage for preference only)
- Chatbot helper
- Static file structure

## Database Schema

**profiles** — User profiles linked to Supabase Auth
**tournaments** — Tournament data as JSONB (teams, matches, requests, settings all nested)
**user_players** — Player squad rosters per user
