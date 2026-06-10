const THEME_KEY = "zoltrakk_theme";
const DEFAULT_PLAYER_IMAGE = "images/player-default.svg";
const MAX_PLAYER_IMAGE_BYTES = 450000;
const DEFAULT_BANNERS = {
  "League of Legends": "images/game-lol-banner.jpg",
  "Valorant": "images/game-valorant-banner.jpg",
  "CS2": "images/game-cs2-banner.jpg",
  "Overwatch": "images/game-ow2-banner.jpg"
};
const OPEN_STATUSES = ["upcoming", "active"];
const CACHE_KEY_TOURNAMENTS = "zoltrakk_cache_tournaments";

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function formatDate12h(val) {
  if (!val) return "TBD";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val.replace("T", " ");
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  let h = d.getHours(), ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${m} ${d.getDate()}, ${d.getFullYear()} ${h}:${String(d.getMinutes()).padStart(2,"0")} ${ampm}`;
}
function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function nowIso() { return new Date().toISOString(); }

// ── Supabase Client ──────────────────────────────────────────
let supabaseClient = null;
let _supabaseReady = false;

async function initSupabase() {
  if (_supabaseReady) return;
  try {
    const res = await fetch("/.netlify/functions/supabase-config");
    const cfg = await res.json();
    supabaseClient = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  } catch {
    // Local dev fallback — set these in localStorage or use defaults
    const url = localStorage.getItem("supabase_url") || "https://pdhukukrfeuvikfitred.supabase.co";
    const key = localStorage.getItem("supabase_anon_key") || "";
    supabaseClient = supabase.createClient(url, key);
  }
  _supabaseReady = true;
}

// ── Cache Layer ──────────────────────────────────────────────
let _tournamentsCache = null;
let _currentUserCache = null;
let _userPlayersCache = null;

function getTournaments() { return _tournamentsCache || []; }

const MOCK_PLAYERS = [
  { id: "p1", name: "Raffay", game: "Valorant", rank: "Diamond", image: "images/player_raffay.png" },
  { id: "p2", name: "Asif", game: "CS2", rank: "Platinum", image: "images/player_asif.png" },
  { id: "p3", name: "Neo", game: "CS2", rank: "Diamond", image: "images/player_neo.png" },
  { id: "p4", name: "Apex", game: "League of Legends", rank: "Gold", image: "images/player_apex.png" },
  { id: "p5", name: "Volt", game: "Valorant", rank: "Gold", image: "images/player_volt.png" },
  { id: "p6", name: "Specter", game: "Overwatch", rank: "Silver", image: "images/player_specter.png" }
];

function getMockTournaments() {
  const t1 = {
    id: "t1-mock-id",
    shareToken: "token-1",
    tournamentName: "Zoltrakk Valorant Masters",
    game: "Valorant",
    description: "The premier Valorant event of Zoltrakk Arena. 4 top-tier teams face off for a grand prize pool in a high-stakes bracket.",
    rules: "1. Respect all players. 2. Standard map pool. 3. Best of 3 for Grand Finals.",
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    playerLimit: 32,
    bannerImage: "",
    adminName: "ZoltrakkAdmin",
    adminId: "admin-id",
    ownerUserId: "admin-id",
    ownerEmail: "admin@zoltrakk.com",
    status: "active",
    visibility: "public",
    joinType: "quick",
    settings: { joinApproval: false },
    removedPlayers: [],
    joinRequests: [],
    paymentWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    paidEntry: { enabled: false, entryFeeEth: "", verificationRequired: false },
    announcements: [
      { id: "a1", title: "Tournament is Live!", content: "Matches are now underway. Keep an eye on the schedule!", createdAt: nowIso() }
    ],
    prize: {
      amount: "1.5",
      type: "ETH",
      description: "1.5 ETH distributed to the champion team.",
      winnerCount: 1,
      verificationStatus: "verified",
      fundingTx: { txHash: "0x5c8e312a02ea7bcf87c67c514ffc186b86fb35efbb2a4bb49b49bcf20cfd470d" },
      claims: [],
      winnerConfirmed: false
    },
    teams: [
      { id: "team-1", name: "Team XO!", joinType: "open", members: [
        { name: "Asif", role: "Captain" }, { name: "Raffay", role: "Member" }, { name: "Volt", role: "Member" }, { name: "Specter", role: "Member" }, { name: "Xenon", role: "Member" }
      ] },
      { id: "team-2", name: "Alpha Squad", joinType: "open", members: [
        { name: "Apex", role: "Captain" }, { name: "Shadow", role: "Member" }, { name: "Wraith", role: "Member" }, { name: "Cypher", role: "Member" }, { name: "Omen", role: "Member" }
      ] },
      { id: "team-3", name: "Nexus Gaming", joinType: "open", members: [
        { name: "Phoenix", role: "Captain" }, { name: "Jett", role: "Member" }, { name: "Sage", role: "Member" }, { name: "Sova", role: "Member" }, { name: "Breach", role: "Member" }
      ] },
      { id: "team-4", name: "Shadow Hunters", joinType: "open", members: [
        { name: "Ghost", role: "Captain" }, { name: "Reaper", role: "Member" }, { name: "Viper", role: "Member" }, { name: "Raze", role: "Member" }, { name: "Reyna", role: "Member" }
      ] }
    ],
    matches: []
  };
  generateFullBracket(t1);
  t1.matches[0].a = "Team XO!";
  t1.matches[0].b = "Alpha Squad";
  t1.matches[0].status = "completed";
  t1.matches[0].winner = "Team XO!";
  t1.matches[0].score = "2 - 1";

  t1.matches[1].a = "Nexus Gaming";
  t1.matches[1].b = "Shadow Hunters";
  t1.matches[1].status = "completed";
  t1.matches[1].winner = "Nexus Gaming";
  t1.matches[1].score = "2 - 0";

  t1.matches[2].a = "Team XO!";
  t1.matches[2].b = "Nexus Gaming";
  t1.matches[2].status = "scheduled";

  const t2 = {
    id: "t2-mock-id",
    shareToken: "token-2",
    tournamentName: "Zoltrakk Rift Showdown",
    game: "League of Legends",
    description: "A fast-paced, double-elimination League of Legends tournament. Bring your team and battle for the title of Rift Champions.",
    rules: "1. Standard Summoner's Rift map. 2. Tournament draft mode. 3. No cheating or toxic behavior.",
    startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    playerLimit: 32,
    bannerImage: "",
    adminName: "ZoltrakkAdmin",
    adminId: "admin-id",
    ownerUserId: "admin-id",
    ownerEmail: "admin@zoltrakk.com",
    status: "upcoming",
    visibility: "public",
    joinType: "quick",
    settings: { joinApproval: false },
    removedPlayers: [],
    joinRequests: [],
    paymentWallet: "",
    paidEntry: { enabled: false, entryFeeEth: "", verificationRequired: false },
    announcements: [
      { id: "a2", title: "Registration is Open!", content: "Join now to secure your spot. Slots are filling fast!", createdAt: nowIso() }
    ],
    prize: {
      amount: "500",
      type: "Cash",
      description: "$500 cash prize split among the winning squad.",
      winnerCount: 1,
      verificationStatus: "none",
      fundingTx: null,
      claims: [],
      winnerConfirmed: false
    },
    teams: [
      { id: "team-5", name: "Pixel Gaming", joinType: "open", members: [
        { name: "Cyber", role: "Captain" }, { name: "Byte", role: "Member" }, { name: "Glitch", role: "Member" }, { name: "Pixel", role: "Member" }, { name: "Vector", role: "Member" }
      ] },
      { id: "team-6", name: "Vanguard Esports", joinType: "open", members: [
        { name: "Titan", role: "Captain" }, { name: "Rogue", role: "Member" }, { name: "Vortex", role: "Member" }, { name: "Aegis", role: "Member" }, { name: "Slayer", role: "Member" }
      ] }
    ],
    matches: []
  };
  generateFullBracket(t2);

  const t3 = {
    id: "t3-mock-id",
    shareToken: "token-3",
    tournamentName: "Zoltrakk CS2 Challenger Cup",
    game: "CS2",
    description: "The ultimate Counter-Strike 2 challenge. 4 teams entered, but only one walked away with the grand prize.",
    rules: "1. Standard competitive settings. 2. Active duty maps only. 3. Overtime enabled.",
    startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    playerLimit: 32,
    bannerImage: "",
    adminName: "ZoltrakkAdmin",
    adminId: "admin-id",
    ownerUserId: "admin-id",
    ownerEmail: "admin@zoltrakk.com",
    status: "completed",
    visibility: "public",
    joinType: "quick",
    settings: { joinApproval: false },
    removedPlayers: [],
    joinRequests: [],
    paymentWallet: "",
    paidEntry: { enabled: false, entryFeeEth: "", verificationRequired: false },
    announcements: [
      { id: "a3", title: "We Have a Champion!", content: "Congratulations to Zoltrakk Elite for winning the Challenger Cup!", createdAt: nowIso() }
    ],
    prize: {
      amount: "1.0",
      type: "ETH",
      description: "1.0 ETH prize fund.",
      winnerCount: 1,
      verificationStatus: "verified",
      fundingTx: { txHash: "0x8a9e312a02ea7bcf87c67c514ffc186b86fb35efbb2a4bb49b49bcf20cfd470d" },
      claims: [],
      winnerConfirmed: true
    },
    teams: [
      { id: "team-7", name: "Zoltrakk Elite", joinType: "open", members: [
        { name: "Neo", role: "Captain" }, { name: "Trinity", role: "Member" }, { name: "Morpheus", role: "Member" }, { name: "Link", role: "Member" }, { name: "Tank", role: "Member" }
      ] },
      { id: "team-8", name: "Alliance", joinType: "open", members: [
        { name: "S4", role: "Captain" }, { name: "Loda", role: "Member" }, { name: "Akke", role: "Member" }, { name: "EGM", role: "Member" }, { name: "Bulldog", role: "Member" }
      ] },
      { id: "team-9", name: "Navi Classic", joinType: "open", members: [
        { name: "Dendi", role: "Captain" }, { name: "Puppey", role: "Member" }, { name: "XBOCT", role: "Member" }, { name: "Kuroky", role: "Member" }, { name: "Funn1k", role: "Member" }
      ] },
      { id: "team-10", name: "Fnatic Legacy", joinType: "open", members: [
        { name: "JW", role: "Captain" }, { name: "Flusha", role: "Member" }, { name: "Pronax", role: "Member" }, { name: "Olofmeister", role: "Member" }, { name: "Krimz", role: "Member" }
      ] }
    ],
    matches: []
  };
  generateFullBracket(t3);
  t3.matches[0].a = "Zoltrakk Elite";
  t3.matches[0].b = "Alliance";
  t3.matches[0].status = "completed";
  t3.matches[0].winner = "Zoltrakk Elite";
  t3.matches[0].score = "16 - 10";

  t3.matches[1].a = "Navi Classic";
  t3.matches[1].b = "Fnatic Legacy";
  t3.matches[1].status = "completed";
  t3.matches[1].winner = "Navi Classic";
  t3.matches[1].score = "16 - 12";

  t3.matches[2].a = "Zoltrakk Elite";
  t3.matches[2].b = "Navi Classic";
  t3.matches[2].status = "completed";
  t3.matches[2].winner = "Zoltrakk Elite";
  t3.matches[2].score = "16 - 14";
  t3.winner = "Zoltrakk Elite";
  t3.completedAt = nowIso();
  t3.updatedAt = nowIso();

  return [t1, t2, t3];
}

function getMockLeaderboardEntries() {
  return [
    { id: "lb1", team_name: "Team XO!", wins: 15, losses: 3, rank: 1, game: "Valorant", notes: "Top performing Valorant roster.", created_at: nowIso(), updated_at: nowIso() },
    { id: "lb2", team_name: "Zoltrakk Elite", wins: 12, losses: 5, rank: 2, game: "CS2", notes: "CS2 Challenger Cup Champion.", created_at: nowIso(), updated_at: nowIso() },
    { id: "lb3", team_name: "Alpha Squad", wins: 10, losses: 6, rank: 3, game: "League of Legends", notes: "Consistent contender.", created_at: nowIso(), updated_at: nowIso() },
    { id: "lb4", team_name: "Nexus Gaming", wins: 8, losses: 8, rank: 4, game: "Valorant", notes: "Solid mid-table squad.", created_at: nowIso(), updated_at: nowIso() },
    { id: "lb5", team_name: "Pixel Gaming", wins: 5, losses: 10, rank: 5, game: "League of Legends", notes: "Recent qualifier team.", created_at: nowIso(), updated_at: nowIso() }
  ];
}

async function loadTournaments() {
  if (_tournamentsCache) return _tournamentsCache;
  let dbTours = [];
  try {
    const { data, error } = await supabaseClient
      .from("tournaments")
      .select("data")
      .order("created_at", { ascending: false });
    if (!error && data) {
      dbTours = data.map(r => r.data);
    }
  } catch (err) {
    console.error("Failed to load tournaments from DB:", err);
  }

  // Always merge mock tournaments
  const mock = getMockTournaments();
  const merged = [...dbTours];
  for (const mt of mock) {
    if (!merged.some(t => t.id === mt.id)) {
      merged.push(mt);
    }
  }

  _tournamentsCache = merged;
  return _tournamentsCache;
}

async function saveTournamentToSupabase(t) {
  t.updatedAt = nowIso();
  const user = _currentUserCache;
  const ownerId = t.ownerUserId || user?.id || null;
  const { error } = await supabaseClient
    .from("tournaments")
    .upsert({
      id: t.id,
      owner_id: ownerId,
      data: t,
      updated_at: t.updatedAt
    }, { onConflict: "id" });
  if (error) throw error;
}

async function deleteTournamentFromSupabase(id) {
  const { error } = await supabaseClient
    .from("tournaments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

let _leaderboardCache = [];

function getLeaderboardEntries() { return _leaderboardCache; }

async function loadLeaderboardEntries() {
  let dbEntries = [];
  try {
    const { data, error } = await supabaseClient
      .from("leaderboard_entries")
      .select("*")
      .order("rank", { ascending: true, nullsLast: true })
      .order("wins", { ascending: false });
    if (!error && data) {
      dbEntries = data;
    }
  } catch (err) {
    console.error("Failed to load leaderboard from DB:", err);
  }

  // Always merge mock leaderboard entries
  const mock = getMockLeaderboardEntries();
  const merged = [...dbEntries];
  for (const me of mock) {
    if (!merged.some(e => e.team_name.toLowerCase() === me.team_name.toLowerCase())) {
      merged.push(me);
    }
  }

  _leaderboardCache = merged;
  return _leaderboardCache;
}

async function saveLeaderboardEntry(entry) {
  const user = _currentUserCache;
  const payload = {
    id: entry.id,
    team_name: entry.team_name,
    game: entry.game || "",
    wins: entry.wins || 0,
    losses: entry.losses || 0,
    rank: entry.rank || 0,
    notes: entry.notes || "",
    updated_by: user?.id || null
  };
  const { error } = await supabaseClient
    .from("leaderboard_entries")
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
  await loadLeaderboardEntries();
}

async function deleteLeaderboardEntry(id) {
  const { error } = await supabaseClient
    .from("leaderboard_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
  await loadLeaderboardEntries();
}

// ── Auth Layer ────────────────────────────────────────────────
async function loadCurrentUser() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { _currentUserCache = null; return null; }
    const meta = user.user_metadata || {};
    _currentUserCache = {
      id: user.id,
      email: user.email,
      name: `${meta.firstName || ""} ${meta.lastName || ""}`.trim() || user.email?.split("@")[0] || "User",
      firstName: meta.firstName || "",
      lastName: meta.lastName || "",
      is_admin: false
    };
    // Load admin flag and theme preference from profile
    try {
      const { data: profile } = await supabaseClient.from("profiles").select("theme_pref, is_admin, best_game, rank, looking_for, teammates").eq("id", user.id).single();
      if (profile) {
        if (profile.theme_pref) {
          document.body.setAttribute("data-theme", profile.theme_pref);
          localStorage.setItem(THEME_KEY, profile.theme_pref);
        }
        _currentUserCache.is_admin = profile.is_admin === true;
        _currentUserCache.best_game = profile.best_game || "";
        _currentUserCache.rank = profile.rank || "";
        _currentUserCache.looking_for = profile.looking_for || "both";
        _currentUserCache.teammates = profile.teammates || [];
      }
    } catch {}
    return _currentUserCache;
  } catch {
    _currentUserCache = null;
    return null;
  }
}

function getCurrentUser() { return _currentUserCache; }

async function signUpUser(email, password, profile) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: profile }
  });
  if (error) throw error;
  if (!data.user) throw new Error("Signup failed. Check your email for confirmation.");
  return data;
}

async function signInUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOutUser() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  _currentUserCache = null;
}

// ── Player Squad ──────────────────────────────────────────────
function getUserPlayers() { return _userPlayersCache || []; }

async function loadUserPlayers() {
  const user = _currentUserCache;
  if (!user) { _userPlayersCache = []; return []; }
  try {
    const { data, error } = await supabaseClient
      .from("user_players")
      .select("data")
      .eq("user_id", user.id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    _userPlayersCache = data?.data || [];
    return _userPlayersCache;
  } catch (err) {
    console.error("Failed to load user players:", err);
    _userPlayersCache = [];
    return [];
  }
}

async function saveUserPlayers(data) {
  const user = _currentUserCache;
  if (!user) return;
  const withIds = data.map((p, i) => ({ ...p, id: p.id || uid() }));
  _userPlayersCache = withIds;
  try {
    const { data: existing, error: fetchError } = await supabaseClient
      .from("user_players")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const { error: updateError } = await supabaseClient
        .from("user_players")
        .update({
          data: withIds,
          updated_at: nowIso()
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseClient
        .from("user_players")
        .insert({
          user_id: user.id,
          data: withIds,
          updated_at: nowIso()
        });
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.error("Failed to save user players:", err);
  }
}

let _allPlayersCache = [];

function getAllPlayers() { return _allPlayersCache; }

async function loadAllPlayers() {
  try {
    const { data, error } = await supabaseClient
      .from("user_players")
      .select("data, user_id");
    if (error) throw error;
    const all = [];
    (data || []).forEach(row => {
      if (Array.isArray(row.data)) {
        row.data.forEach(p => {
          all.push({ ...p, userId: row.user_id });
        });
      }
    });
    _allPlayersCache = all;
    return _allPlayersCache;
  } catch (err) {
    console.error("Failed to load all players from DB:", err);
    _allPlayersCache = [];
    return [];
  }
}

// ── Toast / Loading Helpers ──────────────────────────────────
function showToast(msg, type) {
  const toast = document.createElement("div");
  toast.className = `toast ${type || "info"}`;
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: "fixed", bottom: "20px", right: "20px", zIndex: "9999",
    padding: "12px 20px", borderRadius: "8px", fontSize: ".9rem",
    background: type === "error" ? "#dc2626" : type === "success" ? "#16a34a" : "#333",
    color: "#fff", maxWidth: "360px", boxShadow: "0 4px 12px rgba(0,0,0,.25)",
    transition: "opacity .3s", opacity: "1"
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 3000);
}

function showLoading(el, msg) {
  if (!el) return;
  el.innerHTML = `<div class="loading-spinner" style="text-align:center;padding:20px">
    <div class="spinner"></div>
    <p style="color:var(--muted);margin-top:8px">${esc(msg || "Loading...")}</p>
  </div>`;
}

// ── Supabase Realtime ────────────────────────────────────────
let _tournamentChannel = null;

function subscribeToTournaments(onUpdate) {
  if (_tournamentChannel) return;
  _tournamentChannel = supabaseClient.channel("tournaments-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, (payload) => {
      if (payload.eventType === "INSERT") {
        const newData = payload.new.data;
        const arr = getTournaments();
        if (!arr.find(x => x.id === newData.id)) {
          arr.unshift(newData);
          _tournamentsCache = arr;
        }
      } else if (payload.eventType === "UPDATE") {
        const newData = payload.new.data;
        const arr = getTournaments();
        const idx = arr.findIndex(x => x.id === newData.id);
        if (idx >= 0) arr[idx] = newData;
        else arr.unshift(newData);
        _tournamentsCache = arr;
      } else if (payload.eventType === "DELETE") {
        const deletedId = payload.old?.id;
        if (deletedId) _tournamentsCache = getTournaments().filter(x => x.id !== deletedId);
      }
      if (onUpdate) onUpdate();
    })
    .subscribe();
}

function unsubscribeFromTournaments() {
  if (_tournamentChannel) {
    supabaseClient.removeChannel(_tournamentChannel);
    _tournamentChannel = null;
  }
}

let _leaderboardChannel = null;

function subscribeToLeaderboard(onUpdate) {
  if (_leaderboardChannel) return;
  _leaderboardChannel = supabaseClient.channel("leaderboard-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "leaderboard_entries" }, () => {
      loadLeaderboardEntries().then(() => { if (onUpdate) onUpdate(); });
    })
    .subscribe();
}

function unsubscribeFromLeaderboard() {
  if (_leaderboardChannel) {
    supabaseClient.removeChannel(_leaderboardChannel);
    _leaderboardChannel = null;
  }
}

function isTournamentAdmin(t) {
  const user = getCurrentUser();
  return Boolean(user && (user.id === t.ownerUserId || user.email === t.ownerEmail));
}

function normalizeMatch(m, index = 0) {
  const stages = ["Qualifier", "Semi Final", "Grand Final"];
  return {
    id: m.id || uid(),
    a: m.a || "TBD",
    b: m.b || "TBD",
    mode: m.mode || "auto",
    stage: m.stage || stages[Math.min(index, stages.length - 1)],
    date: m.date || "",
    time: m.time || "",
    status: m.status || "scheduled",
    winner: m.winner || ""
  };
}

function touchTournament(t) {
  t.updatedAt = nowIso();
  return t;
}

function getBracketSize(t) {
  const maxPlayers = t.playerLimit || 32;
  const isTeamGame = ["league of legends", "valorant", "cs2", "overwatch"].includes((t.game || "").toLowerCase());
  const divisor = isTeamGame ? 5 : 1;
  const estimatedTeams = Math.max(t.teams?.length || 0, Math.ceil(maxPlayers / divisor));
  let size = 4;
  while (size < estimatedTeams) {
    size *= 2;
  }
  return size;
}

function syncTeamsToBracket(t) {
  const teams = t.teams || [];
  const bracketSize = getBracketSize(t);
  const firstRoundMatchesCount = bracketSize / 2;

  // Re-generate if matches are empty or round mismatch
  const currentFirstRoundMatches = (t.matches || []).filter(m => m.stage === "Qualifier" || m.stage === "Round 1");
  if (!t.matches || t.matches.length === 0 || currentFirstRoundMatches.length !== firstRoundMatchesCount) {
    generateFullBracket(t);
    return;
  }

  // Update teams in first round
  for (let m = 0; m < firstRoundMatchesCount; m++) {
    const match = t.matches[m];
    if (match && match.status !== "completed") {
      const teamA = teams[m * 2];
      const teamB = teams[m * 2 + 1];
      match.a = teamA ? teamA.name : "TBD";
      match.b = teamB ? teamB.name : "TBD";
    }
  }
}

function generateFullBracket(t) {
  const teams = t.teams || [];
  const bracketSize = getBracketSize(t);
  const rounds = Math.log2(bracketSize);
  t.matches = [];

  for (let r = 0; r < rounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r + 1);
    const stage = r === rounds - 1 ? "Grand Final" : r === rounds - 2 ? "Semi Final" : "Qualifier";
    for (let m = 0; m < matchesInRound; m++) {
      const idx = r === 0 ? m * 2 : 0;
      const a = r === 0 ? (teams[idx]?.name || "TBD") : "TBD";
      const b = r === 0 ? (teams[idx + 1]?.name || "TBD") : "TBD";
      t.matches.push(normalizeMatch({
        id: uid(),
        a, b, stage,
        mode: "auto",
        status: "scheduled"
      }, t.matches.length));
    }
  }

  autoAssignTimes(t);
  return t;
}

function autoAssignTimes(t) {
  const matches = t.matches || [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  const stages = ["Qualifier", "Semi Final", "Grand Final"];
  let dayOffset = 0;
  let currentStage = "";

  matches.forEach((m, i) => {
    if (m.stage !== currentStage) {
      currentStage = m.stage;
      dayOffset = stages.indexOf(currentStage);
      if (dayOffset < 0) dayOffset = 0;
    }
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(10 + (i % 4) * 2, 0, 0, 0);
    m.date = d.toISOString().split("T")[0];
    m.time = d.toTimeString().split(" ")[0].slice(0, 5);
  });
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  document.body.setAttribute("data-theme", saved);
  const btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    btn.onclick = () => {
      const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.body.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
    };
  }
}

function initChatbot() {
  if (document.getElementById("chatbotBox")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button class="chatbot-toggle" id="chatbotToggle">&#129302;</button>
    <div class="chatbot-box" id="chatbotBox">
      <div class="chatbot-head">
        <span>Zoltrakk Helper</span>
        <button id="chatbotClose">&times;</button>
      </div>
      <div class="chatbot-messages" id="chatMessages">
        <div class="chat-msg bot">Welcome to Zoltrakk Arena. I can guide you with tournament creation, joining, schedule editing, and admin tools.</div>
      </div>
      <div class="chatbot-input">
        <input id="chatInput" placeholder="Ask anything...">
        <button class="btn" id="chatSend">Send</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const bot = {
    join: "Open a tournament link, then choose Create Team or Join Existing Team.",
    create: "Go to Create page, choose game, add lineup, then save tournament.",
    admin: "Creator can delete teams, reorder teams, auto-match, edit schedule, and set winners.",
    schedule: "Schedule page lists real matches from tournaments. Owners can edit date, stage, and results.",
    login: "Signup first, then login. Accounts sync locally and on Netlify cloud storage.",
    games: "Supported games: League of Legends, Valorant, CS2, Overwatch.",
    contact: "Use Contact page for support and location details.",
    default: "Try: schedule, create tournament, join team, admin powers, cloud sync."
  };

  const toggle = document.getElementById("chatbotToggle");
  const box = document.getElementById("chatbotBox");
  const close = document.getElementById("chatbotClose");
  const send = document.getElementById("chatSend");
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");

  const reply = (q) => {
    const text = q.toLowerCase();
    if (text.includes("schedule")) return bot.schedule;
    if (text.includes("join")) return bot.join;
    if (text.includes("create")) return bot.create;
    if (text.includes("admin")) return bot.admin;
    if (text.includes("login") || text.includes("sign") || text.includes("cloud")) return bot.login;
    if (text.includes("game")) return bot.games;
    if (text.includes("contact") || text.includes("support") || text.includes("location")) return bot.contact;
    return bot.default;
  };

  const addMsg = (text, type) => {
    const div = document.createElement("div");
    div.className = `chat-msg ${type}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  };

  const submit = () => {
    const q = input.value.trim();
    if (!q) return;
    addMsg(q, "user");
    input.value = "";
    setTimeout(() => addMsg(reply(q), "bot"), 260);
  };

  toggle.onclick = () => box.classList.toggle("open");
  close.onclick = () => box.classList.remove("open");
  send.onclick = submit;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

function normalizeHeaderNav() {
  const header = document.querySelector("header");
  if (!header) return;

  const user = getCurrentUser();
  const rawPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const page = rawPage === "tournament.html" ? "tournaments.html" : rawPage;
  const isActive = (href) => page === href.toLowerCase() ? "active" : "";

  // ── Desktop dropdown nav sections ──
  const sections = [
    { id: "play", label: "Play", links: [
      ["tournaments.html", "Browse Tournaments"],
      ["schedule.html", "Schedule"],
      ["leaderboard.html", "Leaderboard"],
    ]},
    { id: "community", label: "Community", links: [
      ["players.html", "Players"],
      ["team.html", "Teams"],
      ["contact.html", "Support"],
    ]},
    { id: "arena", label: "My Arena", links: [
      ["my-tournaments.html", "My Hub"],
      ["create.html", "Create Tournament"],
      ["profile.html", "Profile"],
      ["archive.html", "Archive"],
    ]},
  ];

  // ── Build desktop nav ──
  const desktopHtml = `<div class="desktop-nav">${sections.map(s => `
    <div class="nav-dropdown" data-dropdown="${s.id}">
      <button class="nav-btn" data-dropdown-btn="${s.id}">${s.label} <span class="dd-arrow">▾</span></button>
      <div class="dropdown-menu">${s.links.map(([href, label]) => `
        <a href="${href}" class="${isActive(href)}">${label}</a>`).join("")}
      </div>
    </div>`).join("")}</div>`;

  // ── Auth buttons ──
  let authHtml = "";
  if (user) {
    if (user.is_admin) authHtml += `<a href="admin.html" class="${isActive("admin.html")}">Admin</a>`;
    authHtml += `<a href="profile.html" class="${isActive("profile.html")}">Profile</a>`;
    authHtml += `<a href="#" data-logout>Logout</a>`;
  } else {
    authHtml += `<a href="signup.html" class="${isActive("signup.html")}">Sign Up</a>`;
    authHtml += `<a href="login.html" class="${isActive("login.html")}">Login</a>`;
  }

  // ── Replace header ──
  header.innerHTML = `
    <div class="logo-wrap"><a href="index.html" class="logo-text">Zoltrakk Arena</a></div>
    ${desktopHtml}
    <div class="nav-auth">${authHtml}</div>
    <button class="theme-toggle" data-theme-toggle>Theme</button>
    <button class="hamburger" id="mobileMenuBtn" aria-label="Menu">☰</button>
  `;

  // ── Desktop dropdown toggle ──
  document.querySelectorAll("[data-dropdown-btn]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = btn.closest(".nav-dropdown");
      const wasOpen = dd.classList.contains("open");
      document.querySelectorAll(".nav-dropdown.open").forEach(d => d.classList.remove("open"));
      if (!wasOpen) dd.classList.add("open");
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".nav-dropdown.open").forEach(d => d.classList.remove("open"));
  });

  // ── Mobile slide menu ──
  const menuBtn = document.getElementById("mobileMenuBtn");
  let slideMenu = document.querySelector(".mobile-slide-menu");
  let slideOverlay = document.querySelector(".mobile-slide-overlay");
  if (slideMenu) slideMenu.remove();
  if (slideOverlay) slideOverlay.remove();

  slideMenu = document.createElement("div");
  slideMenu.className = "mobile-slide-menu";
  let slideHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <strong style="font-size:1.05rem">Menu</strong>
    <button class="mobile-close-btn" id="mobileCloseBtn" style="background:none;border:none;color:var(--muted);font-size:1.3rem;cursor:pointer;padding:4px 8px">✕</button>
  </div>`;

  sections.forEach(s => {
    slideHtml += `<div style="margin-bottom:4px"><strong style="display:block;padding:6px 14px;font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">${s.label}</strong>`;
    s.links.forEach(([href, label]) => {
      slideHtml += `<a href="${href}" class="${isActive(href)}">${label}</a>`;
    });
    slideHtml += `</div>`;
  });

  slideHtml += `<div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)"><strong style="display:block;padding:6px 14px;font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Account</strong>`;
  if (user) {
    if (user.is_admin) slideHtml += `<a href="admin.html" class="${isActive("admin.html")}" style="font-weight:700;color:var(--primary)">Admin Panel</a>`;
    slideHtml += `<a href="profile.html" class="${isActive("profile.html")}">Profile</a>`;
    slideHtml += `<a href="#" data-logout-mobile>Logout</a>`;
  } else {
    slideHtml += `<a href="login.html" class="${isActive("login.html")}">Login</a>`;
    slideHtml += `<a href="signup.html" class="${isActive("signup.html")}">Sign Up</a>`;
  }
  slideHtml += `</div>`;
  slideMenu.innerHTML = slideHtml;
  document.body.appendChild(slideMenu);

  slideOverlay = document.createElement("div");
  slideOverlay.className = "mobile-slide-overlay";
  document.body.appendChild(slideOverlay);

  const openSlide = () => { slideMenu.classList.add("open"); slideOverlay.classList.add("open"); document.body.style.overflow = "hidden"; };
  const closeSlide = () => { slideMenu.classList.remove("open"); slideOverlay.classList.remove("open"); document.body.style.overflow = ""; };
  menuBtn?.addEventListener("click", openSlide);
  document.getElementById("mobileCloseBtn")?.addEventListener("click", closeSlide);
  slideOverlay.addEventListener("click", closeSlide);

  const mobLogout = slideMenu.querySelector("[data-logout-mobile]");
  if (mobLogout) mobLogout.onclick = async (e) => { e.preventDefault(); await signOutUser(); location.href = "login.html"; };

  // ── Desktop logout ──
  const logout = header.querySelector("[data-logout]");
  if (logout) logout.onclick = async (e) => { e.preventDefault(); await signOutUser(); location.href = "login.html"; };

  // ── Re-init theme toggle ──
  const themeBtn = header.querySelector("[data-theme-toggle]");
  if (themeBtn) themeBtn.onclick = () => {
    const cur = document.body.getAttribute("data-theme") || "light";
    const next = cur === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  };

  // ── Mobile bottom nav + slide-up panels ──
  let bottomNav = document.querySelector(".mobile-bottom-nav");
  let overlay = document.querySelector(".mobile-overlay");
  let panel = document.querySelector(".mobile-panel");
  if (bottomNav) bottomNav.remove();
  if (overlay) overlay.remove();
  if (panel) panel.remove();

  // Bottom nav
  bottomNav = document.createElement("nav");
  bottomNav.className = "mobile-bottom-nav";

  const bottomItems = [
    { id: "home", icon: "⌂", label: "Home", href: "index.html" },
    { id: "play", icon: "▶", label: "Play" },
    { id: "community", icon: "♦", label: "People" },
    { id: "arena", icon: "☆", label: "Me" },
  ];

  bottomNav.innerHTML = bottomItems.map(item => {
    if (item.href) {
      return `<a href="${item.href}" class="bottom-nav-item ${page === item.href.toLowerCase() ? "active" : ""}"><span class="bnv-icon">${item.icon}</span><span class="bnv-label">${item.label}</span></a>`;
    }
    return `<button class="bottom-nav-item" data-mpanel="${item.id}"><span class="bnv-icon">${item.icon}</span><span class="bnv-label">${item.label}</span></button>`;
  }).join("");
  document.body.appendChild(bottomNav);

  // Overlay
  overlay = document.createElement("div");
  overlay.className = "mobile-overlay";
  document.body.appendChild(overlay);

  // Panel
  panel = document.createElement("div");
  panel.className = "mobile-panel";
  panel.innerHTML = `<div class="mobile-panel-header"><span class="mobile-panel-title" id="mobilePanelTitle"></span><button class="mobile-panel-close" id="mobilePanelClose">✕</button></div><div class="mobile-panel-body" id="mobilePanelBody"></div>`;
  document.body.appendChild(panel);

  const panelTitle = document.getElementById("mobilePanelTitle");
  const panelBody = document.getElementById("mobilePanelBody");
  const panelClose = document.getElementById("mobilePanelClose");

  const openPanel = (sectionId) => {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    panelTitle.textContent = sec.label;
    panelBody.innerHTML = sec.links.map(([href, label]) =>
      `<a href="${href}" class="${isActive(href)}">${label}</a>`
    ).join("");
    panel.classList.add("open");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const closePanel = () => {
    panel.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  };

  document.querySelectorAll("[data-mpanel]").forEach(btn => {
    btn.addEventListener("click", () => openPanel(btn.dataset.mpanel));
  });
  panelClose?.addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  // Hide DB Schema link in footer for non-admins
  const schemaLinks = document.querySelectorAll('footer .footer-links a[href="schema.html"]');
  schemaLinks.forEach(link => {
    if (!user || !user.is_admin) {
      link.style.display = "none";
    } else {
      link.style.display = "";
    }
  });
}

function initHomeStats() {
  const row = document.getElementById("homeStatsRow");
  if (!row) return;
  const all = getTournaments();
  const active = all.filter((t) => OPEN_STATUSES.includes(t.status || "upcoming")).length;
  const teams = all.reduce((n, t) => n + (t.teams?.length || 0), 0);
  const matches = all.reduce((n, t) => n + (t.matches?.length || 0), 0);
  row.innerHTML = `
    <article class="stat-card"><strong>${all.length}</strong><span>Total Tournaments</span></article>
    <article class="stat-card"><strong>${active}</strong><span>Active Events</span></article>
    <article class="stat-card"><strong>${teams}</strong><span>Registered Teams</span></article>
    <article class="stat-card"><strong>${matches}</strong><span>Scheduled Matches</span></article>`;
}

function getRoleTemplate(game) {
  if (game === "League of Legends") return ["Top", "Jungle", "Mid", "ADC", "Support"];
  if (game === "Valorant") return ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"];
  if (game === "Overwatch") return ["Tank", "Damage", "Damage", "Support", "Support"];
  if (game === "CS2") return ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"];
  return [];
}

function statusLabel(status) {
  const clean = status || "upcoming";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function isArchivedTournament(t) {
  return ["completed", "cancelled"].includes((t.status || "").toLowerCase());
}

function participantTotal(t) {
  return (t.teams || []).reduce((sum, team) => sum + (team.members || []).length, 0);
}

function tournamentBanner(t) {
  return t.bannerImage || DEFAULT_BANNERS[t.game] || "images/background.jpg";
}

function completedWinners(t) {
  const matchWinners = (t.matches || []).map((m) => m.winner).filter(Boolean);
  return Array.from(new Set([...(t.winners || []), ...matchWinners]));
}

function prizeBadge(t) {
  if (!t.prize?.type && !t.prize?.amount) return "";
  const verified = t.prize.verificationStatus === "verified";
  return `<span class="tag ${verified ? "verified" : "unverified"}">${verified ? "Verified Prize" : "Prize Pending Review"}</span>`;
}

function hasMetaMask() {
  return Boolean(window.ethereum?.isMetaMask || window.ethereum);
}

function isEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test((address || "").trim());
}

function normalizeAddress(address) {
  return (address || "").trim();
}

function ethToWeiHex(amount) {
  const clean = String(amount || "").trim();
  if (!/^\d+(\.\d{1,18})?$/.test(clean)) throw new Error("Enter a valid ETH amount.");
  const [whole, fraction = ""] = clean.split(".");
  const wei = BigInt(whole || "0") * 1000000000000000000n + BigInt((fraction + "0".repeat(18)).slice(0, 18));
  if (wei <= 0n) throw new Error("ETH amount must be greater than 0.");
  return `0x${wei.toString(16)}`;
}

async function connectMetaMask() {
  if (!hasMetaMask()) throw new Error("MetaMask is not available in this browser.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No MetaMask account connected.");
  return accounts[0];
}

async function sendEthWithMetaMask({ to, amountEth }) {
  const recipient = normalizeAddress(to);
  if (!isEthAddress(recipient)) throw new Error("A valid payment wallet address is required.");
  const from = await connectMetaMask();
  const txHash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to: recipient, value: ethToWeiHex(amountEth) }]
  });
  return { from, to: recipient, amountEth: String(amountEth), txHash, chainId: await window.ethereum.request({ method: "eth_chainId" }), paidAt: nowIso() };
}

async function signWithMetaMask(message) {
  if (!hasMetaMask()) throw new Error("MetaMask is not available in this browser.");
  const from = await connectMetaMask();
  const signature = await window.ethereum.request({
    method: "personal_sign",
    params: [message, from]
  });
  return { from, signature, message, signedAt: nowIso() };
}

function safeShareUrl(t) {
  const url = new URL("tournament.html", location.href);
  url.searchParams.set("id", t.id);
  url.searchParams.set("share", t.shareToken || "");
  return url.href;
}

function paidEntrySummary(t) {
  if (!t.paidEntry?.enabled) return "";
  return `<span class="tag unverified">Paid Entry: ${esc(t.paidEntry.entryFeeEth)} ETH</span>`;
}

function playersForDisplay() {
  const allSquadPlayers = getAllPlayers();
  const merged = [...allSquadPlayers];
  
  // Merge current user's local squad players first for instant rendering
  const myPlayers = getUserPlayers();
  for (const mp of myPlayers) {
    if (!merged.some(p => p.name.toLowerCase() === mp.name.toLowerCase())) {
      merged.push({ ...mp, userId: _currentUserCache?.id });
    }
  }

  for (const mp of MOCK_PLAYERS) {
    if (!merged.some(p => p.name.toLowerCase() === mp.name.toLowerCase())) {
      merged.push(mp);
    }
  }
  return merged.map((p) => ({
    id: p.id,
    name: p.name,
    game: p.game,
    rank: p.rank || "Unranked",
    image: p.image || DEFAULT_PLAYER_IMAGE
  }));
}

function readOptionalImage(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve("");
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Please choose a valid image file."));
  if (file.size > MAX_PLAYER_IMAGE_BYTES) return Promise.reject(new Error("Image is too large. Use a file under 400KB."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

async function initPlayersPage() {
  const grid = document.getElementById("playerGrid");
  if (!grid) return;

  const form = document.getElementById("regForm");
  if (!form) return;

  const user = getCurrentUser();
  if (!user) {
    form.innerHTML = `<p class="error">Login required to manage your squad.</p>
      <p style="margin:12px 0;color:var(--muted)">Register players under your account so you can quickly add them to tournaments.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">
        <a class="btn" href="login.html">Go to Login</a>
        <a class="btn alt" href="signup.html">Create Account</a>
      </div>`;
    const listEl = document.getElementById("participantsList");
    if (listEl) listEl.style.display = "none";
    const totalP = document.querySelector("#totalRegistered")?.parentElement;
    if (totalP) totalP.style.display = "none";
  }

  const list = document.getElementById("participantsList");
  const total = document.getElementById("totalRegistered");
  const msg = document.getElementById("regMsg");
  const imageInput = document.getElementById("regImage");
  const imagePreview = document.getElementById("imagePreview");

  if (imageInput) {
    imageInput.addEventListener("change", async () => {
      if (!imagePreview) return;
      try {
        const dataUrl = await readOptionalImage(imageInput);
        if (!dataUrl) {
          imagePreview.classList.add("hidden");
          imagePreview.innerHTML = "";
          return;
        }
        imagePreview.classList.remove("hidden");
        imagePreview.innerHTML = `<img src="${dataUrl}" alt="Preview">`;
      } catch (err) {
        imagePreview.classList.add("hidden");
        imagePreview.innerHTML = "";
        msg.textContent = err.message;
      }
    });
  }

  const renderGrid = () => {
    const players = playersForDisplay();
    const q = (document.getElementById("searchPlayer")?.value || "").toLowerCase();
    const game = document.getElementById("filterGame")?.value || "";
    const rank = document.getElementById("filterRank")?.value || "";
    let filtered = players.filter((p) => {
      const rankVal = p.rank || "Unranked";
      return p.name.toLowerCase().includes(q) && (!game || p.game === game) && (!rank || rankVal === rank);
    });
    const rankOrder = { Diamond: 1, Platinum: 2, Gold: 3, Silver: 4, Unranked: 5 };
    filtered = filtered.sort((a, b) => (rankOrder[a.rank] || 99) - (rankOrder[b.rank] || 99));

    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state"><p>No registered players found matching your filters.</p></div>`;
      return;
    }

    grid.innerHTML = filtered.map((p) => `
      <div class="flip-wrap"><article class="player-card"><div class="player-card-inner">
      <img src="${p.image}" alt="${esc(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_PLAYER_IMAGE}'">
      <div class="player-meta">
      <h3>${esc(p.name)}${p.rank === "Diamond" ? '<span class="diamond">DIA</span>' : ""}</h3>
      <p>${esc(p.game)}</p><span class="badge">${esc(p.rank)}</span></div></div></article></div>`).join("");
  };

  ["searchPlayer", "filterGame", "filterRank"].forEach((id) => document.getElementById(id)?.addEventListener("input", renderGrid));

  const renderParticipants = () => {
    if (!user) return;
    const all = getUserPlayers();
    total.textContent = all.length;
    if (!all.length) {
      list.innerHTML = "<li><span>Your squad is empty. Register players below.</span></li>";
      renderGrid();
      return;
    }
    list.innerHTML = all.map((p, i) => {
      const thumb = p.image
        ? `<img class="participant-thumb" src="${p.image}" alt="" onerror="this.onerror=null;this.src='${DEFAULT_PLAYER_IMAGE}'">`
        : `<img class="participant-thumb" src="${DEFAULT_PLAYER_IMAGE}" alt="">`;
      return `<li>${thumb}<span>${esc(p.name)} · ${esc(p.game)}${p.rank ? ` · ${esc(p.rank)}` : ""}</span><button data-i="${i}">Remove</button></li>`;
    }).join("");
    list.querySelectorAll("button").forEach((b) => b.onclick = async () => {
      const a = getUserPlayers();
      a.splice(+b.dataset.i, 1);
      await saveUserPlayers(a);
      await loadAllPlayers();
      renderParticipants();
    });
    renderGrid();
  };

  if (user) {
    renderParticipants();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      msg.className = "error";
      const name = document.getElementById("regName").value.trim();
      const game = document.getElementById("regGame").value;
      const rank = document.getElementById("regRank")?.value || "";
      if (!name) return void (msg.textContent = "Player name is required.");
      const all = getUserPlayers();
      if (all.length >= 10) return void (msg.textContent = "Squad limit reached (10 players per account).");
      if (all.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return void (msg.textContent = "A player with this name is already in your squad.");
      }
      try {
        const image = await readOptionalImage(imageInput);
        all.push({ id: uid(), name, game, rank: rank || "Unranked", image, updatedAt: nowIso() });
        await saveUserPlayers(all);
        await loadAllPlayers();
        form.reset();
        if (imagePreview) {
          imagePreview.classList.add("hidden");
          imagePreview.innerHTML = "";
        }
        msg.className = "success";
        msg.textContent = `Player "${name}" added to your squad.`;
        renderParticipants();
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  } else {
    renderGrid();
  }
}

function initSignupPage() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  const pass = document.getElementById("pass");
  pass.addEventListener("input", () => {
    const v = pass.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[a-z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const bar = document.getElementById("strengthBar");
    if (bar) {
      bar.style.width = `${score * 20}%`;
      bar.style.background = score <= 2 ? "#dc2626" : score <= 4 ? "#f59e0b" : "#16a34a";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const setErr = (id, txt) => (document.getElementById(id).textContent = txt);
    ["fNameErr", "lNameErr", "ageErr", "emailErr", "passErr", "matchErr"].forEach((id) => setErr(id, ""));
    let ok = true;
    const f = document.getElementById("fName").value.trim();
    const l = document.getElementById("lName").value.trim();
    const a = document.getElementById("age").value.trim();
    const em = document.getElementById("email").value.trim().toLowerCase();
    const p = pass.value;
    const c = document.getElementById("confirmPass").value;

    if (!f) { setErr("fNameErr", "First name is required."); ok = false; }
    if (!l) { setErr("lNameErr", "Last name is required."); ok = false; }
    if (!a) { setErr("ageErr", "Age is required."); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr("emailErr", "Invalid Email Format"); ok = false; } else setErr("emailErr", "Valid Email");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(p)) { setErr("passErr", "Password must be 8+ chars and include upper/lower/number/special."); ok = false; }
    if (p !== c) { setErr("matchErr", "Passwords do not match."); ok = false; }
    if (!ok) return;

    const signupMsg = document.getElementById("signupSuccess");
    try {
      signupMsg.textContent = "Creating account...";
      const result = await signUpUser(em, p, { firstName: f, lastName: l, age: a });
      // After signup, attempt to auto-login (email gets auto-confirmed by DB trigger)
      signupMsg.textContent = "Signing you in...";
      await new Promise(r => setTimeout(r, 1000));
      await signInUser(em, p);
      await loadCurrentUser();
      signupMsg.textContent = "Account created. Redirecting...";
      setTimeout(() => { location.href = "my-tournaments.html"; }, 650);
    } catch (err) {
      if (err.message?.includes("already")) setErr("emailErr", "An account with this email already exists.");
      else setErr("emailErr", err.message || "Signup failed. Please try again.");
    }
  });
}

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  const eye = document.getElementById("eyeBtn");
  const pass = document.getElementById("lPass");
  if (!eye || !pass) return;

  eye.onclick = () => {
    const isHidden = pass.type === "password";
    pass.type = isHidden ? "text" : "password";
    eye.innerHTML = isHidden ? "&#128065;&#65039;" : "&#128584;";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    document.getElementById("eErr").textContent = "";
    document.getElementById("pErr").textContent = "";
    document.getElementById("loginStatus").textContent = "";
    const em = document.getElementById("lEmail").value.trim().toLowerCase();
    const p = pass.value.trim();
    let ok = true;
    if (!em) { document.getElementById("eErr").textContent = "Email is required."; ok = false; }
    if (!p) { document.getElementById("pErr").textContent = "Password is required."; ok = false; }
    if (!ok) return;

    const status = document.getElementById("loginStatus");
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      await signInUser(em, p);
      await loadCurrentUser();
      status.className = "success";
      status.textContent = "Login successful. Redirecting...";
      setTimeout(() => { location.href = "my-tournaments.html"; }, 550);
    } catch (err) {
      status.className = "error";
      if (err.message?.toLowerCase().includes("email not confirmed")) {
        status.textContent = "Email not confirmed. Try signing up again — we auto-confirm new accounts now.";
      } else {
        status.textContent = err.message || "Invalid email or password.";
      }
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  });
}

function initCreateTournamentPage() {
  const form = document.getElementById("createTournamentForm");
  if (!form) return;
  const user = getCurrentUser();
  const gameSelect = document.getElementById("tournamentGame");
  const lineupFields = document.getElementById("lineupFields");
  const hint = document.getElementById("gameSystemHint");
  const msg = document.getElementById("createTournamentMsg");
  const adminInput = document.getElementById("adminName");

  if (!user) {
    form.innerHTML = `
      <p class="error">You must login first to create tournaments.</p>
      <p style="margin:12px 0 0;color:var(--muted)">Don't have an account? Create one to start hosting tournaments.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">
        <a class="btn" href="login.html">Go to Login</a>
        <a class="btn alt" href="signup.html">Create Account</a>
      </div>`;
    return;
  }
  adminInput.value = user.name;
  adminInput.readOnly = true;

  const renderLineup = () => {
    const game = gameSelect.value;
    const roles = getRoleTemplate(game);
    lineupFields.innerHTML = "";
    if (!roles.length) return void (hint.textContent = "");
    hint.textContent = `${game} role system selected.`;
    lineupFields.innerHTML = `<label>Optional: Create first team now</label>` + roles.map((r, i) => `
      <div class="form-grid" style="margin-bottom:10px">
        <div><input data-player-name placeholder="Player ${i + 1} name"></div>
        <div><input data-player-role value="${r}" readonly></div>
      </div>`).join("");
  };
  gameSelect.addEventListener("change", renderLineup);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    const tournamentName = document.getElementById("tournamentName").value.trim();
    const game = gameSelect.value;
    if (!tournamentName || !game) return void (msg.textContent = "Please fill tournament name and game.");
    const tId = uid();
    const adminId = uid();
    const names = Array.from(document.querySelectorAll("[data-player-name]")).map((el) => el.value.trim());
    const roles = Array.from(document.querySelectorAll("[data-player-role]")).map((el) => el.value.trim());
    const firstTeamReady = names.length > 0 && names.every(Boolean);

    let bannerImage = "";
    try {
      bannerImage = await readOptionalImage(document.getElementById("tournamentBanner"));
    } catch (err) {
      return void (msg.textContent = err.message);
    }

    const prizeType = document.getElementById("prizeType").value;
    const prizeAmount = document.getElementById("prizeAmount").value.trim();
    const paidEnabled = document.getElementById("paidEntryEnabled").value === "true";
    const entryFeeEth = document.getElementById("entryFeeEth").value.trim();
    const paymentWallet = normalizeAddress(document.getElementById("paymentWallet").value);
    if (paidEnabled) {
      if (!entryFeeEth) return void (msg.textContent = "Entry fee is required for paid tournaments.");
      try { ethToWeiHex(entryFeeEth); } catch (err) { return void (msg.textContent = err.message); }
      if (!isEthAddress(paymentWallet)) return void (msg.textContent = "Enter a valid payment wallet address for paid tournaments.");
    }
    if (prizeType === "ETH" && paymentWallet && !isEthAddress(paymentWallet)) {
      return void (msg.textContent = "Enter a valid wallet address for ETH prize funding.");
    }
    const t = touchTournament({
      id: tId,
      shareToken: uid(),
      tournamentName,
      game,
      description: document.getElementById("tournamentDescription").value.trim(),
      rules: document.getElementById("tournamentRules").value.trim(),
      startsAt: document.getElementById("tournamentDateTime").value,
      playerLimit: Math.max(2, Number(document.getElementById("playerLimit").value) || 32),
      bannerImage,
      adminName: user.name,
      adminId,
      ownerUserId: user.id,
      ownerEmail: user.email,
      status: "upcoming",
      visibility: document.getElementById("tournamentVisibility").value,
      joinType: document.getElementById("tournamentJoinType").value,
      settings: { joinApproval: document.getElementById("tournamentJoinType").value === "request" },
      removedPlayers: [],
      joinRequests: [],
      paymentWallet,
      paidEntry: {
        enabled: paidEnabled,
        entryFeeEth: paidEnabled ? entryFeeEth : "",
        verificationRequired: paidEnabled
      },
      announcements: [],
      prize: {
        amount: prizeAmount,
        type: prizeType,
        description: document.getElementById("prizeDescription").value.trim(),
        winnerCount: Math.max(1, Number(document.getElementById("winnerCount").value) || 1),
        verificationStatus: prizeType || prizeAmount ? "pending" : "none",
        fundingTx: null,
        claims: [],
        winnerConfirmed: false
      },
      teams: firstTeamReady ? [{ id: uid(), name: `${user.name} Team`, members: names.map((n, i) => ({ name: n, role: roles[i] })) }] : [],
      matches: generateFullBracket({
        playerLimit: Math.max(2, Number(document.getElementById("playerLimit").value) || 32),
        game,
        teams: firstTeamReady ? [{ id: uid(), name: `${user.name} Team`, members: names.map((n, i) => ({ name: n, role: roles[i] })) }] : []
      }).matches,
      createdAt: nowIso(),
      completedAt: null
    });

    const all = getTournaments();
    all.push(t);
    _tournamentsCache = all;
    try {
      await saveTournamentToSupabase(t);
    } catch (err) {
      msg.textContent = "Saved locally but failed to sync to database: " + err.message;
    }
    form.reset();
    adminInput.value = user.name;
    lineupFields.innerHTML = "";
    hint.textContent = "";
    msg.className = "success";
    const link = safeShareUrl(t);
    msg.innerHTML = `
      <p style="margin:0 0 10px"><strong>Tournament created!</strong> Share the link with friends so they can join teams.</p>
      <p style="word-break:break-all;margin:0 0 12px"><a href="${link}">${link}</a></p>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        <a class="btn" href="${link}">Open Tournament</a>
        <a class="btn alt" href="schedule.html?tournament=${tId}">View Schedule</a>
        <button type="button" class="btn alt" id="copyNewTournamentLink">Copy Share Link</button>
      </div>`;
    document.getElementById("copyNewTournamentLink")?.addEventListener("click", async () => {
      const btn = document.getElementById("copyNewTournamentLink");
      try {
        await navigator.clipboard.writeText(link);
        btn.textContent = "Copied!";
      } catch {
        btn.textContent = "Copy failed — use link above";
      }
    });
  });
}

function initTournamentsPage() {
  const card = document.querySelector("[data-created-tournaments]");
  if (!card) return;
  const params = new URLSearchParams(location.search);
  const search = document.getElementById("tournamentSearch");
  const gameFilter = document.getElementById("tournamentGameFilter");
  const sort = document.getElementById("tournamentSort");
  const requestedGame = params.get("game") || "";
  if (requestedGame) {
    gameFilter.value = requestedGame;
    const note = document.getElementById("activeGameFilterNote");
    if (note) note.textContent = `Showing only ${requestedGame} tournaments.`;
  }

  const render = () => {
    const q = (search.value || "").toLowerCase();
    const game = gameFilter.value;
    let all = getTournaments().filter((t) => !isArchivedTournament(t) && t.visibility !== "private");
    all = all.filter((t) => {
      const haystack = `${t.tournamentName} ${t.game} ${t.description || ""}`.toLowerCase();
      return haystack.includes(q) && (!game || t.game === game);
    });
    if (sort.value === "popular") all.sort((a, b) => participantTotal(b) - participantTotal(a));
    else if (sort.value === "upcoming") all.sort((a, b) => new Date(a.startsAt || a.createdAt) - new Date(b.startsAt || b.createdAt));
    else if (sort.value === "active") all.sort((a, b) => Number((b.status || "") === "active") - Number((a.status || "") === "active"));
    else all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!all.length) {
      card.innerHTML = `<div class="empty-state"><p>No public tournaments match this view.</p><a class="btn" href="create.html">Create Tournament</a></div>`;
      return;
    }
    card.innerHTML = all.map((t) => tournamentCardHtml(t)).join("");
    bindTournamentCardCopies(card);
  };

  [search, gameFilter, sort].forEach((el) => el.addEventListener("input", render));
  render();

  // Realtime via Supabase subscriptions
  subscribeToTournaments(render);
}

function tournamentCardHtml(t) {
  const link = `tournament.html?id=${t.id}&share=${t.shareToken || ""}`;
  const teamCount = t.teams?.length || 0;
  const matchCount = t.matches?.length || 0;
  const joinLabel = t.joinType === "request" ? "Approval needed" : "Quick join";
  return `<article class="tournament-card card">
    <img class="tournament-banner" src="${tournamentBanner(t)}" alt="${esc(t.game)} tournament banner" loading="lazy">
    <div class="tournament-card-body">
      <h3>${esc(t.tournamentName)} <span class="muted-game">(${esc(t.game)})</span></h3>
      <p style="color:var(--muted);font-size:.88rem;margin:4px 0">${formatDate12h(t.startsAt)}</p>
      <p>${esc(t.description || "Create teams, schedule matches, submit results, and compete for the top spot.")}</p>
      <div class="tournament-meta">
        <span class="tag status-${esc(t.status || "upcoming")}">${statusLabel(t.status)}</span>
        <span class="tag">${teamCount} teams</span>
        <span class="tag">${participantTotal(t)} players</span>
        <span class="tag">${matchCount} matches</span>
        <span class="tag">${esc(joinLabel)}</span>
        ${prizeBadge(t)}
        ${paidEntrySummary(t)}
      </div>
      <a class="btn" href="${link}">Open Tournament</a>
      <a class="btn alt" href="schedule.html?tournament=${t.id}">View Schedule</a>
      <button class="btn alt" data-copy="${link}">Copy Share Link</button>
    </div>
  </article>`;
}

function bindTournamentCardCopies(root) {
  root.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
    const abs = `${location.origin}${location.pathname.replace(/\/[^/]*$/, "/")}${b.dataset.copy}`;
    try {
      await navigator.clipboard.writeText(abs);
      b.textContent = "Copied!";
      setTimeout(() => { b.textContent = "Copy Share Link"; }, 2000);
    } catch {
      b.textContent = "Copy blocked";
    }
  });
}

async function saveTournament(t) {
  touchTournament(t);
  const arr = getTournaments();
  const idx = arr.findIndex((x) => x.id === t.id);
  if (idx >= 0) arr[idx] = t;
  else arr.push(t);
  _tournamentsCache = arr;
  try {
    await saveTournamentToSupabase(t);
  } catch (err) {
    console.error("Failed to save tournament to Supabase:", err);
  }
}

// ── Export / Import Backup ───────────────────────────────────
function exportTournamentAsJson(t) {
  const data = JSON.stringify(t, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zoltrakk-tournament-${(t.tournamentName || "export").replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${t.id.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Tournament exported successfully", "success");
}

function importTournamentFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.tournamentName || !data.game) {
          reject(new Error("Invalid tournament file: missing name or game"));
          return;
        }
        if (typeof data.teams === "undefined" || typeof data.matches === "undefined") {
          reject(new Error("Invalid tournament file: missing teams or matches"));
          return;
        }
        data.id = uid();
        data.shareToken = uid();
        data.createdAt = nowIso();
        data.updatedAt = nowIso();
        data.status = "upcoming";
        data.completedAt = null;
        const user = getCurrentUser();
        if (user) {
          data.ownerUserId = user.id;
          data.ownerEmail = user.email;
          data.adminName = user.name;
          data.adminId = uid();
        }
        data.announcements = data.announcements || [];
        data.joinRequests = data.joinRequests || [];
        data.removedPlayers = data.removedPlayers || [];
        data.matches = (data.matches || []).map((m) => {
          m.id = m.id || uid();
          return m;
        });
        data.teams = (data.teams || []).map((team) => {
          team.id = team.id || uid();
          team.members = (team.members || []).map((m) => ({ ...m }));
          return team;
        });
        await saveTournament(data);
        resolve(data);
      } catch (err) {
        reject(new Error("Invalid tournament file: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function renderDetailWithAccessCheck(t, root) {
  const shareParam = new URLSearchParams(location.search).get("share") || "";
  if (t.visibility === "private" && shareParam !== t.shareToken) {
    root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <p style="font-size:1.1rem;margin:0 0 8px;font-weight:700">Private Tournament</p>
      <p style="color:var(--muted);margin:0 0 4px">This tournament is private. You need a valid invite link to access it.</p>
      <a class="btn" href="tournaments.html">Browse Tournaments</a>
    </div>`;
    return false;
  }
  renderDetail(t);
  return true;
}

function initTournamentDetailPage() {
  const root = document.getElementById("tournamentDetailRoot");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) { root.innerHTML = `<div class="card" style="padding:20px"><p>No tournament ID in URL.</p><a class="btn" href="tournaments.html">Browse Tournaments</a></div>`; return; }
  trackTournamentView(id);
  function fetchTournamentFromStore() {
    const all = getTournaments();
    return all.find((x) => x.id === id);
  }
  let t = fetchTournamentFromStore();
  if (!t) {
    root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <p style="font-size:1.1rem;margin:0 0 8px;font-weight:700">Loading tournament...</p>
      <p style="color:var(--muted);margin:0 0 14px">Fetching from database.</p>
      <div class="loading-spinner" style="text-align:center;padding:10px"><div class="spinner"></div></div>
    </div>`;
    (async () => {
      try {
        const { data } = await supabaseClient
          .from("tournaments")
          .select("data")
          .eq("id", id)
          .single();
        if (data?.data) {
          t = data.data;
          if (!_tournamentsCache) _tournamentsCache = [];
          const idx = _tournamentsCache.findIndex(x => x.id === t.id);
          if (idx >= 0) _tournamentsCache[idx] = t;
          else _tournamentsCache.push(t);
        }
      } catch {}
      if (!t) {
        root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
          <p style="font-size:1.1rem;margin:0 0 8px;font-weight:700">Tournament not found</p>
          <p style="color:var(--muted);margin:0 0 4px">The tournament you're looking for doesn't exist or hasn't been created yet.</p>
          <p style="color:var(--muted);margin:0 0 16px">Make sure the link is correct and the tournament has been saved to the database.</p>
          <a class="btn" href="tournaments.html">Browse Tournaments</a>
        </div>`;
        return;
      }
      renderDetailWithAccessCheck(t, root);
  })();
  return;
  }
  renderDetailWithAccessCheck(t, root);
  subscribeToTournaments(() => {
    const fresh = fetchTournamentFromStore();
    if (fresh && fresh.updatedAt !== t.updatedAt) {
      t = fresh;
      renderDetailWithAccessCheck(t, root);
    }
  });
}

function renderDetail(t) {
  const root = document.getElementById("tournamentDetailRoot");
  if (!root) return;
  const isAdmin = isTournamentAdmin(t);
  t.teams = t.teams || [];
  t.matches = (t.matches || []).map((m, i) => normalizeMatch(m, i));
  t.removedPlayers = t.removedPlayers || [];
  t.joinRequests = t.joinRequests || [];
  t.settings = t.settings || { joinApproval: false };
  t.shareToken = t.shareToken || uid();
  t.paidEntry = t.paidEntry || { enabled: false, entryFeeEth: "", verificationRequired: false };
  t.prize = t.prize || { verificationStatus: "none", claims: [], winnerConfirmed: false };
  const teamCount = t.teams.length;
  const matchCount = t.matches.length;

  root.innerHTML = `
    ${/* ── BANNER ── */""}
    <div class="card" style="overflow:hidden;margin-bottom:18px">
      <div style="position:relative">
        <img class="detail-banner" src="${tournamentBanner(t)}" alt="${esc(t.game)} banner">
        <div style="position:absolute;bottom:14px;left:14px;display:flex;flex-wrap:wrap;gap:8px">
          <span class="tag status-${esc(t.status || "upcoming")}" style="background:var(--surface);backdrop-filter:blur(8px);font-size:.82rem;padding:6px 14px">${statusLabel(t.status)}</span>
          <span class="tag" style="background:var(--surface);backdrop-filter:blur(8px);font-size:.82rem;padding:6px 14px">${t.visibility === "private" ? "Private" : "Public"}</span>
          <span class="tag" style="background:var(--surface);backdrop-filter:blur(8px);font-size:.82rem;padding:6px 14px">${t.joinType === "request" ? "Approval needed" : "Quick join"}</span>
          ${t.paidEntry.enabled ? `<span class="tag" style="background:var(--surface);backdrop-filter:blur(8px);font-size:.82rem;padding:6px 14px;color:var(--primary)">MetaMask verified</span>` : ""}
          ${prizeBadge(t)}
        </div>
      </div>
      <div style="padding:20px 22px">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:start;gap:12px">
          <div>
            <h2 style="margin:0 0 4px">${esc(t.tournamentName)}</h2>
            <p style="margin:0;color:var(--muted);font-weight:600">${esc(t.game)} — Hosted by ${esc(t.adminName)}</p>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <a class="btn alt" href="schedule.html?tournament=${t.id}" style="padding:10px 18px;font-size:.85rem">Schedule</a>
            <button class="btn ghost" id="copyTournamentLink" style="padding:10px 18px;font-size:.85rem">Copy Link</button>
            <button class="btn alt" id="exportTournamentBtn" style="padding:10px 18px;font-size:.85rem">Export Backup</button>
            ${isAdmin ? `
            <select id="statusSelect" class="inline-select" style="width:auto;min-width:120px;padding:9px 12px;font-size:.85rem">
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button class="btn" id="saveStatusBtn" style="padding:10px 18px;font-size:.85rem">Update</button>` : ""}
          </div>
        </div>
        ${t.description ? `<p style="margin-top:14px">${esc(t.description)}</p>` : ""}
        <div class="stats-row" style="margin-top:16px">
          <div class="stat-card" style="padding:14px 12px"><strong>${formatDate12h(t.startsAt)}</strong><span>Start Date</span></div>
          <div class="stat-card" style="padding:14px 12px"><strong>${t.playerLimit || 32}</strong><span>Player Limit</span></div>
          <div class="stat-card" style="padding:14px 12px"><strong>${teamCount}</strong><span>Teams</span></div>
          <div class="stat-card" style="padding:14px 12px"><strong>${matchCount}</strong><span>Matches</span></div>
          ${t.paidEntry.enabled ? `<div class="stat-card" style="padding:14px 12px"><strong>${esc(t.paidEntry.entryFeeEth)} ETH</strong><span>Entry Fee</span></div>` : ""}
        </div>
        ${t.rules ? `<div class="rules-box" style="margin-top:14px"><strong>Rules</strong><p style="margin:8px 0 0">${esc(t.rules)}</p></div>` : ""}
        <div class="rules-box" style="margin-top:10px">
          <strong>Share Link</strong>
          <p style="margin:6px 0 0;font-size:.9rem;word-break:break-all" id="shareUrl">${safeShareUrl(t)}</p>
          <p class="hint-text" style="margin:4px 0 0">Admin controls stay protected by creator login or private admin key.</p>
        </div>
      </div>
    </div>

    ${/* ── ADMIN: EDIT TOURNAMENT ── */""}
    ${isAdmin ? `<div class="card" style="padding:20px 22px;margin-bottom:18px">
      <h3>Edit Tournament</h3>
      <div class="form-grid">
        <div><label>Name</label><input id="editName" value="${esc(t.tournamentName)}"></div>
        <div><label>Date & Time</label><input id="editStartsAt" type="datetime-local" value="${esc(t.startsAt || "")}"></div>
      </div>
      <div>
        <label>Game</label><select id="editGame"><option>League of Legends</option><option>Valorant</option><option>CS2</option><option>Overwatch</option></select>
      </div>
      <label>Description</label><textarea id="editDescription" rows="2">${esc(t.description)}</textarea>
      <label>Rules</label><textarea id="editRules" rows="2">${esc(t.rules)}</textarea>
      <div class="form-grid">
        <div><label>Banner Image</label><input id="editBanner" type="file" accept="image/*"></div>
        <div><label>Visibility</label><select id="editVisibility"><option value="public">Public</option><option value="private">Private</option></select></div>
      </div>
      <div class="form-grid">
        <div><label>Join Mode</label><select id="editJoinType"><option value="quick">Quick join</option><option value="request">Request approval</option></select></div>
        <div><label>Player Limit</label><input id="editPlayerLimit" type="number" min="2" max="256" value="${esc(t.playerLimit || 32)}"></div>
      </div>
      <div class="form-grid">
        <div><label>Paid Entry</label><select id="editPaidEntry"><option value="false">Free</option><option value="true">MetaMask verify</option></select></div>
        <div><label>Entry Fee (ETH)</label><input id="editEntryFeeEth" value="${esc(t.paidEntry?.entryFeeEth)}"></div>
      </div>
      <label>Payment Wallet Address</label><input id="editPaymentWallet" value="${esc(t.paymentWallet)}" placeholder="0x...">
      <div class="form-grid">
        <div><label>Prize Amount</label><input id="editPrizeAmount" value="${esc(t.prize?.amount)}"></div>
        <div><label>Prize Type</label><select id="editPrizeType"><option value="">No prize</option><option>ETH</option><option>Cash</option><option>Gift Card</option><option>Merch</option><option>In-game Reward</option></select></div>
      </div>
      <div class="form-grid">
        <div><label>Prize Description</label><input id="editPrizeDescription" value="${esc(t.prize?.description)}"></div>
        <div><label>Winners</label><input id="editWinnerCount" type="number" min="1" max="16" value="${esc(t.prize?.winnerCount || 1)}"></div>
      </div>
      <button class="btn" id="saveTournamentEdit" style="margin-top:6px">Save Changes</button>
      ${t.prize?.type === "ETH" && t.prize?.amount ? `<button class="btn alt" id="fundPrizeBtn">Fund Prize via MetaMask</button>` : ""}
      ${t.prize?.fundingTx && t.prize?.verificationStatus !== "verified" ? `<button class="btn alt" id="verifyPrizeBtn">Mark Prize Verified</button>` : ""}
      ${t.prize?.verificationStatus === "verified" ? `<button class="btn alt" id="confirmWinnersBtn">Confirm Winners</button>` : ""}
      ${t.prize?.fundingTx ? `<p class="success" style="margin-top:8px">Prize funding recorded: ${esc(t.prize.fundingTx.txHash)}</p>` : ""}
      <p id="editMsg" class="error" style="margin-top:8px"></p>
    </div>` : ""}

    ${/* ── JOIN TOURNAMENT ── */""}
    <div class="card" style="padding:20px 22px;margin-bottom:18px">
      <h3>Join Tournament</h3>
      <p class="hint-text" style="margin-top:0">${t.joinType === "request" ? "This tournament requires creator approval. Submit a request and the host will review it." : "Quick join — first come, first served."}</p>
      ${t.visibility === "private" ? `<div class="rules-box"><strong>Private Tournament</strong><p>You can only access this tournament through the share link. It won't appear in the public Browse list.</p></div>` : ""}
      ${t.paidEntry.enabled ? `<div class="rules-box" style="border-color:color-mix(in srgb, var(--primary) 40%, var(--border))"><strong>MetaMask Required</strong><p>Joining this tournament requires signing a free MetaMask verification. Your wallet address is recorded. No ETH is sent.</p></div>` : ""}
      <div class="form-grid">
        <div><label>Your Name</label><input id="joinerName" placeholder="Enter your name"></div>
        <div><label>Choose</label><select id="joinMode"><option value="create">Create Team</option><option value="join">Join Existing Team</option></select></div>
      </div>
      <div id="squadQuickSelect"></div>
      <div id="joinDynamic"></div>
      <button class="btn" id="joinBtn" style="margin-top:10px">Submit</button>
      <p class="error" id="joinMsg"></p>
      <div class="rules-box" style="margin-top:10px"><strong>MetaMask & Wallet Safety</strong><p>Need MetaMask? Install from <a href="https://metamask.io" target="_blank">metamask.io</a> (Chrome, Firefox, Edge, Brave). Create a wallet, then sign the verification popup. Zoltrakk never asks for seed phrases, private keys, or wallet passwords. Signatures are free.</p></div>
    </div>

    ${/* ── ADMIN: ADD PLAYER ── */""}
    ${isAdmin ? `<div class="card" style="padding:20px 22px;margin-bottom:18px">
      <h3>Add Player (Admin)</h3>
      <div class="form-grid">
        <div><label>Player Name</label><input id="adminAddPlayerName" placeholder="Enter player name"></div>
        <div>
          <label>Add to Team</label>
          <select id="adminAddTeamSelect"><option value="">— Create new team —</option>${t.teams.map((tm) => `<option value="${tm.id}">${esc(tm.name)}</option>`).join("")}</select>
        </div>
      </div>
      <div>
        <label>New Team Name <span class="hint-text">(if creating a new team)</span></label>
        <input id="adminAddNewTeamName" placeholder="Team name for new team">
      </div>
      ${t.paidEntry.enabled ? `<p class="hint-text">MetaMask will ask you to sign a free verification.</p>` : ""}
      <button class="btn" id="adminAddPlayerBtn" style="margin-top:8px">Add Player</button>
      <p id="adminAddPlayerMsg" class="error" style="margin-top:6px"></p>
    </div>` : ""}

    ${/* ── JOIN REQUESTS (admin only) ── */""}
    ${isAdmin ? `<div class="card" style="padding:20px 22px;margin-bottom:18px">
      <h3>Join Requests</h3>
      <div id="joinRequestsList"></div>
    </div>` : ""}

    ${/* ── REMOVED PLAYERS (admin only) ── */""}
    ${isAdmin && t.removedPlayers && t.removedPlayers.length > 0 ? `<div class="card" style="padding:20px 22px;margin-bottom:18px">
      <h3>Removed Players</h3>
      <p class="hint-text" style="margin-top:0">The following players were removed from teams and are blocked from rejoining. Click "Allow Rejoin" to unblock them.</p>
      <div id="removedPlayersList">
        ${t.removedPlayers.map((p) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:color-mix(in srgb,var(--accent) 6%,var(--surface));border-radius:8px;margin-bottom:4px">
            <div>
              <strong>${esc(p.name)}</strong>
              <span class="hint-text" style="margin-left:8px">Removed ${p.removedAt ? new Date(p.removedAt).toLocaleString() : ""}</span>
            </div>
            <button class="btn alt" data-allow-rejoin="${esc(p.name)}" style="padding:5px 12px;font-size:.78rem;color:var(--primary);border-color:var(--primary)">Allow Rejoin</button>
          </div>
        `).join("")}
      </div>
    </div>` : ""}

    ${/* ── TEAMS ── */""}
    <div class="card" style="padding:20px 22px;margin-bottom:18px">
      <h3>Teams <span class="badge" style="font-size:.75rem;vertical-align:middle;margin-left:8px">${teamCount}</span></h3>
      <div id="teamsList"></div>
    </div>

    ${/* ── MATCHES ── */""}
    <div class="card" style="padding:20px 22px;margin-bottom:18px">
      <h3>Matches <span class="badge" style="font-size:.75rem;vertical-align:middle;margin-left:8px">${matchCount}</span></h3>
      ${isAdmin ? `
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0">
        <button class="btn" id="autoMatchBtn" style="padding:10px 16px;font-size:.85rem">Auto Generate</button>
        <button class="btn alt" id="manualMatchBtn" style="padding:10px 16px;font-size:.85rem">Add Manual Match</button>
      </div>
      <div class="form-grid" style="margin-top:6px">
        <div><label>Team A</label><select id="manualA"></select></div>
        <div><label>Team B</label><select id="manualB"></select></div>
      </div>
      <p style="margin-top:8px;color:var(--muted);font-size:.88rem">Edit full schedule (dates, stages, winners) on the <a href="schedule.html?tournament=${t.id}">Schedule page</a>.</p>` : ""}
      <div id="matchesList" style="margin-top:12px"></div>
    </div>
  `;

  const copyBtn = document.getElementById("copyTournamentLink");
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(safeShareUrl(t));
      copyBtn.textContent = "Link Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy Link"; }, 2000);
    } catch {
      copyBtn.textContent = "Copy blocked — select URL above";
    }
  };
  const exportBtn = document.getElementById("exportTournamentBtn");
  if (exportBtn) {
    exportBtn.onclick = () => exportTournamentAsJson(t);
  }
  if (isAdmin) {
    document.getElementById("statusSelect").value = t.status || "upcoming";
    document.getElementById("saveStatusBtn").onclick = async () => {
      t.status = document.getElementById("statusSelect").value;
      if (t.status === "completed") t.completedAt = nowIso();
      await saveTournament(t);
      location.reload();
    };
    document.getElementById("editGame").value = t.game;
    document.getElementById("editVisibility").value = t.visibility || "public";
    document.getElementById("editJoinType").value = t.joinType || "quick";
    document.getElementById("editPaidEntry").value = String(Boolean(t.paidEntry.enabled));
    document.getElementById("editPrizeType").value = t.prize?.type || "";
    document.getElementById("fundPrizeBtn")?.addEventListener("click", async () => {
      const editMsg = document.getElementById("editMsg");
      editMsg.className = "error";
      editMsg.textContent = "";
      try {
        if (!isEthAddress(t.paymentWallet)) throw new Error("Add a valid payment wallet before funding the prize.");
        const tx = await sendEthWithMetaMask({ to: t.paymentWallet, amountEth: t.prize.amount });
        t.prize.fundingTx = tx;
        t.prize.verificationStatus = "pending";
        await saveTournament(t);
        editMsg.className = "success";
        editMsg.textContent = "Prize transaction recorded. Review and verify it before advertising this as a rewarded event.";
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        editMsg.textContent = err.message || "MetaMask transaction failed.";
      }
    });
    document.getElementById("verifyPrizeBtn")?.addEventListener("click", async () => {
      t.prize.verificationStatus = "verified";
      await saveTournament(t);
      location.reload();
    });
    document.getElementById("confirmWinnersBtn")?.addEventListener("click", async () => {
      t.prize.winnerConfirmed = true;
      t.prize.claims = completedWinners(t).map((winner) => ({
        winner,
        status: "ready-to-claim",
        confirmedAt: nowIso()
      }));
      await saveTournament(t);
      location.reload();
    });
    document.getElementById("saveTournamentEdit").onclick = async () => {
      const editMsg = document.getElementById("editMsg");
      editMsg.textContent = "";
      try {
        const nextBanner = await readOptionalImage(document.getElementById("editBanner"));
        const paidEnabled = document.getElementById("editPaidEntry").value === "true";
        const entryFeeEth = document.getElementById("editEntryFeeEth").value.trim();
        const paymentWallet = normalizeAddress(document.getElementById("editPaymentWallet").value);
        if (paidEnabled) {
          if (!entryFeeEth) throw new Error("Entry fee is required for paid tournaments.");
          ethToWeiHex(entryFeeEth);
          if (!isEthAddress(paymentWallet)) throw new Error("Paid tournaments need a valid payment wallet.");
        }
        t.tournamentName = document.getElementById("editName").value.trim() || t.tournamentName;
        t.game = document.getElementById("editGame").value;
        t.startsAt = document.getElementById("editStartsAt").value;
        t.description = document.getElementById("editDescription").value.trim();
        t.rules = document.getElementById("editRules").value.trim();
        t.playerLimit = Math.max(2, Number(document.getElementById("editPlayerLimit").value) || 32);
        if (nextBanner) t.bannerImage = nextBanner;
        t.visibility = document.getElementById("editVisibility").value;
        t.joinType = document.getElementById("editJoinType").value;
        t.settings.joinApproval = t.joinType === "request";
        t.paymentWallet = paymentWallet;
        t.paidEntry = { enabled: paidEnabled, entryFeeEth: paidEnabled ? entryFeeEth : "", verificationRequired: paidEnabled };
        const prizeType = document.getElementById("editPrizeType").value;
        t.prize = {
          amount: document.getElementById("editPrizeAmount").value.trim(),
          type: prizeType,
          description: document.getElementById("editPrizeDescription").value.trim(),
          winnerCount: Math.max(1, Number(document.getElementById("editWinnerCount").value) || 1),
          verificationStatus: prizeType || document.getElementById("editPrizeAmount").value.trim() ? (t.prize?.verificationStatus === "verified" ? "verified" : "pending") : "none",
          fundingTx: t.prize?.fundingTx || null,
          claims: t.prize?.claims || [],
          winnerConfirmed: Boolean(t.prize?.winnerConfirmed)
        };
        await saveTournament(t);
        editMsg.className = "success";
        editMsg.textContent = "Tournament updated.";
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        editMsg.textContent = err.message;
      }
    };

    const adminAddBtn = document.getElementById("adminAddPlayerBtn");
    if (adminAddBtn) {
      adminAddBtn.onclick = async () => {
        const msg = document.getElementById("adminAddPlayerMsg");
        msg.textContent = "";
        msg.className = "error";
        const name = (document.getElementById("adminAddPlayerName").value || "").trim();
        if (!name) return void (msg.textContent = "Enter a player name.");
        if (participantTotal(t) >= (t.playerLimit || 32)) return void (msg.textContent = "Player limit reached.");
        const blocked = t.removedPlayers.some((p) => p.name === name.toLowerCase());
        if (blocked) {
          t.removedPlayers = t.removedPlayers.filter((p) => p.name !== name.toLowerCase());
        }
        const teamId = document.getElementById("adminAddTeamSelect").value;
        const newTeamName = (document.getElementById("adminAddNewTeamName").value || "").trim();
        if (!teamId && !newTeamName) return void (msg.textContent = "Select a team or enter a new team name.");
        if (teamId) {
          const team = t.teams.find((x) => x.id === teamId);
          if (!team) return void (msg.textContent = "Team not found.");
          if (team.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return void (msg.textContent = "Player already in this team.");
          const join = { id: uid(), name, mode: "join", teamId, teamName: team.name, status: "approved", createdAt: nowIso() };
          if (t.paidEntry.enabled) {
            try {
              adminAddBtn.disabled = true;
              adminAddBtn.textContent = "Connecting MetaMask...";
              const verification = await signWithMetaMask(`Admin add: ${name} to ${t.tournamentName}`);
              join.walletAddress = verification.from;
              join.paymentStatus = "verified-by-wallet";
              join.signature = verification.signature;
              join.verifiedAt = verification.signedAt;
            } catch (err) {
              msg.textContent = err.message || "Verification cancelled.";
              adminAddBtn.disabled = false;
              adminAddBtn.textContent = "Add Player";
              return;
            } finally {
              adminAddBtn.disabled = false;
              adminAddBtn.textContent = "Add Player";
            }
          }
          applyJoin(join);
          await saveTournament(t);
          renderAll();
          msg.className = "success";
          msg.textContent = `${name} added to ${team.name}.`;
        } else {
          if (t.teams.some((x) => x.name.toLowerCase() === newTeamName.toLowerCase())) return void (msg.textContent = "Team name already exists.");
          const join = { id: uid(), name, mode: "create", teamName: newTeamName, status: "approved", createdAt: nowIso() };
          if (t.paidEntry.enabled) {
            try {
              adminAddBtn.disabled = true;
              adminAddBtn.textContent = "Connecting MetaMask...";
              const verification = await signWithMetaMask(`Admin add: ${name} to new team ${newTeamName}`);
              join.walletAddress = verification.from;
              join.paymentStatus = "verified-by-wallet";
              join.signature = verification.signature;
              join.verifiedAt = verification.signedAt;
            } catch (err) {
              msg.textContent = err.message || "Verification cancelled.";
              adminAddBtn.disabled = false;
              adminAddBtn.textContent = "Add Player";
              return;
            } finally {
              adminAddBtn.disabled = false;
              adminAddBtn.textContent = "Add Player";
            }
          }
          applyJoin(join);
          syncTeamsToBracket(t);
          await saveTournament(t);
          renderAll();
          msg.className = "success";
          msg.textContent = `${name} added to new team ${newTeamName}.`;
        }
        document.getElementById("adminAddPlayerName").value = "";
        document.getElementById("adminAddNewTeamName").value = "";
      };
    }
  }

  const joinDynamic = document.getElementById("joinDynamic");
  const squadSelect = document.getElementById("squadQuickSelect");
  const renderJoinDynamic = () => {
    if (document.getElementById("joinMode").value === "create") {
      joinDynamic.innerHTML = `<label>Team Name</label><input id="newTeamName" placeholder="Team Rockets">
        <label style="margin-top:8px">Team Type</label>
        <select id="teamJoinType">
          <option value="open">Open — anyone can join</option>
          <option value="request">Request — players ask to join</option>
        </select>`;
    } else {
      joinDynamic.innerHTML = `<label>Select Team</label><select id="existingTeamSel">${t.teams.map((tm) => {
        const badge = tm.joinType === "request" ? " 🔒" : "";
        return `<option value="${tm.id}">${esc(tm.name)}${badge}</option>`;
      }).join("")}</select>`;
    }
  };
  renderJoinDynamic();
  document.getElementById("joinMode").onchange = renderJoinDynamic;

  const renderSquadQuickSelect = () => {
    const user = getCurrentUser();
    if (!user) { squadSelect.innerHTML = ""; return; }
    const myPlayers = getUserPlayers();
    if (!myPlayers.length) {
      squadSelect.innerHTML = `<p class="hint-text">No players in your squad. <a href="players.html">Register players</a> for quick join.</p>`;
      return;
    }
    squadSelect.innerHTML = `<label style="margin-top:10px">Quick Select from My Squad</label>
      <select id="squadPlayerSelect"><option value="">— Type name manually —</option>
      ${myPlayers.map((p) => `<option value="${esc(p.id)}" data-name="${esc(p.name)}" data-game="${esc(p.game)}">${esc(p.name)} (${esc(p.game)})</option>`).join("")}
      </select>`;
    const sel = document.getElementById("squadPlayerSelect");
    if (sel) {
      sel.onchange = () => {
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.value) {
          document.getElementById("joinerName").value = opt.getAttribute("data-name");
        }
      };
    }
  };
  renderSquadQuickSelect();

  const renderTeams = () => {
    const list = document.getElementById("teamsList");
    const currentUserName = getCurrentUser()?.name || "";
    list.innerHTML = t.teams.length ? t.teams.map((tm, idx) => {
      const joinBadge = tm.joinType === "request" ? `<span class="tag" style="font-size:.65rem;padding:2px 8px;margin-left:6px;background:color-mix(in srgb,var(--accent) 12%,var(--surface))">Request</span>` : `<span class="tag" style="font-size:.65rem;padding:2px 8px;margin-left:6px">Open</span>`;
      const captain = tm.members.find(m => m.role === "Captain");
      const isMyTeam = captain && captain.name === currentUserName;
      const pendingReqs = (tm.requests || []).filter(r => r.status === "pending");
      return `<article class="card" style="padding:10px;margin-bottom:8px">
      <strong>${idx + 1}. ${esc(tm.name)} ${joinBadge}</strong>
      <ul>${tm.members.map((m, memberIdx) => `<li>${esc(m.name)}${m.role ? ` - ${esc(m.role)}` : ""} ${m.paymentTx ? `<span class="tag verified">Paid</span>` : ""} ${isAdmin && m.paymentTx ? `<span class="hint-text">${esc(m.paymentTx)}</span>` : ""} ${isAdmin ? `<button class="mini-danger" data-remove-member="${tm.id}" data-member="${memberIdx}">Remove</button>` : ""}</li>`).join("")}</ul>
      ${isAdmin ? `<button class="btn alt" data-del="${tm.id}">Delete</button>
      <button class="btn alt" data-up="${tm.id}">Move Up</button>
      <button class="btn alt" data-down="${tm.id}">Move Down</button>` : ""}
      ${isMyTeam && pendingReqs.length ? `<div style="margin-top:8px;padding:10px;background:color-mix(in srgb,var(--accent) 6%,var(--surface));border-radius:8px;border:1px solid color-mix(in srgb,var(--accent) 12%,var(--border))">
        <strong style="font-size:.8rem;display:block;margin-bottom:6px">Pending Join Requests (${pendingReqs.length})</strong>
        ${pendingReqs.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:.85rem">
            <strong>${esc(r.playerName)}</strong>
            ${r.rank ? `<span class="hint-text" style="margin-left:6px">${esc(r.rank)}</span>` : ""}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn" style="padding:4px 10px;font-size:.75rem" data-approve-team-req="${tm.id}" data-req-id="${r.id}">Approve</button>
            <button class="btn alt" style="padding:4px 10px;font-size:.75rem" data-deny-team-req="${tm.id}" data-req-id="${r.id}">Deny</button>
          </div>
        </div>`).join("")}
      </div>` : ""}
      </article>`;
    }).join("") : "<p>No teams yet.</p>";
    if (isAdmin) {
      list.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { t.teams = t.teams.filter((x) => x.id !== b.dataset.del); syncTeamsToBracket(t); await saveTournament(t); renderAll(); });
      list.querySelectorAll("[data-remove-member]").forEach((b) => b.onclick = async () => {
        const team = t.teams.find((x) => x.id === b.dataset.removeMember);
        const member = team?.members?.[Number(b.dataset.member)];
        if (!team || !member) return;
        t.removedPlayers.push({ name: member.name.toLowerCase(), removedAt: nowIso(), approvedAgain: false });
        team.members.splice(Number(b.dataset.member), 1);
        await saveTournament(t);
        renderAll();
      });
      list.querySelectorAll("[data-up]").forEach((b) => b.onclick = async () => {
        const i = t.teams.findIndex((x) => x.id === b.dataset.up);
        if (i > 0) [t.teams[i - 1], t.teams[i]] = [t.teams[i], t.teams[i - 1]];
        await saveTournament(t);
        renderAll();
      });
      list.querySelectorAll("[data-down]").forEach((b) => b.onclick = async () => {
        const i = t.teams.findIndex((x) => x.id === b.dataset.down);
        if (i < t.teams.length - 1) [t.teams[i + 1], t.teams[i]] = [t.teams[i], t.teams[i + 1]];
        await saveTournament(t);
        renderAll();
      });
    }
    list.querySelectorAll("[data-approve-team-req]").forEach((b) => b.onclick = async () => {
      const team = t.teams.find((x) => x.id === b.dataset.approveTeamReq);
      const req = team?.requests?.find((r) => r.id === b.dataset.reqId);
      if (!team || !req || req.status !== "pending") return;
      req.status = "approved";
      team.members.push({ name: req.playerName, role: "Member", userId: req.playerId });
      await saveTournament(t);
      renderAll();
    });
    list.querySelectorAll("[data-deny-team-req]").forEach((b) => b.onclick = async () => {
      const team = t.teams.find((x) => x.id === b.dataset.denyTeamReq);
      const req = team?.requests?.find((r) => r.id === b.dataset.reqId);
      if (!team || !req || req.status !== "pending") return;
      req.status = "denied";
      await saveTournament(t);
      renderAll();
    });
  };

  const renderMatches = () => {
    const ml = document.getElementById("matchesList");
    ml.innerHTML = t.matches.length ? t.matches.map((m, i) => `
      <p>Match ${i + 1}: ${esc(m.a)} vs ${esc(m.b)}
      <span class="match-status ${esc(m.status)}">${esc(m.status)}</span>
      ${m.date ? ` — ${esc(m.date)}` : ""}${m.time ? ` ${esc(m.time)}` : ""}
      ${m.winner ? ` — Winner: ${esc(m.winner)}` : ""}</p>`).join("") : "<p>No matches yet.</p>";
    if (isAdmin) {
      const opts = t.teams.map((tm) => `<option value="${tm.id}">${esc(tm.name)}</option>`).join("");
      document.getElementById("manualA").innerHTML = opts;
      document.getElementById("manualB").innerHTML = opts;
    }
  };
  const renderJoinRequests = () => {
    const list = document.getElementById("joinRequestsList");
    if (!list) return;
    const pending = t.joinRequests.filter((r) => r.status === "pending");
    list.innerHTML = pending.length ? pending.map((r) => `
      <article class="request-row">
        <span>${esc(r.name)} wants to ${r.mode === "create" ? `create ${esc(r.teamName)}` : `join ${esc(r.teamName)}`}</span>
        <button class="btn" data-approve-request="${r.id}">Approve</button>
        <button class="btn alt" data-deny-request="${r.id}">Deny</button>
      </article>`).join("") : "<p>No pending requests.</p>";
    list.querySelectorAll("[data-approve-request]").forEach((b) => b.onclick = async () => {
      const req = t.joinRequests.find((r) => r.id === b.dataset.approveRequest);
      if (!req) return;
      req.status = "approved";
      applyJoin(req);
      syncTeamsToBracket(t);
      t.removedPlayers = t.removedPlayers.filter((p) => p.name !== req.name.toLowerCase());
      await saveTournament(t);
      renderAll();
    });
    list.querySelectorAll("[data-deny-request]").forEach((b) => b.onclick = async () => {
      const req = t.joinRequests.find((r) => r.id === b.dataset.denyRequest);
      if (!req) return;
      req.status = "denied";
      await saveTournament(t);
      renderAll();
    });
  };

  const renderRemovedPlayers = () => {
    const list = document.getElementById("removedPlayersList");
    if (!list) return;
    list.querySelectorAll("[data-allow-rejoin]").forEach((b) => {
      b.onclick = async () => {
        const nameToUnblock = b.dataset.allowRejoin.toLowerCase();
        t.removedPlayers = t.removedPlayers.filter((p) => p.name !== nameToUnblock);
        await saveTournament(t);
        renderDetail(t);
        showToast(`Player ${b.dataset.allowRejoin} is now allowed to rejoin!`, "success");
      };
    });
  };

  const renderAll = () => { renderJoinDynamic(); renderTeams(); renderMatches(); renderJoinRequests(); renderSquadQuickSelect(); renderRemovedPlayers(); };
  renderAll();

  const applyJoin = (join) => {
    const paymentMeta = (join.walletAddress || join.paymentStatus || join.payment) ? {
      walletAddress: join.walletAddress || "",
      paymentTx: join.signature || join.payment?.txHash || "",
      paymentStatus: join.paymentStatus || ""
    } : {};
    if (join.mode === "create") {
      t.teams.push({ id: uid(), name: join.teamName, joinType: join.teamJoinType || "open", requests: [], members: [{ name: join.name, role: "Captain", userId: join.userId, ...paymentMeta }] });
    } else {
      const team = t.teams.find((x) => x.id === join.teamId);
      if (team) team.members.push({ name: join.name, role: "Member", userId: join.userId, ...paymentMeta });
    }
  };

  document.getElementById("joinBtn").onclick = async () => {
    if (isArchivedTournament(t)) return;
    const msg = document.getElementById("joinMsg");
    const joinBtn = document.getElementById("joinBtn");
    msg.textContent = "";
    msg.className = "error";
    const user = getCurrentUser();
    if (!user) {
      msg.innerHTML = `You must be logged in to join a tournament. <a href="login.html">Log in here</a> or <a href="signup.html">sign up</a>.`;
      return;
    }
    const name = (document.getElementById("joinerName").value || "").trim();
    if (!name) return void (msg.textContent = "Enter your name.");

    // Restrict one team/registration per account
    const nameLower = name.toLowerCase();
    const userNameLower = (user.name || "").toLowerCase();

    const alreadyInTeam = t.teams.some(team =>
      team.members.some(m => m.userId === user.id || (m.name && m.name.toLowerCase() === userNameLower) || (m.name && m.name.toLowerCase() === nameLower))
    );
    if (alreadyInTeam) {
      return void (msg.textContent = "You (or this name) have already joined a team in this tournament.");
    }

    const hasPendingJoinReq = t.joinRequests.some(r =>
      r.status === "pending" && (r.userId === user.id || (r.name && r.name.toLowerCase() === userNameLower) || (r.name && r.name.toLowerCase() === nameLower))
    );
    if (hasPendingJoinReq) {
      return void (msg.textContent = "You already have a pending registration request for this tournament.");
    }

    const hasPendingTeamReq = t.teams.some(team =>
      (team.requests || []).some(r =>
        r.status === "pending" && (r.playerId === user.id || (r.playerName && r.playerName.toLowerCase() === userNameLower) || (r.playerName && r.playerName.toLowerCase() === nameLower))
      )
    );
    if (hasPendingTeamReq) {
      return void (msg.textContent = "You already have a pending request to join a team in this tournament.");
    }

    if (participantTotal(t) >= (t.playerLimit || 32)) return void (msg.textContent = "Player limit reached.");
    const blocked = t.removedPlayers.some((p) => p.name === name.toLowerCase());
    if (blocked) return void (msg.textContent = "This player was removed and needs admin approval before rejoining.");
    const join = { id: uid(), name, mode: document.getElementById("joinMode").value, status: "pending", createdAt: nowIso(), userId: user.id };
    if (join.mode === "create") {
      const tn = (document.getElementById("newTeamName").value || "").trim();
      if (!tn) return void (msg.textContent = "Enter team name.");
      if (t.teams.some((x) => x.name.toLowerCase() === tn.toLowerCase())) return void (msg.textContent = "Team name already exists.");
      join.teamName = tn;
      join.teamJoinType = document.getElementById("teamJoinType")?.value || "open";
    } else {
      const team = t.teams.find((x) => x.id === document.getElementById("existingTeamSel").value);
      if (!team) return void (msg.textContent = "No team selected.");
      if (team.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return void (msg.textContent = "You are already in this team.");
      if (team.joinType === "request") {
        if (!team.requests) team.requests = [];
        if (team.requests.some(r => r.playerName.toLowerCase() === name.toLowerCase() && r.status === "pending")) return void (msg.textContent = "You already have a pending request for this team.");
        const user = getCurrentUser();
        team.requests.push({ id: uid(), playerName: name, playerId: user?.id || "", rank: user?.rank || "", requestedAt: nowIso(), status: "pending" });
        await saveTournament(t);
        renderAll();
        msg.className = "success";
        msg.textContent = "Join request sent to team captain.";
        return;
      }
      join.teamId = team.id;
      join.teamName = team.name;
    }
    if (t.paidEntry.enabled) {
      try {
        joinBtn.disabled = true;
        joinBtn.textContent = "Connecting MetaMask...";
        msg.textContent = "Sign the verification in MetaMask to join (free).";
        const verification = await signWithMetaMask(`Join tournament: ${t.tournamentName} as ${name}`);
        join.walletAddress = verification.from;
        join.paymentStatus = "verified-by-wallet";
        join.signature = verification.signature;
        join.verifiedAt = verification.signedAt;
      } catch (err) {
        msg.textContent = err.message || "Verification was not completed.";
        joinBtn.disabled = false;
        joinBtn.textContent = "Submit";
        return;
      } finally {
        joinBtn.disabled = false;
        joinBtn.textContent = "Submit";
      }
    }
    if (t.settings.joinApproval) {
      t.joinRequests.push(join);
      await saveTournament(t);
      renderAll();
      msg.className = "success";
      msg.textContent = "Join request sent for admin approval.";
      return;
    }
    join.status = "approved";
    applyJoin(join);
    syncTeamsToBracket(t);
    await saveTournament(t);
    renderAll();
    msg.className = "success";
    msg.textContent = "Joined successfully.";
  };

  if (isAdmin) {
    document.getElementById("autoMatchBtn").onclick = async () => {
      if (t.matches.length > 0 && !confirm("This will replace all existing matches. Continue?")) return;
      t.matches = [];
      for (let i = 0; i < t.teams.length - 1; i += 2) {
        t.matches.push(normalizeMatch({ a: t.teams[i].name, b: t.teams[i + 1].name, mode: "auto" }, t.matches.length));
      }
      await saveTournament(t);
      renderAll();
    };
    document.getElementById("manualMatchBtn").onclick = async () => {
      const a = t.teams.find((x) => x.id === document.getElementById("manualA").value);
      const b = t.teams.find((x) => x.id === document.getElementById("manualB").value);
      if (!a || !b || a.id === b.id) return;
      t.matches.push(normalizeMatch({ a: a.name, b: b.name, mode: "manual" }, t.matches.length));
      await saveTournament(t);
      renderAll();
    };
  }
}

function initSchedulePage() {
  const root = document.getElementById("scheduleRoot");
  if (!root) return;

  let preselect = new URLSearchParams(location.search).get("tournament") || "";

  function getValidTournaments() {
    const all = getTournaments();
    if (preselect) {
      const t = all.find(x => x.id === preselect);
      if (t) return [t];
    }
    return all.filter(t => (t.matches || []).length > 0 || (t.teams || []).length > 0);
  }

  function buildToolbar() {
    const all = getTournaments();
    const opts = all.map(t =>
      `<option value="${t.id}" ${t.id === preselect ? "selected" : ""}>${esc(t.tournamentName)} (${t.matches?.length || 0} matches)</option>`
    ).join("");
    return `
      <label>Tournament</label>
      <select id="scheduleTournamentSelect">
        <option value="">— Select a tournament —</option>
        ${opts}
      </select>`;
  }

  function buildRounds(t) {
    if (!t || !t.matches || !t.matches.length) return [];
    const stages = ["Qualifier", "Semi Final", "Grand Final"];
    const groups = {};
    t.matches.forEach((m, i) => {
      const mn = normalizeMatch(m, i);
      const stage = mn.stage;
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(mn);
    });
    const roundNames = Object.keys(groups).sort((a, b) => stages.indexOf(a) - stages.indexOf(b));
    return roundNames.map((name, ri) => ({
      label: name,
      index: ri,
      matches: groups[name]
    }));
  }

  function getTeamName(name, t) {
    const team = (t.teams || []).find(tm => tm.name === name);
    if (!team) return name;
    return team.name;
  }

  function renderBracket(t) {
    const rounds = buildRounds(t);
    if (!rounds.length) return "";

    const MATCH_H = 140;
    const GAP = 40;
    const TOTAL_UNIT = MATCH_H + GAP;
    const CONNECTOR_W = 44;
    const ROUND_W = 280;

    function matchCenterY(mi, ri) {
      return mi * Math.pow(2, ri) * TOTAL_UNIT + (Math.pow(2, ri) - 1) * TOTAL_UNIT / 2 + MATCH_H / 2;
    }

    const firstRoundCount = rounds[0].matches.length;
    const totalHeight = firstRoundCount * TOTAL_UNIT;

    function statusClass(m) {
      if (m.status === "live") return "b-live";
      if (m.status === "completed") return "b-completed";
      if (m.status === "scheduled" && m.date) {
        const d = new Date(m.date + "T" + (m.time || "00:00"));
        if (d > new Date()) return "b-upcoming";
      }
      return "";
    }

    function statusLabel(m) {
      if (m.status === "live") return "LIVE";
      if (m.status === "completed") return "Completed";
      return "Scheduled";
    }

    function connectorSVG(leftRound) {
      const leftMatches = leftRound.matches;
      if (leftMatches.length < 2) return "";
      const h = totalHeight;
      const lines = [];
      for (let i = 0; i < leftMatches.length; i += 2) {
        const y1 = matchCenterY(i, leftRound.index);
        const y2 = matchCenterY(i + 1, leftRound.index);
        const outY = (y1 + y2) / 2;
        const midX = CONNECTOR_W / 2;
        lines.push(`<line x1="0" y1="${y1}" x2="${midX}" y2="${y1}" class="b-cline"/>`);
        lines.push(`<line x1="0" y1="${y2}" x2="${midX}" y2="${y2}" class="b-cline"/>`);
        lines.push(`<line x1="${midX}" y1="${y1}" x2="${midX}" y2="${y2}" class="b-cline"/>`);
        lines.push(`<line x1="${midX}" y1="${outY}" x2="${CONNECTOR_W}" y2="${outY}" class="b-cline"/>`);
      }
      return `<svg width="${CONNECTOR_W}" height="${h}" class="b-connector-svg">${lines.join("")}</svg>`;
    }

    function matchCard(match, mi, ri) {
      const y = matchCenterY(mi, ri) - MATCH_H / 2;
      const sc = statusClass(match);
      const sl = statusLabel(match);
      const isLive = match.status === "live";
      const winner = match.winner || "";
      const aWin = winner === match.a;
      const bWin = winner === match.b;
      return `<div class="b-match ${sc}" data-encoded='${encodeURIComponent(JSON.stringify(match))}' data-tournament='${esc(t.id)}' style="top:${y}px;height:${MATCH_H}px">
        <div class="b-match-teams">
          <div class="b-team ${aWin ? "b-winner" : ""} ${winner && !aWin ? "b-loser" : ""}">
            <span class="b-team-indicator"></span>
            <span class="b-team-name">${esc(match.a)}</span>
            ${aWin ? '<span class="b-crown">👑</span>' : ""}
          </div>
          <div class="b-vs">VS</div>
          <div class="b-team ${bWin ? "b-winner" : ""} ${winner && !bWin ? "b-loser" : ""}">
            <span class="b-team-indicator"></span>
            <span class="b-team-name">${esc(match.b)}</span>
            ${bWin ? '<span class="b-crown">👑</span>' : ""}
          </div>
        </div>
        <div class="b-match-footer">
          <span class="b-status ${isLive ? "b-live" : winner ? "b-completed" : "b-scheduled"}">${isLive ? '<span class="b-status-dot"></span>' : ""}${sl}</span>
          <span class="b-match-time">${match.date || "TBD"}${match.time ? " " + match.time : ""}</span>
        </div>
      </div>`;
    }

    function championCard(t) {
      const championMatch = rounds[rounds.length - 1]?.matches[0];
      if (!championMatch || !championMatch.winner) return "";
      return `<div class="b-champion">
        <div class="b-champion-crown">🏆</div>
        <div class="b-champion-name">${esc(championMatch.winner)}</div>
        <div class="b-champion-label">Champion</div>
        <div class="b-champion-sub">${esc(t.tournamentName)}</div>
      </div>`;
    }

    let html = `<div class="b-view"><div class="bracket">`;

    rounds.forEach((round, ri) => {
      html += `<div class="b-round" style="width:${ROUND_W}px">
        <div class="b-round-label">${round.label}</div>
        <div class="b-round-matches" style="position:relative;flex:1;height:${totalHeight}px">
          ${round.matches.map((m, mi) => matchCard(m, mi, ri)).join("")}
        </div>
      </div>`;

      if (ri < rounds.length - 1) {
        html += `<div class="b-connector" style="width:${CONNECTOR_W}px">${connectorSVG(round)}</div>`;
      }
    });

    html += `</div>${championCard(t)}</div>`;

    return html;
  }

  function renderSkeletonBracket() {
    const demo = {
      matches: [
        { a: "Team Alpha", b: "Team Bravo", stage: "Qualifier", status: "completed", winner: "Team Alpha", date: "2026-06-10" },
        { a: "Team Charlie", b: "Team Delta", stage: "Qualifier", status: "completed", winner: "Team Charlie", date: "2026-06-10" },
        { a: "Team Echo", b: "Team Foxtrot", stage: "Qualifier", status: "completed", winner: "Team Foxtrot", date: "2026-06-10" },
        { a: "Team Golf", b: "Team Hotel", stage: "Qualifier", status: "completed", winner: "Team Golf", date: "2026-06-10" },
        { a: "Team Alpha", b: "Team Charlie", stage: "Semi Final", status: "completed", winner: "Team Alpha", date: "2026-06-11" },
        { a: "Team Foxtrot", b: "Team Golf", stage: "Semi Final", status: "completed", winner: "Team Golf", date: "2026-06-11" },
        { a: "Team Alpha", b: "Team Golf", stage: "Grand Final", status: "scheduled", winner: "", date: "2026-06-12" }
      ],
      teams: [
        { name: "Team Alpha" }, { name: "Team Bravo" }, { name: "Team Charlie" }, { name: "Team Delta" },
        { name: "Team Echo" }, { name: "Team Foxtrot" }, { name: "Team Golf" }, { name: "Team Hotel" }
      ],
      tournamentName: "Demo Bracket"
    };
    const rounds = buildRounds(demo);
    if (!rounds.length) return "";

    const MATCH_H = 140, GAP = 40, TOTAL_UNIT = MATCH_H + GAP, CONNECTOR_W = 44, ROUND_W = 280;

    function matchCenterY(mi, ri) {
      return mi * Math.pow(2, ri) * TOTAL_UNIT + (Math.pow(2, ri) - 1) * TOTAL_UNIT / 2 + MATCH_H / 2;
    }

    const firstRoundCount = rounds[0].matches.length;
    const totalHeight = firstRoundCount * TOTAL_UNIT;

    function connectorSVG(leftRound) {
      const leftMatches = leftRound.matches;
      if (leftMatches.length < 2) return "";
      const h = totalHeight;
      const lines = [];
      for (let i = 0; i < leftMatches.length; i += 2) {
        const y1 = matchCenterY(i, leftRound.index);
        const y2 = matchCenterY(i + 1, leftRound.index);
        const outY = (y1 + y2) / 2;
        const midX = CONNECTOR_W / 2;
        lines.push(`<line x1="0" y1="${y1}" x2="${midX}" y2="${y1}" class="b-cline"/>`);
        lines.push(`<line x1="0" y1="${y2}" x2="${midX}" y2="${y2}" class="b-cline"/>`);
        lines.push(`<line x1="${midX}" y1="${y1}" x2="${midX}" y2="${y2}" class="b-cline"/>`);
        lines.push(`<line x1="${midX}" y1="${outY}" x2="${CONNECTOR_W}" y2="${outY}" class="b-cline"/>`);
      }
      return `<svg width="${CONNECTOR_W}" height="${h}" class="b-connector-svg">${lines.join("")}</svg>`;
    }

    let html = `<div class="b-view"><div style="text-align:center;margin-bottom:12px"><span style="display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:2px;opacity:.6;padding:8px 16px">— Preview — Bracket will auto-generate from your matches</span></div><div class="bracket">`;

    rounds.forEach((round, ri) => {
      html += `<div class="b-round ${ri > 0 ? "b-round-skeleton" : ""}" style="width:${ROUND_W}px">
        <div class="b-round-label" style="opacity:.4">${round.label}</div>
        <div class="b-round-matches" style="position:relative;flex:1;height:${totalHeight}px">
          ${round.matches.map((m, mi) => {
            const y = matchCenterY(mi, ri) - MATCH_H / 2;
            const isCompleted = m.status === "completed";
            return `<div class="b-match b-match-skeleton" style="top:${y}px;height:${MATCH_H}px;pointer-events:none">
              <div class="b-match-teams">
                <div class="b-team ${m.winner === m.a ? "b-winner" : ""}">
                  <span class="b-team-indicator"></span>
                  <span class="b-team-name">${esc(m.a)}</span>
                  ${m.winner === m.a ? '<span class="b-crown">👑</span>' : ""}
                </div>
                <div class="b-vs">VS</div>
                <div class="b-team ${m.winner === m.b ? "b-winner" : ""}">
                  <span class="b-team-indicator"></span>
                  <span class="b-team-name">${esc(m.b)}</span>
                  ${m.winner === m.b ? '<span class="b-crown">👑</span>' : ""}
                </div>
              </div>
              <div class="b-match-footer">
                <span class="b-status ${isCompleted ? "b-completed" : "b-scheduled"}">${isCompleted ? "Completed" : "Upcoming"}</span>
                <span class="b-match-time">${m.date || "TBD"}</span>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`;

      if (ri < rounds.length - 1) {
        html += `<div class="b-connector" style="width:${CONNECTOR_W}px">${connectorSVG(round)}</div>`;
      }
    });

    html += `</div>
      <div class="b-champion b-champion-skeleton">
        <div class="b-champion-crown">🏆</div>
        <div class="b-champion-name">Champion</div>
        <div class="b-champion-label">Winner</div>
      </div>
    </div>`;

    return html;
  }

  function renderTeamSlots(t) {
    const teams = t.teams || [];
    if (teams.length < 1) return "";
    const n = Math.max(Math.pow(2, Math.ceil(Math.log2(teams.length))), 2);
    const half = n / 2;
    const MATCH_H = 140, GAP = 40, TOTAL_UNIT = MATCH_H + GAP, ROUND_W = 280, CONNECTOR_W = 44;

    function teamCard(name, idx) {
      const y = idx * TOTAL_UNIT + (TOTAL_UNIT - MATCH_H) / 2;
      const isTbd = name === "TBD";
      return `<div class="b-match ${isTbd ? "b-match-tbd" : ""}" style="top:${y}px;height:${MATCH_H}px;pointer-events:none">
        <div class="b-match-teams" style="justify-content:center;text-align:center">
          <div class="b-team" style="justify-content:center">
            <span class="b-team-indicator" style="${isTbd ? "background:var(--muted)" : ""}"></span>
            <span class="b-team-name" style="${isTbd ? "color:var(--muted);font-style:italic" : ""}">${isTbd ? "Open Slot" : esc(name)}</span>
          </div>
        </div>
      </div>`;
    }

    let html = `<div class="b-view">
      <div style="text-align:center;margin-bottom:8px">
        <span class="tag" style="font-size:.65rem;text-transform:uppercase;letter-spacing:1px;background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--text)">${teams.length} / ${n} Slots Filled</span>
      </div>
      <div class="bracket">`;

    // Round 1 - team slots
    html += `<div class="b-round" style="width:${ROUND_W}px">
      <div class="b-round-label">Qualifier</div>
      <div class="b-round-matches" style="position:relative;flex:1;height:${n * TOTAL_UNIT}px">
        ${Array.from({ length: n }, (_, i) => teamCard(teams[i]?.name || "TBD", i)).join("")}
      </div>
    </div>`;

    // Connector to future rounds
    if (half >= 2) {
      const svgH = n * TOTAL_UNIT;
      let lines = [];
      for (let i = 0; i < half; i++) {
        const y1 = i * 2 * TOTAL_UNIT + TOTAL_UNIT / 2;
        const y2 = (i * 2 + 1) * TOTAL_UNIT + TOTAL_UNIT / 2;
        const outY = (y1 + y2) / 2;
        const midX = CONNECTOR_W / 2;
        lines.push(`<line x1="0" y1="${y1}" x2="${midX}" y2="${y1}" class="b-cline"/>`);
        lines.push(`<line x1="0" y1="${y2}" x2="${midX}" y2="${y2}" class="b-cline"/>`);
        lines.push(`<line x1="${midX}" y1="${y1}" x2="${midX}" y2="${y2}" class="b-cline"/>`);
        lines.push(`<line x1="${midX}" y1="${outY}" x2="${CONNECTOR_W}" y2="${outY}" class="b-cline"/>`);
      }
      html += `<div class="b-connector" style="width:${CONNECTOR_W}px">
        <svg width="${CONNECTOR_W}" height="${svgH}" class="b-connector-svg">${lines.join("")}</svg>
      </div>`;
    }

    // Future rounds (dimmed)
    let remaining = half;
    let roundIdx = 1;
    while (remaining >= 1) {
      const label = roundIdx === 1 ? "Semi Final" : roundIdx === 2 ? "Grand Final" : "Round " + (roundIdx + 1);
      html += `<div class="b-round b-round-skeleton" style="width:${ROUND_W}px">
        <div class="b-round-label" style="opacity:.3">${label}</div>
        <div class="b-round-matches" style="position:relative;flex:1;height:${n * TOTAL_UNIT}px">
          ${Array.from({ length: remaining }, (_, i) => {
            const y = i * Math.pow(2, roundIdx) * TOTAL_UNIT + (Math.pow(2, roundIdx) - 1) * TOTAL_UNIT / 2;
            return `<div class="b-match b-match-skeleton" style="top:${y}px;height:${MATCH_H}px;pointer-events:none">
              <div class="b-match-teams" style="justify-content:center;text-align:center">
                <div class="b-team" style="justify-content:center;color:var(--muted)">TBD</div>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
      if (remaining > 1) {
        const svgH2 = n * TOTAL_UNIT;
        let lines2 = [];
        for (let i = 0; i < Math.floor(remaining/2); i++) {
          const y1 = i * Math.pow(2, roundIdx + 1) * TOTAL_UNIT + (Math.pow(2, roundIdx) - 0.5) * TOTAL_UNIT;
          const y2 = (i * 2 + 1) * Math.pow(2, roundIdx) * TOTAL_UNIT + (Math.pow(2, roundIdx) - 0.5) * TOTAL_UNIT;
          const outY = (y1 + y2) / 2;
          const midX = CONNECTOR_W / 2;
          lines2.push(`<line x1="0" y1="${y1}" x2="${midX}" y2="${y1}" class="b-cline" style="opacity:.3"/>`);
          lines2.push(`<line x1="0" y1="${y2}" x2="${midX}" y2="${y2}" class="b-cline" style="opacity:.3"/>`);
          lines2.push(`<line x1="${midX}" y1="${y1}" x2="${midX}" y2="${y2}" class="b-cline" style="opacity:.3"/>`);
          lines2.push(`<line x1="${midX}" y1="${outY}" x2="${CONNECTOR_W}" y2="${outY}" class="b-cline" style="opacity:.3"/>`);
        }
        html += `<div class="b-connector" style="width:${CONNECTOR_W}px;opacity:.3">
          <svg width="${CONNECTOR_W}" height="${svgH2}" class="b-connector-svg">${lines2.join("")}</svg>
        </div>`;
      }
      remaining = Math.floor(remaining / 2);
      roundIdx++;
    }

    html += `</div>
      <div class="b-champion b-champion-skeleton">
        <div class="b-champion-crown">🏆</div>
        <div class="b-champion-label">Champion</div>
      </div>
    </div>`;

    return html;
  }

  function openMatchModal(match, tournamentId, isCreator) {
    const t = getTournaments().find(x => x.id === tournamentId);
    if (!t) return;
    const overlay = document.createElement("div");
    overlay.className = "b-modal-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const teams = t.teams || [];
    const teamOpts = teams.map(tm => `<option value="${esc(tm.name)}" ${tm.name === match.a || tm.name === match.b ? "selected" : ""}>${esc(tm.name)}</option>`).join("");

    overlay.innerHTML = `
      <div class="b-modal" style="max-width:480px">
        <button class="b-modal-close">&times;</button>
        <h3 style="margin:0 0 4px">${esc(match.a)} vs ${esc(match.b)}</h3>
        <p style="color:var(--muted);margin:0 0 16px">${esc(t.tournamentName)} — ${match.stage}</p>
        <div class="b-modal-grid" style="margin-bottom:${isCreator ? "16" : "0"}px">
          <div><strong>Status</strong><span>${match.status}</span></div>
          <div><strong>Date</strong><span>${match.date || "—"}</span></div>
          <div><strong>Time</strong><span>${match.time || "—"}</span></div>
          <div><strong>Winner</strong><span style="${match.winner ? "color:var(--ok);font-weight:700" : ""}">${match.winner || "—"}</span></div>
        </div>
        ${isCreator ? `
          <div style="border-top:1px solid var(--border);padding-top:14px">
            <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:0 0 10px">Edit Match</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div><label style="font-size:.7rem">Team A</label>
                <select id="editTeamA" style="font-size:.82rem">${teamOpts}</select></div>
              <div><label style="font-size:.7rem">Team B</label>
                <select id="editTeamB" style="font-size:.82rem">${teamOpts}</select></div>
              <div><label style="font-size:.7rem">Date</label>
                <input id="editDate" value="${match.date || ""}" placeholder="YYYY-MM-DD" style="font-size:.82rem"></div>
              <div><label style="font-size:.7rem">Time</label>
                <input id="editTime" value="${match.time || ""}" placeholder="HH:MM" style="font-size:.82rem"></div>
              <div><label style="font-size:.7rem">Stage</label>
                <select id="editStage" style="font-size:.82rem">
                  <option value="Qualifier" ${match.stage === "Qualifier" ? "selected" : ""}>Qualifier</option>
                  <option value="Semi Final" ${match.stage === "Semi Final" ? "selected" : ""}>Semi Final</option>
                  <option value="Grand Final" ${match.stage === "Grand Final" ? "selected" : ""}>Grand Final</option>
                </select></div>
              <div><label style="font-size:.7rem">Status</label>
                <select id="editStatus" style="font-size:.82rem">
                  <option value="scheduled" ${match.status === "scheduled" ? "selected" : ""}>Scheduled</option>
                  <option value="live" ${match.status === "live" ? "selected" : ""}>Live</option>
                  <option value="completed" ${match.status === "completed" ? "selected" : ""}>Completed</option>
                </select></div>
            </div>
            <div style="margin-top:10px">
              <label style="font-size:.7rem">Winner</label>
              <select id="editWinner" style="font-size:.82rem">
                <option value="">— No winner yet —</option>
                <option value="${esc(match.a)}" ${match.winner === match.a ? "selected" : ""}>${esc(match.a)}</option>
                <option value="${esc(match.b)}" ${match.winner === match.b ? "selected" : ""}>${esc(match.b)}</option>
              </select>
            </div>
            <button class="btn" id="saveMatchEdit" style="margin-top:12px;width:100%">Save Changes</button>
            <button class="btn alt" id="deleteMatchBtn" style="margin-top:8px;width:100%;color:#dc2626;border-color:#dc2626">Delete Match</button>
            <p id="editMatchMsg" class="success" style="margin-top:6px"></p>
          </div>` : ""}
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".b-modal-close").onclick = () => overlay.remove();

    if (isCreator) {
      document.getElementById("saveMatchEdit")?.addEventListener("click", async () => {
        const a = document.getElementById("editTeamA").value;
        const b = document.getElementById("editTeamB").value;
        if (a === b) return void (document.getElementById("editMatchMsg").textContent = "Teams must be different.");
        const all = getTournaments();
        const tour = all.find(x => x.id === tournamentId);
        if (!tour) return;
        const m = (tour.matches || []).find(x => x.id === match.id);
        if (!m) return;
        m.a = a;
        m.b = b;
        m.date = document.getElementById("editDate").value;
        m.time = document.getElementById("editTime").value;
        m.stage = document.getElementById("editStage").value;
        m.status = document.getElementById("editStatus").value;
        m.winner = document.getElementById("editWinner").value;
        try {
          await saveTournament(tour);
          document.getElementById("editMatchMsg").textContent = "Saved! Refreshing...";
          setTimeout(() => overlay.remove(), 600);
          render();
        } catch (e) { document.getElementById("editMatchMsg").className = "error"; document.getElementById("editMatchMsg").textContent = "Save failed: " + e.message; }
      });

      document.getElementById("deleteMatchBtn")?.addEventListener("click", async () => {
        if (!confirm(`Delete this match (${match.a} vs ${match.b})?`)) return;
        const all = getTournaments();
        const tour = all.find(x => x.id === tournamentId);
        if (!tour) return;
        tour.matches = (tour.matches || []).filter(x => x.id !== match.id);
        try {
          await saveTournament(tour);
          overlay.remove();
          render();
        } catch (e) { document.getElementById("editMatchMsg").className = "error"; document.getElementById("editMatchMsg").textContent = "Delete failed: " + e.message; }
      });

      // Update winner dropdown when teams change
      document.getElementById("editTeamA")?.addEventListener("change", updateWinnerOpts);
      document.getElementById("editTeamB")?.addEventListener("change", updateWinnerOpts);
      function updateWinnerOpts() {
        const a = document.getElementById("editTeamA").value;
        const b = document.getElementById("editTeamB").value;
        const sel = document.getElementById("editWinner");
        sel.innerHTML = `<option value="">— No winner yet —</option>
          <option value="${esc(a)}">${esc(a)}</option>
          <option value="${esc(b)}">${esc(b)}</option>`;
      }
    }
  }

  function render() {
    const selectedId = document.getElementById("scheduleTournamentSelect")?.value || preselect || "";
    const t = selectedId ? getTournaments().find(x => x.id === selectedId) : null;

    if (t && (!t.matches || t.matches.length === 0)) {
      syncTeamsToBracket(t);
      saveTournament(t).catch(console.error);
    }

    if (!getTournaments().length) {
      root.innerHTML = `<div class="card" style="padding:24px;text-align:center"><p style="margin:0">No tournaments exist yet. <a href="create.html">Create one</a> to get started.</p></div>
        <div style="margin-top:20px;overflow-x:auto;padding:8px 4px 16px;border-radius:16px;background:color-mix(in srgb,var(--surface) 60%,transparent);border:1px solid var(--border)">
          ${renderSkeletonBracket()}
        </div>`;
      return;
    }

    if (!t) {
      root.innerHTML = `<div class="card" style="padding:20px">${buildToolbar()}</div>
        <div class="card" style="padding:32px;text-align:center;margin-top:16px">
          <p style="margin:0;color:var(--muted)">Select a tournament to view its bracket.</p>
        </div>
        <div style="margin-top:20px;overflow-x:auto;padding:8px 4px 16px;border-radius:16px;background:color-mix(in srgb,var(--surface) 60%,transparent);border:1px solid var(--border)">
          ${renderSkeletonBracket()}
        </div>`;
      bindToolbar();
      return;
    }

    const bracketHtml = renderBracket(t);
    const isCreator = isTournamentAdmin(t);
    if (!bracketHtml) {
      const teams = t.teams || [];
      if (teams.length > 0) {
        root.innerHTML = `
          <div class="b-toolbar-wrap" style="margin-bottom:20px">
            <div class="card" style="padding:18px;display:flex;gap:12px;align-items:end;flex-wrap:wrap">
              ${buildToolbar()}
              <a class="btn alt" href="tournament.html?id=${t.id}" style="margin-bottom:2px">Manage Teams (${teams.length})</a>
              ${isCreator ? `<button class="btn" id="generateBracketBtn" style="margin-bottom:2px">⚡ Generate Bracket</button>` : ""}
            </div>
          </div>
          <div id="bracketContainer" class="b-container" style="margin-top:20px">
            <div id="bracketInner" style="transform-origin:top left;transition:transform .2s ease">${renderTeamSlots(t)}</div>
          </div>
          <div style="margin-top:16px;padding:16px;border-radius:12px;background:color-mix(in srgb,var(--accent) 6%,var(--surface));text-align:center">
            <p style="margin:0;color:var(--muted);font-size:.85rem">${teams.length} team${teams.length > 1 ? "s" : ""} registered — ${isCreator ? "click Generate Bracket to create matchups" : "waiting for the organizer to generate the bracket"}</p>
          </div>`;
        bindToolbar();
        const container = document.getElementById("bracketContainer");
        if (container) {
          const n = getBracketSize(t);
          const TOTAL_UNIT = 180;
          container.style.height = `${Math.min(Math.max(n * TOTAL_UNIT + 80, 480), 900)}px`;
        }
        if (isCreator) {
          document.getElementById("generateBracketBtn")?.addEventListener("click", async () => {
            try {
              generateFullBracket(t);
              await saveTournament(t);
              render();
            } catch (e) { alert("Failed: " + e.message); }
          });
        }
        return;
      }
      const msg = preselect
        ? `No teams or matches yet. <a href="tournament.html?id=${preselect}">Open the tournament</a> to add teams.`
        : "No tournaments have matches or teams yet.";
      root.innerHTML = `<div class="card" style="padding:20px">${buildToolbar()}</div>
        <div class="card" style="padding:24px;text-align:center;margin-top:16px"><p style="color:var(--muted);margin:0">${msg}</p></div>
        <div id="bracketContainer" class="b-container" style="margin-top:20px">
          <div id="bracketInner" style="transform-origin:top left;transition:transform .2s ease">${renderSkeletonBracket()}</div>
        </div>`;
      bindToolbar();
      const container = document.getElementById("bracketContainer");
      if (container) {
        container.style.height = "900px";
      }
      return;
    }

    root.innerHTML = `
      <div class="b-toolbar-wrap" style="margin-bottom:20px">
        <div class="card" style="padding:18px;display:flex;gap:12px;align-items:end;flex-wrap:wrap">
          ${buildToolbar()}
          <a class="btn alt" href="tournament.html?id=${t.id}" style="margin-bottom:2px">Open Tournament</a>
          ${isCreator ? `<button class="btn alt" id="rescheduleBtn" style="margin-bottom:2px">⏰ Auto Schedule</button>` : ""}
          ${isCreator ? `<button class="btn alt" id="regenerateBtn" style="margin-bottom:2px">🔄 Regenerate Bracket</button>` : ""}
          <div style="display:flex;gap:6px;margin-left:auto">
            <button class="btn alt" id="zoomOutBtn" style="padding:6px 12px">−</button>
            <span id="zoomLevel" style="display:flex;align-items:center;font-size:.85rem;color:var(--muted);min-width:40px;justify-content:center">100%</span>
            <button class="btn alt" id="zoomInBtn" style="padding:6px 12px">+</button>
            <button class="btn alt" id="resetZoomBtn" style="padding:6px 12px">Reset</button>
          </div>
        </div>
      </div>
      <div id="bracketContainer" class="b-container">
        <div id="bracketInner" style="transform-origin:top left;transition:transform .2s ease">${bracketHtml}</div>
      </div>`;

    bindToolbar();

    const container = document.getElementById("bracketContainer");
    if (container) {
      const rounds = buildRounds(t);
      const firstRoundCount = rounds[0]?.matches?.length || 0;
      const TOTAL_UNIT = 180;
      const totalHeight = firstRoundCount * TOTAL_UNIT;
      container.style.height = `${Math.min(Math.max(totalHeight + 80, 480), 900)}px`;
    }

    const inner = document.getElementById("bracketInner");
    const zoomLbl = document.getElementById("zoomLevel");
    let zoom = 1;
    function applyZoom() { inner.style.transform = `scale(${zoom})`; zoomLbl.textContent = Math.round(zoom * 100) + "%"; }
    document.getElementById("zoomInBtn")?.addEventListener("click", () => { zoom = Math.min(zoom + 0.2, 2); applyZoom(); });
    document.getElementById("zoomOutBtn")?.addEventListener("click", () => { zoom = Math.max(zoom - 0.2, 0.4); applyZoom(); });
    document.getElementById("resetZoomBtn")?.addEventListener("click", () => { zoom = 1; applyZoom(); });

    document.getElementById("rescheduleBtn")?.addEventListener("click", async () => {
      const all = getTournaments();
      const tour = all.find(x => x.id === t.id);
      if (!tour) return;
      autoAssignTimes(tour);
      try { await saveTournament(tour); render(); } catch (e) { alert("Failed: " + e.message); }
    });

    document.getElementById("regenerateBtn")?.addEventListener("click", async () => {
      if (!confirm("This will replace all existing matchups with fresh pairings. Continue?")) return;
      const all = getTournaments();
      const tour = all.find(x => x.id === t.id);
      if (!tour) return;
      generateFullBracket(tour);
      try { await saveTournament(tour); render(); } catch (e) { alert("Failed: " + e.message); }
    });

    inner.addEventListener("click", (e) => {
      const card = e.target.closest(".b-match");
      if (!card) return;
      try {
        const match = JSON.parse(decodeURIComponent(card.dataset.encoded));
        openMatchModal(match, card.dataset.tournament, isCreator);
      } catch {}
    });
  }

  function bindToolbar() {
    document.getElementById("scheduleTournamentSelect")?.addEventListener("change", (e) => {
      const val = e.target.value;
      preselect = val;
      if (val) {
        history.replaceState(null, "", "?tournament=" + val);
      } else {
        history.replaceState(null, "", location.pathname);
      }
      render();
    });
  }

  render();
  subscribeToTournaments(render);
}

function initMyTournamentsPage() {
  const root = document.getElementById("myTournamentsRoot");
  if (!root) return;
  const user = getCurrentUser();
  if (!user) {
    root.innerHTML = '<div class="card" style="padding:20px"><p class="error">Login required to view your tournaments.</p><a class="btn" href="login.html">Go to Login</a></div>';
    return;
  }
  const mine = getTournaments().filter((t) => t.ownerUserId === user.id || t.ownerEmail === user.email);
  if (!mine.length) {
    root.innerHTML = '<div class="card" style="padding:20px"><p>No tournaments created yet.</p><a class="btn" href="create.html">Create Tournament</a></div>';
    return;
  }
  root.innerHTML = mine.map((t) => `
    <article class="card" style="padding:14px;margin-bottom:12px">
      <h3>${esc(t.tournamentName)}</h3>
      <p>${esc(t.game)} - Status: ${esc(t.status)} - ${(t.matches || []).length} matches</p>
      <a class="btn" href="tournament.html?id=${t.id}">Open</a>
      <a class="btn alt" href="schedule.html?tournament=${t.id}">Schedule</a>
      ${t.status === "completed" ? `<button class="btn alt" data-delete-history="${t.id}">Delete from History</button>` : ""}
    </article>`).join("");
  root.querySelectorAll("[data-delete-history]").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.deleteHistory;
      _tournamentsCache = getTournaments().filter((t) => t.id !== id);
      try {
        await deleteTournamentFromSupabase(id);
      } catch {}
      initMyTournamentsPage();
    };
  });

  // Add import section (only once)
  let importSection = document.querySelector("#myTournamentsImportSection");
  if (!importSection) {
    importSection = document.createElement("div");
    importSection.id = "myTournamentsImportSection";
    importSection.className = "card";
    importSection.style.cssText = "padding:20px;margin-top:18px";
    importSection.innerHTML = `
      <h3>Import Tournament Backup</h3>
      <p class="hint-text">Import a previously exported tournament file (.json). A new tournament will be created with the imported data.</p>
      <input type="file" id="importTournamentFile" accept=".json" style="margin-bottom:10px">
      <button class="btn" id="importTournamentBtn">Import Tournament</button>
      <p id="importMsg" class="error" style="margin-top:8px"></p>`;
    root.after(importSection);
  }

  document.getElementById("importTournamentBtn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("importTournamentFile");
    const msg = document.getElementById("importMsg");
    msg.textContent = "";
    msg.className = "error";
    if (!fileInput?.files?.length) {
      msg.textContent = "Please select a tournament backup file (.json).";
      return;
    }
    try {
      const t = await importTournamentFromFile(fileInput.files[0]);
      msg.className = "success";
      msg.innerHTML = `Tournament "${esc(t.tournamentName)}" imported! <a href="tournament.html?id=${t.id}" class="btn" style="display:inline-block;margin-top:6px">Open</a>`;
      fileInput.value = "";
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

function initArchivePage() {
  const root = document.getElementById("archiveRoot");
  if (!root) return;
  const archived = getTournaments()
    .filter(isArchivedTournament)
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt) - new Date(a.completedAt || a.updatedAt || a.createdAt));
  if (!archived.length) {
    root.innerHTML = `<div class="empty-state"><p>No archived tournaments yet. Completed and cancelled events will appear here automatically.</p></div>`;
    return;
  }
  root.innerHTML = archived.map((t) => {
    const winners = completedWinners(t);
    const standings = (t.teams || []).map((team, i) => `<li>${i + 1}. ${esc(team.name)} (${team.members?.length || 0} players)</li>`).join("");
    return `<article class="tournament-card card">
      <img class="tournament-banner" src="${tournamentBanner(t)}" alt="${esc(t.game)} tournament banner" loading="lazy">
      <div class="tournament-card-body">
        <h3>${esc(t.tournamentName)} <span class="muted-game">(${esc(t.game)})</span></h3>
        <div class="tournament-meta">
          <span class="tag status-${esc(t.status)}">${statusLabel(t.status)}</span>
          <span class="tag">${participantTotal(t)} players</span>
          <span class="tag">${(t.matches || []).length} results</span>
          ${prizeBadge(t)}
        </div>
        <p><strong>Winners:</strong> ${winners.length ? winners.map(esc).join(", ") : "Not recorded yet"}</p>
        <details>
          <summary>Participants and standings</summary>
          <ol>${standings || "<li>No participants recorded.</li>"}</ol>
        </details>
        <a class="btn" href="tournament.html?id=${t.id}">View Details</a>
        <a class="btn alt" href="schedule.html?tournament=${t.id}">View Results</a>
      </div>
    </article>`;
  }).join("");
}

// ── Admin Panel ─────────────────────────────────────────────
function initAdminPage() {
  const root = document.getElementById("adminRoot");
  if (!root) return;
  const user = getCurrentUser();
  if (!user) {
    root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <p class="error" style="margin:0 0 12px;font-size:1.1rem">Login Required</p>
      <p style="color:var(--muted);margin:0 0 16px">Please log in to access the admin panel.</p>
      <a class="btn" href="login.html">Login</a>
    </div>`;
    return;
  }

  showLoading(root, "Verifying admin access...");

  (async () => {
    try {
      // Verify admin status directly from DB
      const { data: profile } = await supabaseClient
        .from("profiles").select("is_admin").eq("id", user.id).single();
      if (!profile || profile.is_admin !== true) {
        root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
          <p class="error" style="margin:0 0 12px;font-size:1.1rem">Access Denied</p>
          <p style="color:var(--muted);margin:0 0 16px">Only administrators can access this panel.</p>
          <a class="btn" href="index.html">Back to Home</a>
        </div>`;
        return;
      }

      showLoading(root, "Loading admin panel...");

      const [profilesRes, toursRes, msgsRes, lbRes] = await Promise.all([
        supabaseClient.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
        supabaseClient.from("tournaments").select("*").order("created_at", { ascending: false }).limit(200),
        supabaseClient.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100),
        supabaseClient.from("leaderboard_entries").select("*").order("rank", { ascending: true, nullsLast: true }).order("wins", { ascending: false }).limit(200)
      ]);

      const allProfiles = profilesRes.data || [];
      const allTours = toursRes.data || [];
      const allMsgs = msgsRes.data || [];
      const allLb = lbRes.data || [];

      const activeTab = new URLSearchParams(location.search).get("tab") || "dashboard";

      root.innerHTML = `
        <h2>Admin Panel</h2>
        <div class="admin-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn ${activeTab === "dashboard" ? "" : "alt"}" onclick="location.href='admin.html?tab=dashboard'">Dashboard</button>
          <button class="btn ${activeTab === "users" ? "" : "alt"}" onclick="location.href='admin.html?tab=users'">Users (${allProfiles.length})</button>
          <button class="btn ${activeTab === "tournaments" ? "" : "alt"}" onclick="location.href='admin.html?tab=tournaments'">Tournaments (${allTours.length})</button>
          <button class="btn ${activeTab === "messages" ? "" : "alt"}" onclick="location.href='admin.html?tab=messages'">Messages (${allMsgs.length})</button>
          <button class="btn ${activeTab === "leaderboard" ? "" : "alt"}" onclick="location.href='admin.html?tab=leaderboard'">Leaderboard (${allLb.length})</button>
          <button class="btn ${activeTab === "schema" ? "" : "alt"}" onclick="location.href='admin.html?tab=schema'">DB Schema</button>
        </div>
        <div id="adminTabContent"></div>`;

      const content = document.getElementById("adminTabContent");

      if (activeTab === "dashboard") {
        const allUsersCount = allProfiles.length;
        const adminCount = allProfiles.filter(p => p.is_admin).length;
        const completedTours = allTours.filter(t => t.data?.status === "completed").length;
        const activeTours = allTours.filter(t => t.data?.status === "active" || t.data?.status === "upcoming").length;

        content.innerHTML = `
          <div class="stats-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
            <div class="stat-card card" style="padding:18px;text-align:center"><strong style="font-size:1.8rem">${allUsersCount}</strong><span>Users</span><small style="display:block;color:var(--muted);font-size:.75rem">${adminCount} admins</small></div>
            <div class="stat-card card" style="padding:18px;text-align:center"><strong style="font-size:1.8rem">${allTours.length}</strong><span>Tournaments</span><small style="display:block;color:var(--muted);font-size:.75rem">${activeTours} active</small></div>
            <div class="stat-card card" style="padding:18px;text-align:center"><strong style="font-size:1.8rem">${completedTours}</strong><span>Completed</span></div>
            <div class="stat-card card" style="padding:18px;text-align:center"><strong style="font-size:1.8rem">${allMsgs.length}</strong><span>Messages</span></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
            <div class="card" style="padding:20px"><h3>Quick Actions</h3>
              <a class="btn" href="admin.html?tab=users" style="display:block;text-align:center;margin-bottom:8px">Manage Users</a>
              <a class="btn alt" href="admin.html?tab=tournaments" style="display:block;text-align:center;margin-bottom:8px">Manage Tournaments</a>
              <a class="btn alt" href="admin.html?tab=messages" style="display:block;text-align:center">View Messages</a>
            </div>
            <div class="card" style="padding:20px"><h3>Admin Setup</h3>
              <p class="hint-text">To make another user an admin, use the Users tab and click "Make Admin". To remove admin privileges, click "Remove Admin".</p>
            </div>
          </div>`;
      }

      else if (activeTab === "users") {
        content.innerHTML = `<div class="card" style="overflow:hidden;padding:0"><div class="table-wrap" style="border:none"><table>
          <tr><th>Name</th><th>Email</th><th>Age</th><th>Admin</th><th>Actions</th></tr>
          ${allProfiles.map(p => {
            const isMe = p.id === user.id;
            return `<tr>
              <td><strong>${esc(p.first_name || "")} ${esc(p.last_name || "")}</strong></td>
              <td style="font-size:.85rem;color:var(--muted)">${esc(p.email || "")}</td>
              <td>${p.age || "-"}</td>
              <td>${p.is_admin ? '<span class="badge">Admin</span>' : '<span class="badge outline">User</span>'}</td>
              <td>
                ${!p.is_admin ? `<button class="btn alt" style="padding:4px 10px;font-size:.78rem" data-promote="${p.id}">Make Admin</button>` : ""}
                ${p.is_admin && !isMe ? `<button class="btn alt" style="padding:4px 10px;font-size:.78rem" data-demote="${p.id}">Remove Admin</button>` : ""}
                ${!isMe ? ` <button class="btn alt" style="padding:4px 10px;font-size:.78rem;color:#dc2626" data-del-user="${p.id}">Delete</button>` : ""}
              </td>
            </tr>`;
          }).join("")}
        </table></div></div>`;

        content.querySelectorAll("[data-promote]").forEach(b => {
          b.onclick = async () => {
            if (!confirm("Make this user an admin?")) return;
            try {
              await supabaseClient.from("profiles").update({ is_admin: true }).eq("id", b.dataset.promote);
              location.reload();
            } catch { alert("Failed to update."); }
          };
        });
        content.querySelectorAll("[data-demote]").forEach(b => {
          b.onclick = async () => {
            if (!confirm("Remove admin privileges?")) return;
            try {
              await supabaseClient.from("profiles").update({ is_admin: false }).eq("id", b.dataset.demote);
              location.reload();
            } catch { alert("Failed to update."); }
          };
        });
        content.querySelectorAll("[data-del-user]").forEach(b => {
          b.onclick = async () => {
            if (!confirm("Delete this user permanently? This cannot be undone.")) return;
            try {
              await supabaseClient.from("profiles").delete().eq("id", b.dataset.delUser);
              try { await supabaseClient.auth.admin.deleteUser(b.dataset.delUser); } catch {}
              location.reload();
            } catch { alert("Failed to delete."); }
          };
        });
      }

      else if (activeTab === "tournaments") {
        content.innerHTML = `<div class="card" style="overflow:hidden;padding:0"><div class="table-wrap" style="border:none"><table>
          <tr><th>Name</th><th>Game</th><th>Status</th><th>Teams</th><th>Owner</th><th>Actions</th></tr>
          ${allTours.map(r => {
            const d = r.data || {};
            return `<tr>
              <td><strong>${esc(d.tournamentName || "Untitled")}</strong></td>
              <td>${esc(d.game || "-")}</td>
              <td><span class="tag status-${esc(d.status || "upcoming")}">${esc(d.status || "upcoming")}</span></td>
              <td>${(d.teams || []).length}</td>
              <td style="font-size:.8rem;color:var(--muted)">${esc(r.owner_id?.substring(0, 8) || "N/A")}</td>
              <td>
                <a class="btn alt" style="padding:4px 10px;font-size:.78rem" href="tournament.html?id=${r.id}">View</a>
                <button class="btn alt" style="padding:4px 10px;font-size:.78rem;color:#dc2626" data-del-tour="${r.id}">Delete</button>
              </td>
            </tr>`;
          }).join("")}
        </table></div></div>`;

        content.querySelectorAll("[data-del-tour]").forEach(b => {
          b.onclick = async () => {
            if (!confirm("Permanently delete this tournament?")) return;
            try {
              await supabaseClient.from("tournaments").delete().eq("id", b.dataset.delTour);
              location.reload();
            } catch { alert("Failed to delete."); }
          };
        });
      }

      else if (activeTab === "messages") {
        content.innerHTML = `<div class="card" style="overflow:hidden;padding:0"><div class="table-wrap" style="border:none"><table>
          <tr><th>Name</th><th>Email</th><th>Message</th><th>Date</th><th>Actions</th></tr>
          ${allMsgs.map(m => `
            <tr>
              <td><strong>${esc(m.name)}</strong></td>
              <td style="font-size:.85rem">${esc(m.email)}</td>
              <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.message?.substring(0, 100))}</td>
              <td style="font-size:.8rem;color:var(--muted);white-space:nowrap">${m.created_at ? new Date(m.created_at).toLocaleDateString() : "-"}</td>
              <td><button class="btn alt" style="padding:4px 10px;font-size:.78rem;color:#dc2626" data-del-msg="${m.id}">Delete</button></td>
            </tr>`).join("")}
        </table></div></div>`;

        content.querySelectorAll("[data-del-msg]").forEach(b => {
          b.onclick = async () => {
            if (!confirm("Delete this message?")) return;
            try {
              await supabaseClient.from("contact_messages").delete().eq("id", b.dataset.delMsg);
              location.reload();
            } catch { alert("Failed to delete."); }
          };
        });
      }

      else if (activeTab === "leaderboard") {
        const games = ["", "League of Legends", "Valorant", "CS2", "Overwatch"];
        content.innerHTML = `
          <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
            <div style="padding:14px 18px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 10%,var(--surface)),color-mix(in srgb,var(--primary) 6%,var(--surface)));border-bottom:1px solid var(--border)">
              <h3 style="margin:0;font-size:.9rem;text-transform:uppercase;letter-spacing:1px">Leaderboard Entries</h3>
            </div>
            <div class="table-wrap" style="border:none">
              <table>
                <tr><th>Rank</th><th>Team</th><th>Game</th><th>Wins</th><th>Losses</th><th>Notes</th><th>Actions</th></tr>
                ${allLb.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No entries yet</td></tr>' : allLb.map(e => `
                  <tr>
                    <td>${e.rank || "-"}</td>
                    <td><strong>${esc(e.team_name)}</strong></td>
                    <td>${esc(e.game || "-")}</td>
                    <td>${e.wins}</td>
                    <td>${e.losses}</td>
                    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;color:var(--muted)">${esc(e.notes || "")}</td>
                    <td style="white-space:nowrap">
                      <button class="btn alt" style="padding:4px 10px;font-size:.78rem" data-edit-lb="${e.id}">Edit</button>
                      <button class="btn alt" style="padding:4px 10px;font-size:.78rem;color:#dc2626" data-del-lb="${e.id}">Delete</button>
                    </td>
                  </tr>`).join("")}
              </table>
            </div>
          </div>
          <div class="card" style="padding:20px">
            <h3 style="margin:0 0 10px;font-size:.9rem;text-transform:uppercase;letter-spacing:1px">Add / Edit Entry</h3>
            <form id="lbForm" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div><label>Team Name</label><input id="lbTeamName" required></div>
              <div><label>Game</label><select id="lbGame">${games.map(g => `<option value="${g}">${g || "— Any —"}</option>`).join("")}</select></div>
              <div><label>Wins</label><input id="lbWins" type="number" min="0" value="0"></div>
              <div><label>Losses</label><input id="lbLosses" type="number" min="0" value="0"></div>
              <div><label>Rank Position</label><input id="lbRank" type="number" min="0" placeholder="0 = auto"></div>
              <div style="grid-column:1/-1"><label>Notes (optional)</label><input id="lbNotes" placeholder="e.g. Tournament champion, Season MVP..."></div>
              <div style="grid-column:1/-1;display:flex;gap:10px">
                <button class="btn" id="lbSaveBtn">Save Entry</button>
                <button class="btn alt" id="lbClearBtn" type="button">Clear Form</button>
              </div>
              <p id="lbMsg" class="error" style="grid-column:1/-1;margin:4px 0 0"></p>
            </form>
          </div>`;

        content.querySelectorAll("[data-del-lb]").forEach(b => {
          b.onclick = async () => {
            if (!confirm("Delete this leaderboard entry?")) return;
            try {
              await deleteLeaderboardEntry(b.dataset.delLb);
              location.reload();
            } catch { alert("Failed to delete."); }
          };
        });

        content.querySelectorAll("[data-edit-lb]").forEach(b => {
          b.onclick = () => {
            const entry = allLb.find(e => e.id === b.dataset.editLb);
            if (!entry) return;
            document.getElementById("lbTeamName").value = entry.team_name || "";
            document.getElementById("lbGame").value = entry.game || "";
            document.getElementById("lbWins").value = entry.wins || 0;
            document.getElementById("lbLosses").value = entry.losses || 0;
            document.getElementById("lbRank").value = entry.rank || 0;
            document.getElementById("lbNotes").value = entry.notes || "";
            document.getElementById("lbForm").dataset.editId = entry.id;
            document.querySelector("#lbForm h3, .card h3").textContent = "Edit Entry";
          };
        });

        document.getElementById("lbClearBtn").onclick = () => {
          document.getElementById("lbForm").reset();
          delete document.getElementById("lbForm").dataset.editId;
        };

        document.getElementById("lbSaveBtn").onclick = async () => {
          const msg = document.getElementById("lbMsg");
          msg.textContent = "";
          msg.className = "error";
          const team_name = document.getElementById("lbTeamName").value.trim();
          if (!team_name) { msg.textContent = "Team name is required."; return; }
          const entry = {
            id: document.getElementById("lbForm").dataset.editId || undefined,
            team_name,
            game: document.getElementById("lbGame").value,
            wins: parseInt(document.getElementById("lbWins").value) || 0,
            losses: parseInt(document.getElementById("lbLosses").value) || 0,
            rank: parseInt(document.getElementById("lbRank").value) || 0,
            notes: document.getElementById("lbNotes").value.trim()
          };
          try {
            await saveLeaderboardEntry(entry);
            location.reload();
          } catch (err) { msg.textContent = "Failed to save: " + err.message; }
        };
      }

      else if (activeTab === "schema") {
        content.innerHTML = `
          <div class="card" style="padding:20px;margin-bottom:16px">
            <h3 style="margin:0 0 10px;font-size:1.1rem;text-transform:uppercase;letter-spacing:1px">Relational Database Design</h3>
            <p style="color:var(--muted);font-size:.9rem;margin-bottom:20px">
              Below are the 5 core tables that store all relational data for Zoltrakk Arena, along with their columns and database CRUD integration mappings.
            </p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px">
              <!-- Table 1 -->
              <div class="card" style="padding:16px;background:color-mix(in srgb, var(--surface-2) 30%, transparent);border:1px solid var(--border)">
                <h4 style="color:var(--accent);margin:0 0 8px">1. profiles (Users)</h4>
                <p style="font-size:.8rem;color:var(--muted);margin:0 0 12px">Extends authentication with custom preferences, stats and rosters.</p>
                <div style="font-family:monospace;font-size:.8rem;background:var(--bg);padding:8px;border-radius:6px;margin-bottom:12px;border:1px solid var(--border)">
                  <strong>Columns:</strong><br>
                  id (UUID, PK)<br>
                  first_name (TEXT)<br>
                  last_name (TEXT)<br>
                  age (INT)<br>
                  avatar_url (TEXT)<br>
                  theme_pref (TEXT)<br>
                  is_admin (BOOL)<br>
                  best_game (TEXT)<br>
                  rank (TEXT)<br>
                  looking_for (TEXT)<br>
                  teammates (JSONB)<br>
                  created_at / updated_at
                </div>
                <div style="font-size:.8rem">
                  <strong>CRUD Mapping:</strong>
                  <ul style="margin:4px 0 0;padding-left:16px">
                    <li>Create: Auto-trigger on signup</li>
                    <li>Read: Profiles / Leaderboard / Admin</li>
                    <li>Update: Theme settings / Edit profile</li>
                    <li>Delete: Delete user (Admin)</li>
                  </ul>
                </div>
              </div>

              <!-- Table 2 -->
              <div class="card" style="padding:16px;background:color-mix(in srgb, var(--surface-2) 30%, transparent);border:1px solid var(--border)">
                <h4 style="color:var(--accent);margin:0 0 8px">2. tournaments (Brackets)</h4>
                <p style="font-size:.8rem;color:var(--muted);margin:0 0 12px">Stores tournament schedules, registered teams and matches.</p>
                <div style="font-family:monospace;font-size:.8rem;background:var(--bg);padding:8px;border-radius:6px;margin-bottom:12px;border:1px solid var(--border)">
                  <strong>Columns:</strong><br>
                  id (TEXT, PK)<br>
                  owner_id (UUID, FK)<br>
                  data (JSONB: brackets, teams)<br>
                  created_at / updated_at
                </div>
                <div style="font-size:.8rem">
                  <strong>CRUD Mapping:</strong>
                  <ul style="margin:4px 0 0;padding-left:16px">
                    <li>Create: Host tournament builder</li>
                    <li>Read: Schedule / Browse / Dynamic Details</li>
                    <li>Update: Match results / Squad joins</li>
                    <li>Delete: Delete tournament (Owner/Admin)</li>
                  </ul>
                </div>
              </div>

              <!-- Table 3 -->
              <div class="card" style="padding:16px;background:color-mix(in srgb, var(--surface-2) 30%, transparent);border:1px solid var(--border)">
                <h4 style="color:var(--accent);margin:0 0 8px">3. user_players (Squads)</h4>
                <p style="font-size:.8rem;color:var(--muted);margin:0 0 12px">Personal squad rosters managed by users.</p>
                <div style="font-family:monospace;font-size:.8rem;background:var(--bg);padding:8px;border-radius:6px;margin-bottom:12px;border:1px solid var(--border)">
                  <strong>Columns:</strong><br>
                  id (UUID, PK)<br>
                  user_id (UUID, FK)<br>
                  data (JSONB: customized player details)<br>
                  created_at / updated_at
                </div>
                <div style="font-size:.8rem">
                  <strong>CRUD Mapping:</strong>
                  <ul style="margin:4px 0 0;padding-left:16px">
                    <li>Create: Squad Registry registration</li>
                    <li>Read: Players Gallery / Signup select</li>
                    <li>Update: Modify squad parameters</li>
                    <li>Delete: Delete squad member</li>
                  </ul>
                </div>
              </div>

              <!-- Table 4 -->
              <div class="card" style="padding:16px;background:color-mix(in srgb, var(--surface-2) 30%, transparent);border:1px solid var(--border)">
                <h4 style="color:var(--accent);margin:0 0 8px">4. contact_messages (Tickets)</h4>
                <p style="font-size:.8rem;color:var(--muted);margin:0 0 12px">Support requests sent via contact page form.</p>
                <div style="font-family:monospace;font-size:.8rem;background:var(--bg);padding:8px;border-radius:6px;margin-bottom:12px;border:1px solid var(--border)">
                  <strong>Columns:</strong><br>
                  id (UUID, PK)<br>
                  name (TEXT)<br>
                  email (TEXT)<br>
                  dob (TEXT)<br>
                  message (TEXT)<br>
                  created_at
                </div>
                <div style="font-size:.8rem">
                  <strong>CRUD Mapping:</strong>
                  <ul style="margin:4px 0 0;padding-left:16px">
                    <li>Create: Contact form submit</li>
                    <li>Read: Admin support inbox</li>
                    <li>Update: N/A (read-only audit trail)</li>
                    <li>Delete: Admin deletes message</li>
                  </ul>
                </div>
              </div>

              <!-- Table 5 -->
              <div class="card" style="padding:16px;background:color-mix(in srgb, var(--surface-2) 30%, transparent);border:1px solid var(--border)">
                <h4 style="color:var(--accent);margin:0 0 8px">5. leaderboard_entries (Standings)</h4>
                <p style="font-size:.8rem;color:var(--muted);margin:0 0 12px">Dynamic global squad stats and score ranking.</p>
                <div style="font-family:monospace;font-size:.8rem;background:var(--bg);padding:8px;border-radius:6px;margin-bottom:12px;border:1px solid var(--border)">
                  <strong>Columns:</strong><br>
                  id (UUID, PK)<br>
                  team_name (TEXT)<br>
                  game (TEXT)<br>
                  wins / losses (INT)<br>
                  rank (INT)<br>
                  notes (TEXT)<br>
                  updated_by (UUID, FK)<br>
                  created_at / updated_at
                </div>
                <div style="font-size:.8rem">
                  <strong>CRUD Mapping:</strong>
                  <ul style="margin:4px 0 0;padding-left:16px">
                    <li>Create: Admin adds squad record</li>
                    <li>Read: Global standings view / Admin view</li>
                    <li>Update: Admin modifies stats / wins</li>
                    <li>Delete: Admin removes standings record</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    } catch (err) {
      root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
        <p class="error" style="margin:0 0 8px">Failed to load admin data.</p>
        <p style="color:var(--muted);margin:0 0 16px">${esc(err.message)}</p>
        <a class="btn" href="admin.html">Retry</a>
      </div>`;
    }
  })();
}

// ── Leaderboard ─────────────────────────────────────────────
function initLeaderboardPage() {
  const root = document.getElementById("leaderboardRoot");
  if (!root) return;

  const famousRosters = {
    "Team XO!": "Asif, Raffay, Volt, Specter, Xenon",
    "Zoltrakk Elite": "Neo, Trinity, Morpheus, Link, Tank",
    "Alpha Squad": "Apex, Shadow, Wraith, Cypher, Omen",
    "Nexus Gaming": "Phoenix, Jett, Sage, Sova, Breach",
    "Pixel Gaming": "Cyber, Byte, Glitch, Pixel, Vector",
    "Alliance": "S4, Loda, Akke, EGM, Bulldog",
    "Navi Classic": "Dendi, Puppey, XBOCT, Kuroky, Funn1k",
    "Fnatic Legacy": "JW, Flusha, Pronax, Olofmeister, Krimz"
  };

  const render = () => {
    const game = document.getElementById("lbGameFilter")?.value || "";
    const query = (document.getElementById("lbSearch")?.value || "").toLowerCase();
    const tournaments = getTournaments();
    const manualEntries = getLeaderboardEntries();
    const teamScores = {};

    // Computed entries from completed matches
    tournaments.forEach(t => {
      if (game && (t.game || "").toLowerCase() !== game.toLowerCase()) return;
      (t.matches || []).forEach(m => {
        if (m.status !== "completed" || !m.winner) return;
        const winner = m.winner.trim();
        if (!winner) return;
        if (!teamScores[winner]) {
          teamScores[winner] = { name: winner, wins: 0, games: new Set(), tournaments: new Set(), source: "computed" };
        }
        teamScores[winner].wins++;
        teamScores[winner].games.add(t.game);
        teamScores[winner].tournaments.add(t.tournamentName);
      });
    });

    // Overlay with manual entries from admin
    manualEntries.forEach(e => {
      if (game && e.game && e.game.toLowerCase() !== game.toLowerCase()) return;
      const key = e.team_name;
      if (!teamScores[key]) {
        teamScores[key] = { name: key, wins: 0, games: new Set(), tournaments: new Set(), source: "manual", rank: e.rank };
      } else {
        teamScores[key].source = "manual";
        teamScores[key].rank = e.rank || teamScores[key].rank;
      }
      if (e.wins > teamScores[key].wins) teamScores[key].wins = e.wins;
      if (e.game && !teamScores[key].games.has(e.game)) teamScores[key].games.add(e.game);
    });

    let sorted = Object.values(teamScores);
    if (query) sorted = sorted.filter(s => s.name.toLowerCase().includes(query));

    // Resolve rosters
    sorted.forEach(s => {
      if (famousRosters[s.name]) {
        s.roster = famousRosters[s.name];
      } else {
        for (const t of tournaments) {
          const tm = t.teams.find(x => x.name.toLowerCase() === s.name.toLowerCase());
          if (tm && tm.members && tm.members.length) {
            s.roster = tm.members.map(m => m.name).join(", ");
            break;
          }
        }
      }
      if (!s.roster) s.roster = "TBD Roster";
    });

    // Sort: manual entries by rank first (rank > 0), then by wins desc
    sorted.sort((a, b) => {
      const aRank = a.rank || 999;
      const bRank = b.rank || 999;
      if (aRank !== bRank) return aRank - bRank;
      return b.wins - a.wins || a.name.localeCompare(b.name);
    });

    if (!sorted.length) {
      root.innerHTML = `<div class="card" style="padding:24px;text-align:center"><p style="margin:0;color:var(--muted)">No rankings yet. Complete matches or an admin can add entries.</p></div>`;
      return;
    }

    root.innerHTML = `
      <div class="card" style="overflow:hidden">
        <div style="padding:14px 18px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 10%,var(--surface)),color-mix(in srgb,var(--primary) 6%,var(--surface)));border-bottom:1px solid var(--border)">
          <h3 style="margin:0;font-size:.95rem;text-transform:uppercase;letter-spacing:1px">Team Rankings</h3>
        </div>
        <div class="table-wrap" style="border:none">
          <table>
            <tr><th>#</th><th>Team</th><th>Famous Roster</th><th>Wins</th><th>Games</th><th>Tournaments</th></tr>
            ${sorted.map((s, i) => {
              const medal = i === 0 ? "&#129351;" : i === 1 ? "&#129352;" : i === 2 ? "&#129353;" : "";
              return `<tr class="${i < 3 ? "top-three" : ""}">
                <td><strong>${medal || (i + 1)}</strong></td>
                <td><strong>${esc(s.name)}</strong></td>
                <td><span class="hint-text" style="font-size:.85rem">${esc(s.roster)}</span></td>
                <td><span class="badge">${s.wins}</span></td>
                <td>${Array.from(s.games).map(g => esc(g)).join(", ")}</td>
                <td>${s.tournaments.size}</td>
              </tr>`;
            }).join("")}
          </table>
        </div>
      </div>`;
  };

  ["lbGameFilter", "lbSearch"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    }
  });
  loadLeaderboardEntries().then(() => { render(); subscribeToLeaderboard(render); });
  render();
  subscribeToTournaments(render);
}

// ── Profile Page ─────────────────────────────────────────────
function initProfilePage() {
  const root = document.getElementById("profileRoot");
  if (!root) return;

  const user = getCurrentUser();
  if (!user) {
    root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <p class="error" style="margin:0 0 12px">Login required to view your profile.</p>
      <a class="btn" href="login.html">Go to Login</a>
      <a class="btn alt" href="signup.html">Create Account</a>
    </div>`;
    return;
  }

  showLoading(root, "Loading profile...");

  const GAMES = ["League of Legends", "Valorant", "CS2", "Overwatch"];
  const RANKS = {
    "League of Legends": ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"],
    "Valorant": ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"],
    "CS2": ["Silver", "Silver Elite", "Gold Nova", "Master Guardian", "AK-47", "AWP", "Supreme", "Global Elite"],
    "Overwatch": ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Champion"]
  };
  const LOOKING_FOR_OPTIONS = [
    { value: "both", label: "Both Casual & Competitive" },
    { value: "casual", label: "Casual Tournaments" },
    { value: "competitive", label: "Pro Competitive" }
  ];

  (async () => {
    try {
      const { data: profile } = await supabaseClient
        .from("profiles").select("best_game, rank, looking_for, teammates, theme_pref").eq("id", user.id).single();

      const bestGame = profile?.best_game || "";
      const rank = profile?.rank || "";
      const lookingFor = profile?.looking_for || "both";
      const teammates = profile?.teammates || [];
      const mySquad = getUserPlayers();
      const myTournaments = getTournaments().filter(t => t.ownerUserId === user.id || t.ownerEmail === user.email);
      const recentlyViewed = JSON.parse(localStorage.getItem("zoltrakk_recently_viewed") || "[]");

      root.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">

          <!-- User Card -->
          <div class="card" style="padding:24px">
            <div style="text-align:center;margin-bottom:16px">
              <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff;font-weight:700">${(user.name || "U")[0].toUpperCase()}</div>
              <h2 style="margin:0">${esc(user.name)}</h2>
              <p style="color:var(--muted);margin:4px 0 0">${esc(user.email)}</p>
              ${bestGame ? `<span class="tag" style="margin-top:8px;display:inline-block">${esc(bestGame)}${rank ? " — " + esc(rank) : ""}</span>` : ""}
              ${teammates.length ? `<p style="color:var(--muted);font-size:.85rem;margin-top:6px">${teammates.length} teammate${teammates.length > 1 ? "s" : ""} • ${lookingFor === "competitive" ? "Pro Competitive" : lookingFor === "casual" ? "Casual" : "All Tournaments"}</p>` : ""}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
              <div class="stat-card" style="padding:12px"><strong>${myTournaments.length}</strong><span>Tournaments</span></div>
              <div class="stat-card" style="padding:12px"><strong>${mySquad.length}</strong><span>Squad</span></div>
              <div class="stat-card" style="padding:12px"><strong>${recentlyViewed.length}</strong><span>Views</span></div>
            </div>
            <a class="btn" href="my-tournaments.html" style="display:block;text-align:center">Manage Tournaments</a>
          </div>

          <!-- Gaming Profile -->
          <div class="card" style="padding:24px">
            <h3 style="margin:0 0 14px">Gaming Profile</h3>

            <label>Best Game</label>
            <select id="profileBestGame"><option value="">Select your main game...</option>
              ${GAMES.map(g => `<option value="${g}" ${bestGame === g ? "selected" : ""}>${g}</option>`).join("")}
            </select>

            <label style="margin-top:10px">Your Rank</label>
            <select id="profileRank"><option value="">Select your rank...</option>
              ${bestGame && RANKS[bestGame] ? RANKS[bestGame].map(r => `<option value="${r}" ${rank === r ? "selected" : ""}>${r}</option>`).join("") : ""}
            </select>
            ${!bestGame ? '<p class="hint-text">Select a game first to see ranks</p>' : ""}

            <label style="margin-top:10px">Looking For</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${LOOKING_FOR_OPTIONS.map(o => `
                <button class="btn ${lookingFor === o.value ? "" : "alt"} profile-looking-btn" data-looking="${o.value}" style="flex:1;min-width:120px;font-size:.82rem">${o.label}</button>
              `).join("")}
            </div>
            <p id="profilePrefMsg" class="success" style="margin-top:8px"></p>
          </div>

          <!-- Teammates -->
          <div class="card" style="padding:24px">
            <h3 style="margin:0 0 4px">Teammates</h3>
            <p class="hint-text" style="margin:0 0 12px">Add people you play with, or go solo.</p>

            <div style="display:flex;gap:8px;margin-bottom:10px">
              <button class="btn ${!teammates.length ? "" : "alt"} profile-solo-btn" data-solo="true" style="flex:1">Solo</button>
              <button class="btn ${teammates.length ? "" : "alt"} profile-solo-btn" data-solo="false" style="flex:1">With Team</button>
            </div>

            <div id="teammatesSection" style="display:${teammates.length ? "block" : "none"}">
              <div style="display:flex;gap:8px;margin-bottom:10px">
                <input id="teammateNameInput" placeholder="Teammate's name..." style="flex:1">
                <button class="btn" id="addTeammateBtn" style="white-space:nowrap">Add</button>
              </div>
              <div id="teammateList">
                ${teammates.map((t, i) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:color-mix(in srgb,var(--accent) 6%,var(--surface));border-radius:8px;margin-bottom:4px">
                    <span style="font-weight:500">${esc(typeof t === "string" ? t : t.name || t)}</span>
                    <button class="btn alt remove-teammate" data-idx="${i}" style="padding:4px 8px;font-size:.75rem;color:#dc2626">Remove</button>
                  </div>
                `).join("")}
              </div>
              ${mySquad.length ? `
                <p class="hint-text" style="margin:10px 0 4px">Or add from your squad:</p>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  ${mySquad.filter(p => !teammates.some(t => (typeof t === "string" ? t : t.name || t) === p.name)).map(p => `
                    <button class="btn alt add-squad-btn" data-name="${esc(p.name)}" style="padding:5px 10px;font-size:.78rem">+ ${esc(p.name)}</button>
                  `).join("")}
                </div>
              ` : ""}
            </div>
            <p id="teammateMsg" class="success" style="margin-top:8px"></p>
          </div>

          <!-- Theme & Browser Storage -->
          <div class="card" style="padding:24px">
            <h3 style="margin:0 0 10px">Theme</h3>
            <div style="display:flex;gap:8px">
              <button class="btn profile-theme-btn" data-theme-choice="light" style="flex:1">Light</button>
              <button class="btn alt profile-theme-btn" data-theme-choice="dark" style="flex:1">Dark</button>
            </div>
            <p id="profileThemeMsg" class="success" style="margin-top:8px"></p>

            <h3 style="margin-top:20px">Recently Viewed</h3>
            <p class="hint-text" style="margin:0 0 8px">Stored in your browser (localStorage).</p>
            <div id="recentlyViewedList" style="max-height:160px;overflow-y:auto">
              ${recentlyViewed.length ? recentlyViewed.map(id => {
                const t = getTournaments().find(x => x.id === id);
                return t ? `<p style="margin:4px 0;font-size:.88rem"><a href="tournament.html?id=${t.id}">${esc(t.tournamentName)}</a></p>` : "";
              }).join("") : "<p style='color:var(--muted);font-size:.88rem'>No tournaments viewed yet.</p>"}
            </div>
            ${recentlyViewed.length ? '<button class="btn alt" id="clearRecentBtn" style="margin-top:8px;font-size:.82rem">Clear History</button>' : ""}
          </div>

        </div>`;

      // ── Game selection updates rank dropdown ──
      document.getElementById("profileBestGame")?.addEventListener("change", async (e) => {
        const game = e.target.value;
        const rankSel = document.getElementById("profileRank");
        rankSel.innerHTML = `<option value="">Select your rank...</option>` +
          (RANKS[game] || []).map(r => `<option value="${r}" ${rank === r ? "selected" : ""}>${r}</option>`).join("");
        try {
          await supabaseClient.from("profiles").update({ best_game: game, rank: "" }).eq("id", user.id);
          document.getElementById("profilePrefMsg").textContent = "Game updated!";
        } catch { document.getElementById("profilePrefMsg").textContent = "Failed to save."; }
      });

      document.getElementById("profileRank")?.addEventListener("change", async (e) => {
        try {
          await supabaseClient.from("profiles").update({ rank: e.target.value }).eq("id", user.id);
          document.getElementById("profilePrefMsg").textContent = "Rank updated!";
        } catch { document.getElementById("profilePrefMsg").textContent = "Failed to save."; }
      });

      // ── Looking For buttons ──
      document.querySelectorAll(".profile-looking-btn").forEach(btn => {
        btn.onclick = async () => {
          document.querySelectorAll(".profile-looking-btn").forEach(b => { b.classList.add("alt"); b.classList.remove("open"); });
          btn.classList.remove("alt");
          btn.classList.add("open");
          try {
            await supabaseClient.from("profiles").update({ looking_for: btn.dataset.looking }).eq("id", user.id);
            document.getElementById("profilePrefMsg").textContent = "Preference saved!";
          } catch { document.getElementById("profilePrefMsg").textContent = "Failed to save."; }
        };
      });

      // ── Solo / Team toggle ──
      document.querySelectorAll(".profile-solo-btn").forEach(btn => {
        btn.onclick = async () => {
          const isSolo = btn.dataset.solo === "true";
          document.querySelectorAll(".profile-solo-btn").forEach(b => { b.classList.add("alt"); b.classList.remove("open"); });
          btn.classList.remove("alt");
          btn.classList.add("open");
          const sec = document.getElementById("teammatesSection");
          if (isSolo) {
            sec.style.display = "none";
            try {
              await supabaseClient.from("profiles").update({ teammates: [] }).eq("id", user.id);
              document.getElementById("teammateMsg").textContent = "Set to Solo. Good luck out there!";
            } catch { document.getElementById("teammateMsg").textContent = "Failed to save."; }
          } else {
            sec.style.display = "block";
          }
        };
      });

      // ── Add teammate ──
      const addTeammate = async (name) => {
        if (!name.trim()) return;
        const updated = [...teammates, name.trim()];
        try {
          await supabaseClient.from("profiles").update({ teammates: updated }).eq("id", user.id);
          document.getElementById("teammateMsg").textContent = `${name.trim()} added!`;
          initProfilePage();
        } catch { document.getElementById("teammateMsg").textContent = "Failed to add."; }
      };

      document.getElementById("addTeammateBtn")?.addEventListener("click", () => {
        addTeammate(document.getElementById("teammateNameInput").value);
      });

      document.getElementById("teammateNameInput")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addTeammate(e.target.value);
      });

      document.querySelectorAll(".add-squad-btn").forEach(btn => {
        btn.onclick = () => addTeammate(btn.dataset.name);
      });

      document.querySelectorAll(".remove-teammate").forEach(btn => {
        btn.onclick = async () => {
          const updated = teammates.filter((_, i) => i !== parseInt(btn.dataset.idx));
          try {
            await supabaseClient.from("profiles").update({ teammates: updated }).eq("id", user.id);
            document.getElementById("teammateMsg").textContent = "Teammate removed.";
            initProfilePage();
          } catch { document.getElementById("teammateMsg").textContent = "Failed to remove."; }
        };
      });

      // ── Theme buttons ──
      document.querySelectorAll(".profile-theme-btn").forEach(btn => {
        btn.onclick = async () => {
          const theme = btn.dataset.themeChoice;
          document.body.setAttribute("data-theme", theme);
          localStorage.setItem(THEME_KEY, theme);
          document.querySelectorAll(".profile-theme-btn").forEach(b => { b.classList.add("alt"); b.classList.remove("open"); });
          btn.classList.remove("alt");
          btn.classList.add("open");
          try {
            await supabaseClient.from("profiles").update({ theme_pref: theme }).eq("id", user.id);
            document.getElementById("profileThemeMsg").textContent = `Theme set to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
          } catch { document.getElementById("profileThemeMsg").textContent = "Failed to save."; }
        };
      });

      document.getElementById("clearRecentBtn")?.addEventListener("click", () => {
        localStorage.removeItem("zoltrakk_recently_viewed");
        document.getElementById("recentlyViewedList").innerHTML = "<p style='color:var(--muted);font-size:.88rem'>Cleared.</p>";
      });

    } catch (err) {
      root.innerHTML = `<div class="card" style="padding:24px;text-align:center">
        <p class="error" style="margin:0 0 8px">Failed to load profile.</p>
        <p style="color:var(--muted);margin:0 0 16px">${esc(err.message)}</p>
        <a class="btn" href="profile.html">Retry</a>
      </div>`;
    }
  })();
}

// ── Track recently viewed (Browser Storage demo) ────────────
function trackTournamentView(tournamentId) {
  let recent = JSON.parse(localStorage.getItem("zoltrakk_recently_viewed") || "[]");
  recent = [tournamentId, ...recent.filter(id => id !== tournamentId)].slice(0, 10);
  localStorage.setItem("zoltrakk_recently_viewed", JSON.stringify(recent));
}

// ── Contact Page ─────────────────────────────────────────────
function initContactPage() {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("contactStatus");
  if (!form || !status) return;

  // Initialize Leaflet Map API integration
  const mapContainer = document.getElementById("map");
  if (mapContainer && typeof L !== "undefined") {
    try {
      const map = L.map("map").setView([33.7154, 73.0245], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      L.marker([33.7154, 73.0245])
        .addTo(map)
        .bindPopup("<b>Zoltrakk Arena Support Desk</b><br>Air University Campus, Islamabad, Pakistan")
        .openPopup();
    } catch (err) {
      console.error("Leaflet initialization error:", err);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "error";
    const name = form.querySelector('[name="name"]')?.value?.trim() || form.querySelector('[type="text"]')?.value?.trim() || "";
    const email = form.querySelector('[type="email"]')?.value?.trim() || "";
    const dob = form.querySelector('[type="date"]')?.value || "";
    const msg = form.querySelector("textarea")?.value?.trim() || "";

    if (!name || !email || !msg) {
      status.textContent = "Please fill in all required fields.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = "Please enter a valid email address.";
      return;
    }

    try {
      const { error } = await supabaseClient.from("contact_messages").insert({
        name, email, dob, message: msg
      });
      if (error) throw error;
      status.className = "success";
      status.textContent = "Message sent! We'll get back to you soon.";
      form.reset();
    } catch (err) {
      status.textContent = "Failed to send message. Please try again.";
      console.error("Contact save error:", err);
    }
  });
}

// ── Schema Page Authorization ──────────────────────────────────
function initSchemaPage() {
  const root = document.getElementById("schemaRoot");
  if (!root) return;

  const user = getCurrentUser();
  if (!user) {
    root.innerHTML = `<div class="container" style="padding-top:40px;padding-bottom:40px"><div class="card" style="padding:32px;text-align:center">
      <h2 class="error" style="margin:0 0 12px">Login Required</h2>
      <p style="color:var(--muted);margin:0 0 20px">Please log in as an administrator to access the database schema.</p>
      <a class="btn" href="login.html">Login</a>
    </div></div>`;
    root.style.display = "block";
    return;
  }

  const originalHtml = root.innerHTML;
  showLoading(root, "Verifying database access permissions...");
  root.style.display = "block";

  (async () => {
    try {
      const { data: profile } = await supabaseClient
        .from("profiles").select("is_admin").eq("id", user.id).single();
      if (!profile || profile.is_admin !== true) {
        root.innerHTML = `<div class="container" style="padding-top:40px;padding-bottom:40px"><div class="card" style="padding:32px;text-align:center">
          <h2 class="error" style="margin:0 0 12px">Access Denied</h2>
          <p style="color:var(--muted);margin:0 0 20px">Only administrators can access this database schema page.</p>
          <a class="btn" href="index.html">Back to Home</a>
        </div></div>`;
        return;
      }
      
      root.innerHTML = originalHtml;
    } catch (err) {
      root.innerHTML = `<div class="container" style="padding-top:40px;padding-bottom:40px"><div class="card" style="padding:32px;text-align:center">
        <h2 class="error" style="margin:0 0 12px">Verification Failed</h2>
        <p style="color:var(--muted);margin:0 0 20px">${esc(err.message)}</p>
        <a class="btn" href="index.html">Back to Home</a>
      </div></div>`;
    }
  })();
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initChatbot();

  // Show loading state on dynamic containers
  const detailRoot = document.getElementById("tournamentDetailRoot");
  const scheduleRoot = document.getElementById("scheduleRoot");
  const myToursRoot = document.getElementById("myTournamentsRoot");
  const archiveRoot = document.getElementById("archiveRoot");
  const tournamentsCard = document.querySelector("[data-created-tournaments]");
  if (detailRoot) showLoading(detailRoot, "Loading tournament...");
  if (myToursRoot) showLoading(myToursRoot, "Loading your tournaments...");
  if (archiveRoot) showLoading(archiveRoot, "Loading archive...");
  if (tournamentsCard) showLoading(tournamentsCard, "Loading tournaments...");

  await initSupabase();
  await loadCurrentUser();
  await Promise.all([
    loadTournaments(),
    loadUserPlayers(),
    loadAllPlayers()
  ]);

  normalizeHeaderNav();
  initHomeStats();
  initSignupPage();
  initLoginPage();
  initCreateTournamentPage();
  initTournamentsPage();
  initTournamentDetailPage();
  initSchedulePage();
  initMyTournamentsPage();
  initArchivePage();
  initContactPage();
  initPlayersPage();
  initLeaderboardPage();
  initProfilePage();
  initAdminPage();
  initSchemaPage();
});
