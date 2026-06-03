const THEME_KEY = "zoltrakk_theme";
const REG_KEY = "tournament_participants";
const TOURNAMENTS_KEY = "zoltrakk_tournaments_v2";
const USERS_KEY = "zoltrakk_users";
const CURRENT_USER_KEY = "zoltrakk_current_user";
const STORE_API = "/.netlify/functions/store";
const DEFAULT_PLAYER_IMAGE = "images/player-default.svg";
const MAX_PLAYER_IMAGE_BYTES = 450000;
const DEFAULT_BANNERS = {
  "League of Legends": "images/game-lol-art.png",
  "Valorant": "images/game-valorant-art.png",
  "CS2": "images/game-cs2-art.png",
  "Overwatch": "images/game-overwatch-art.png"
};
const OPEN_STATUSES = ["upcoming", "active"];

let cloudOnline = false;
let syncInFlight = false;

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function nowIso() { return new Date().toISOString(); }

function getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
function setUsers(v, opts = {}) {
  localStorage.setItem(USERS_KEY, JSON.stringify(v));
  if (!opts.skipCloud) pushCloudCollection("users", v);
}
function getCurrentUser() { return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null"); }
function setCurrentUser(v) { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(v)); }
function clearCurrentUser() { localStorage.removeItem(CURRENT_USER_KEY); }
function getTournaments() { return JSON.parse(localStorage.getItem(TOURNAMENTS_KEY) || "[]"); }
function setTournaments(v, opts = {}) {
  localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(v));
  if (!opts.skipCloud) pushCloudCollection("tournaments", v);
}

function mergeByUpdatedAt(localArr, cloudArr) {
  const map = new Map();
  [...localArr, ...cloudArr].forEach((item) => {
    if (!item?.id) return;
    const prev = map.get(item.id);
    if (!prev) return map.set(item.id, item);
    const prevTime = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
    const nextTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
    map.set(item.id, nextTime >= prevTime ? item : prev);
  });
  return Array.from(map.values());
}

function mergeUsers(local, cloud) {
  const map = new Map(local.map((u) => [u.email, u]));
  cloud.forEach((cu) => {
    const prev = map.get(cu.email);
    if (!prev) map.set(cu.email, { ...cu });
    else map.set(cu.email, { ...prev, ...cu, password: prev.password || cu.password });
  });
  return Array.from(map.values());
}

async function fetchCloudCollection(collection) {
  const res = await fetch(`${STORE_API}?collection=${collection}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Cloud fetch failed");
  return json.data || [];
}

async function pushCloudCollection(collection, data) {
  const res = await fetch(STORE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection, data })
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Cloud push failed");
  return json;
}

async function cloudRegister(user) {
  const res = await fetch(STORE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", user })
  });
  return res.json();
}

async function cloudLogin(email, password) {
  const res = await fetch(STORE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email, password })
  });
  return res.json();
}

function injectSyncBadges() {
  document.querySelectorAll("footer").forEach((footer) => {
    if (!footer.querySelector("[data-sync-badge]")) {
      footer.appendChild(document.createTextNode(" "));
      const span = document.createElement("span");
      span.setAttribute("data-sync-badge", "");
      footer.appendChild(span);
    }
  });
}

function updateSyncBadge() {
  injectSyncBadges();
  document.querySelectorAll("[data-sync-badge]").forEach((el) => {
    el.innerHTML = cloudOnline
      ? '<span class="sync-badge online">Cloud sync active</span>'
      : '<span class="sync-badge offline">Local mode (deploy on Netlify for cloud)</span>';
  });
}

async function syncAllFromCloud() {
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    const [cloudUsers, cloudTournaments, cloudParticipants] = await Promise.all([
      fetchCloudCollection("users"),
      fetchCloudCollection("tournaments"),
      fetchCloudCollection("participants")
    ]);
    cloudOnline = true;

    const localUsers = getUsers();
    const mergedUsers = mergeUsers(localUsers, cloudUsers);
    setUsers(mergedUsers, { skipCloud: true });
    pushCloudCollection("users", mergedUsers).catch(() => {});

    const localTournaments = getTournaments();
    const mergedTournaments = mergeByUpdatedAt(localTournaments, cloudTournaments);
    setTournaments(mergedTournaments, { skipCloud: true });
    pushCloudCollection("tournaments", mergedTournaments).catch(() => {});

    const localParticipants = JSON.parse(localStorage.getItem(REG_KEY) || "[]");
    const mergedParticipants = mergeByUpdatedAt(
      localParticipants.map((p, i) => ({ ...p, id: p.id || `local_${i}` })),
      cloudParticipants
    );
    localStorage.setItem(REG_KEY, JSON.stringify(mergedParticipants));
    pushCloudCollection("participants", mergedParticipants).catch(() => {});
  } catch {
    cloudOnline = false;
  } finally {
    syncInFlight = false;
    updateSyncBadge();
  }
}

function isTournamentAdmin(t) {
  const user = getCurrentUser();
  const ownerMatch = user && (user.id === t.ownerUserId || user.email === t.ownerEmail);
  const localAdmin = localStorage.getItem(`zoltrakk_admin_${t.id}`) === t.adminId;
  return Boolean(ownerMatch || localAdmin);
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

function getParticipants() {
  return JSON.parse(localStorage.getItem(REG_KEY) || "[]");
}

function setParticipants(data) {
  const withIds = data.map((p, i) => ({ ...p, id: p.id || uid() }));
  localStorage.setItem(REG_KEY, JSON.stringify(withIds));
  pushCloudCollection("participants", withIds).catch(() => {});
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
  const nav = document.querySelector("header nav");
  if (!nav) return;

  const user = getCurrentUser();
  const rawPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const page = rawPage === "tournament.html" ? "tournaments.html" : rawPage;

  const mainLinks = [
    ["index.html", "Home"],
    ["schedule.html", "Schedule"],
    ["players.html", "Players"],
    ["tournaments.html", "Browse"],
    ["archive.html", "Archive"],
    ["create.html", "Create"],
    ["team.html", "Teams"],
    ["contact.html", "Support"]
  ];

  const mainHtml = mainLinks
    .map(([href, label]) => `<a href="${href}" class="${page === href ? "active" : ""}">${label}</a>`)
    .join("");

  let authHtml = "";
  if (user) {
    authHtml += `<a href="my-tournaments.html" class="${page === "my-tournaments.html" ? "active" : ""}">My Hub</a>`;
    authHtml += `<a href="#" data-logout>Logout</a>`;
  } else {
    authHtml += `<a href="signup.html" class="${page === "signup.html" ? "active" : ""}">Sign Up</a>`;
    authHtml += `<a href="login.html" class="${page === "login.html" ? "active" : ""}">Login</a>`;
  }

  nav.innerHTML = `<div class="nav-main">${mainHtml}</div><div class="nav-auth">${authHtml}</div>`;
  const logout = nav.querySelector("[data-logout]");
  if (logout) {
    logout.onclick = (e) => {
      e.preventDefault();
      clearCurrentUser();
      location.href = "login.html";
    };
  }
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
  return getParticipants().map((p) => ({
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

  const render = () => {
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
      grid.innerHTML = `<div class="empty-state"><p>No registered players yet. Use the form above to add your first player card with an optional photo.</p></div>`;
      return;
    }

    grid.innerHTML = filtered.map((p) => `
      <div class="flip-wrap"><article class="player-card"><div class="player-card-inner">
      <img src="${p.image}" alt="${esc(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_PLAYER_IMAGE}'">
      <div class="player-meta">
      <h3>${esc(p.name)}${p.rank === "Diamond" ? '<span class="diamond">DIA</span>' : ""}</h3>
      <p>${esc(p.game)}</p><span class="badge">${esc(p.rank)}</span></div></div></article></div>`).join("");
  };

  ["searchPlayer", "filterGame", "filterRank"].forEach((id) => document.getElementById(id)?.addEventListener("input", render));
  render();

  const form = document.getElementById("regForm");
  if (!form) return;
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

  const renderParticipants = () => {
    const all = getParticipants();
    total.textContent = all.length;
    if (!all.length) {
      list.innerHTML = "<li><span>No players registered yet.</span></li>";
      render();
      return;
    }
    list.innerHTML = all.map((p, i) => {
      const thumb = p.image
        ? `<img class="participant-thumb" src="${p.image}" alt="" onerror="this.onerror=null;this.src='${DEFAULT_PLAYER_IMAGE}'">`
        : `<img class="participant-thumb" src="${DEFAULT_PLAYER_IMAGE}" alt="">`;
      return `<li>${thumb}<span>${esc(p.name)} · ${esc(p.game)}${p.rank ? ` · ${esc(p.rank)}` : ""}</span><button data-i="${i}">Remove</button></li>`;
    }).join("");
    list.querySelectorAll("button").forEach((b) => b.onclick = () => {
      const a = getParticipants();
      a.splice(+b.dataset.i, 1);
      setParticipants(a);
      renderParticipants();
    });
    render();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "error";
    const name = document.getElementById("regName").value.trim();
    const game = document.getElementById("regGame").value;
    const rank = document.getElementById("regRank")?.value || "";
    if (!name) return void (msg.textContent = "Player name is required.");
    const all = getParticipants();
    if (all.length >= 10) return void (msg.textContent = "Tournament limit reached (10 players).");
    if (all.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return void (msg.textContent = "A player with this name is already registered.");
    }
    try {
      const image = await readOptionalImage(imageInput);
      all.push({ id: uid(), name, game, rank: rank || "Unranked", image, updatedAt: nowIso() });
      setParticipants(all);
      form.reset();
      if (imagePreview) {
        imagePreview.classList.add("hidden");
        imagePreview.innerHTML = "";
      }
      msg.className = "success";
      msg.textContent = "Player registered successfully.";
      renderParticipants();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  renderParticipants();
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
    bar.style.width = `${score * 20}%`;
    bar.style.background = score <= 2 ? "#dc2626" : score <= 4 ? "#f59e0b" : "#16a34a";
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

    let users = getUsers();
    if (users.some((u) => u.email === em)) return setErr("emailErr", "Account already exists for this email.");
    try {
      const cloudUsers = await fetchCloudCollection("users");
      users = mergeUsers(users, cloudUsers);
      setUsers(users, { skipCloud: true });
      if (users.some((u) => u.email === em)) return setErr("emailErr", "Account already exists for this email.");
    } catch { /* offline - local check is sufficient */ }
    const user = { id: uid(), firstName: f, lastName: l, age: a, email: em, password: p, updatedAt: nowIso() };
    users.push(user);
    setUsers(users);
    setCurrentUser({ id: user.id, name: `${f} ${l}`, email: user.email });
    document.getElementById("signupSuccess").textContent = "Signup successful. Syncing to cloud...";
    try {
      await cloudRegister(user);
      cloudOnline = true;
      updateSyncBadge();
    } catch {
      /* local account still works */
    }
    document.getElementById("signupSuccess").textContent = "Signup successful. Redirecting...";
    setTimeout(() => { location.href = "my-tournaments.html"; }, 650);
  });
}

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  const eye = document.getElementById("eyeBtn");
  const pass = document.getElementById("lPass");

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
    submitBtn.textContent = "Checking...";

    let users = getUsers();
    let user = users.find((u) => u.email === em);

    if (!user) {
      try {
        const cloudUsers = await fetchCloudCollection("users");
        users = mergeUsers(users, cloudUsers);
        setUsers(users, { skipCloud: true });
        user = users.find((u) => u.email === em);
      } catch { /* fallback */ }
    }

    if (!user) {
      status.textContent = "No account found with this email address.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
      return;
    }

    let passwordMatch = user.password === p;
    if (!passwordMatch) {
      try {
        const cloud = await cloudLogin(em, p);
        if (cloud.success && cloud.user) {
          passwordMatch = true;
          cloudOnline = true;
          updateSyncBadge();
        }
      } catch { /* fallback */ }
    }

    if (!passwordMatch) {
      status.textContent = "Incorrect password.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
      return;
    }

    setCurrentUser({ id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email });
    status.className = "success";
    status.textContent = "Login successful. Redirecting...";
    setTimeout(() => { location.href = "my-tournaments.html"; }, 550);
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
    if ((prizeType === "ETH" || prizeAmount) && paymentWallet && !isEthAddress(paymentWallet)) {
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
      settings: { joinApproval: false },
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
      matches: [],
      createdAt: nowIso(),
      completedAt: null
    });

    const all = getTournaments();
    all.push(t);
    setTournaments(all);
    localStorage.setItem(`zoltrakk_admin_${tId}`, adminId);
    form.reset();
    adminInput.value = user.name;
    lineupFields.innerHTML = "";
    hint.textContent = "";
    msg.className = "success";
    const base = `${location.origin}${location.pathname.replace(/\/[^/]*$/, "/")}`;
    const link = `${base}tournament.html?id=${tId}&share=${t.shareToken}`;
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
    let all = getTournaments().filter((t) => !isArchivedTournament(t));
    all = all.filter((t) => {
      const haystack = `${t.tournamentName} ${t.game} ${t.description || ""}`.toLowerCase();
      return haystack.includes(q) && (!game || t.game === game);
    });
    if (sort.value === "popular") all.sort((a, b) => participantTotal(b) - participantTotal(a));
    else if (sort.value === "upcoming") all.sort((a, b) => new Date(a.startsAt || a.createdAt) - new Date(b.startsAt || b.createdAt));
    else if (sort.value === "active") all.sort((a, b) => Number((b.status || "") === "active") - Number((a.status || "") === "active"));
    else all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!all.length) {
      card.innerHTML = `<div class="empty-state"><p>No active tournaments match this view.</p><a class="btn" href="create.html">Create Tournament</a></div>`;
      return;
    }
    card.innerHTML = all.map((t) => tournamentCardHtml(t)).join("");
    bindTournamentCardCopies(card);
  };

  [search, gameFilter, sort].forEach((el) => el.addEventListener("input", render));
  render();
}

function tournamentCardHtml(t) {
  const link = `tournament.html?id=${t.id}&share=${t.shareToken || ""}`;
  const teamCount = t.teams?.length || 0;
  const matchCount = t.matches?.length || 0;
  return `<article class="tournament-card card">
    <img class="tournament-banner" src="${tournamentBanner(t)}" alt="${esc(t.game)} tournament banner" loading="lazy">
    <div class="tournament-card-body">
      <h3>${esc(t.tournamentName)} <span class="muted-game">(${esc(t.game)})</span></h3>
      <p>${esc(t.description || "Create teams, schedule matches, submit results, and compete for the top spot.")}</p>
      <div class="tournament-meta">
        <span class="tag status-${esc(t.status || "upcoming")}">${statusLabel(t.status)}</span>
        <span class="tag">${teamCount} teams</span>
        <span class="tag">${participantTotal(t)} players</span>
        <span class="tag">${matchCount} matches</span>
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

function saveTournament(t) {
  touchTournament(t);
  const arr = getTournaments();
  const idx = arr.findIndex((x) => x.id === t.id);
  if (idx >= 0) arr[idx] = t;
  else arr.push(t);
  setTournaments(arr);
}

function initTournamentDetailPage() {
  const root = document.getElementById("tournamentDetailRoot");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const all = getTournaments();
  const t = all.find((x) => x.id === id);
  if (!t) {
    root.innerHTML = `<div class="card" style="padding:20px">
      <p>Tournament not found on this device yet.</p>
      <p>Ask the host for the share link, or wait a moment and <button class="btn alt" type="button" id="retryTournamentLoad">Refresh</button> after cloud sync.</p>
      <a class="btn" href="tournaments.html">Browse Tournaments</a></div>`;
    document.getElementById("retryTournamentLoad")?.addEventListener("click", async () => {
      await syncAllFromCloud();
      location.reload();
    });
    return;
  }
  const isAdmin = isTournamentAdmin(t);
  t.teams = t.teams || [];
  t.matches = (t.matches || []).map((m, i) => normalizeMatch(m, i));
  t.removedPlayers = t.removedPlayers || [];
  t.joinRequests = t.joinRequests || [];
  t.settings = t.settings || { joinApproval: false };
  t.shareToken = t.shareToken || uid();
  t.paidEntry = t.paidEntry || { enabled: false, entryFeeEth: "", verificationRequired: false };
  t.prize = t.prize || { verificationStatus: "none", claims: [], winnerConfirmed: false };
  saveTournament(t);

  root.innerHTML = `
    <div class="card" style="padding:16px;margin-bottom:14px">
      <img class="detail-banner" src="${tournamentBanner(t)}" alt="${esc(t.game)} banner">
      <h2>${esc(t.tournamentName)}</h2>
      <p>${esc(t.game)} - Admin: ${esc(t.adminName)} - <span class="tag status-${esc(t.status || "upcoming")}">${statusLabel(t.status)}</span> ${prizeBadge(t)} ${paidEntrySummary(t)}</p>
      ${t.description ? `<p>${esc(t.description)}</p>` : ""}
      ${t.startsAt ? `<p><strong>Starts:</strong> ${esc(t.startsAt.replace("T", " "))}</p>` : ""}
      ${t.rules ? `<div class="rules-box"><strong>Rules</strong><p>${esc(t.rules)}</p></div>` : ""}
      <div class="rules-box"><strong>Safe Share Link</strong><p id="shareUrl">${safeShareUrl(t)}</p><p class="hint-text">This link only opens the public tournament page. Admin controls stay protected by creator login or this browser's private admin key.</p></div>
      <a class="btn alt" href="schedule.html?tournament=${t.id}">Open Schedule</a>
      <button class="btn alt" id="copyTournamentLink">Copy Link</button>
      ${isAdmin ? `<select id="statusSelect" class="inline-select"><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button class="btn" id="saveStatusBtn">Update Status</button>` : ""}
    </div>
    ${isAdmin ? `<div class="card" style="padding:16px;margin-bottom:14px">
      <h3>Edit Tournament</h3>
      <div class="form-grid">
        <div><label>Name</label><input id="editName" value="${esc(t.tournamentName)}"></div>
        <div><label>Date & Time</label><input id="editStartsAt" type="datetime-local" value="${esc(t.startsAt || "")}"></div>
      </div>
      <div class="form-grid">
        <div><label>Game</label><select id="editGame"><option>League of Legends</option><option>Valorant</option><option>CS2</option><option>Overwatch</option></select></div>
        <div><label>Player Limit</label><input id="editPlayerLimit" type="number" min="2" max="256" value="${esc(t.playerLimit || 32)}"></div>
      </div>
      <label>Description</label><textarea id="editDescription" rows="3">${esc(t.description)}</textarea>
      <label>Rules</label><textarea id="editRules" rows="3">${esc(t.rules)}</textarea>
      <div class="form-grid">
        <div><label>Banner Image</label><input id="editBanner" type="file" accept="image/*"></div>
        <div><label>Join Approval</label><select id="editApproval"><option value="false">Open joining</option><option value="true">Approval required</option></select></div>
      </div>
      <div class="form-grid">
        <div><label>Paid Entry</label><select id="editPaidEntry"><option value="false">Free to join</option><option value="true">Require MetaMask payment</option></select></div>
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
      <button class="btn" id="saveTournamentEdit">Save Changes</button>
      ${t.prize?.type === "ETH" && t.prize?.amount ? `<button class="btn alt" id="fundPrizeBtn">Fund Prize with MetaMask</button>` : ""}
      ${t.prize?.fundingTx && t.prize?.verificationStatus !== "verified" ? `<button class="btn alt" id="verifyPrizeBtn">Mark Prize Verified</button>` : ""}
      ${t.prize?.verificationStatus === "verified" ? `<button class="btn alt" id="confirmWinnersBtn">Confirm Winners</button>` : ""}
      ${t.prize?.fundingTx ? `<p class="success">Prize funding recorded: ${esc(t.prize.fundingTx.txHash)}</p>` : ""}
      <p id="editMsg" class="error"></p>
    </div>` : ""}
    <div class="card" style="padding:16px;margin-bottom:14px">
      <h3>Join Tournament</h3>
      ${t.paidEntry.enabled ? `<div class="rules-box"><strong>Paid Entry Required</strong><p>${esc(t.paidEntry.entryFeeEth)} ETH must be approved in MetaMask before a team is added. Payments go to ${esc(t.paymentWallet)} and the transaction hash is saved with the join record.</p></div>` : ""}
      <div class="rules-box"><strong>Wallet & Privacy Safety</strong><p>Zoltrakk never asks for seed phrases, private keys, or wallet passwords. Share links are public viewer links, while admin actions require the creator account or local admin key.</p></div>
      <div class="form-grid">
        <div><label>Your Name</label><input id="joinerName"></div>
        <div><label>Choose</label><select id="joinMode"><option value="create">Create Team</option><option value="join">Join Existing Team</option></select></div>
      </div>
      <div id="joinDynamic"></div>
      <button class="btn" id="joinBtn">Submit</button>
      <p class="error" id="joinMsg"></p>
    </div>
    ${isAdmin ? `<div class="card" style="padding:16px;margin-bottom:14px">
      <h3>Join Requests</h3>
      <div id="joinRequestsList"></div>
    </div>` : ""}
    <div class="card" style="padding:16px;margin-bottom:14px">
      <h3>Teams (${t.teams.length})</h3>
      <div id="teamsList"></div>
    </div>
    <div class="card" style="padding:16px">
      <h3>Matches</h3>
      ${isAdmin ? `<button class="btn" id="autoMatchBtn">Auto Generate Matches</button>
      <div class="form-grid" style="margin-top:10px">
        <div><select id="manualA"></select></div><div><select id="manualB"></select></div>
      </div><button class="btn alt" id="manualMatchBtn">Add Manual Match</button>
      <p style="margin-top:10px;color:var(--muted);font-size:.9rem">Edit full schedule (dates, stages, winners) on the <a href="schedule.html?tournament=${t.id}">Schedule page</a>.</p>` : ""}
      <div id="matchesList" style="margin-top:10px"></div>
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
  if (document.getElementById("markCompletedBtn")) {
    document.getElementById("markCompletedBtn").onclick = () => {
      t.status = "completed";
      t.completedAt = nowIso();
      saveTournament(t);
      location.reload();
    };
  }
  if (isAdmin) {
    document.getElementById("statusSelect").value = t.status || "upcoming";
    document.getElementById("saveStatusBtn").onclick = () => {
      t.status = document.getElementById("statusSelect").value;
      if (t.status === "completed") t.completedAt = nowIso();
      saveTournament(t);
      location.reload();
    };
    document.getElementById("editGame").value = t.game;
    document.getElementById("editApproval").value = String(Boolean(t.settings.joinApproval));
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
        saveTournament(t);
        editMsg.className = "success";
        editMsg.textContent = "Prize transaction recorded. Review and verify it before advertising this as a rewarded event.";
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        editMsg.textContent = err.message || "MetaMask transaction failed.";
      }
    });
    document.getElementById("verifyPrizeBtn")?.addEventListener("click", () => {
      t.prize.verificationStatus = "verified";
      saveTournament(t);
      location.reload();
    });
    document.getElementById("confirmWinnersBtn")?.addEventListener("click", () => {
      t.prize.winnerConfirmed = true;
      t.prize.claims = completedWinners(t).map((winner) => ({
        winner,
        status: "ready-to-claim",
        confirmedAt: nowIso()
      }));
      saveTournament(t);
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
        t.settings.joinApproval = document.getElementById("editApproval").value === "true";
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
        saveTournament(t);
        editMsg.className = "success";
        editMsg.textContent = "Tournament updated.";
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        editMsg.textContent = err.message;
      }
    };
  }

  const joinDynamic = document.getElementById("joinDynamic");
  const renderJoinDynamic = () => {
    if (document.getElementById("joinMode").value === "create") {
      joinDynamic.innerHTML = `<label>Team Name</label><input id="newTeamName" placeholder="Team Rockets">`;
    } else {
      joinDynamic.innerHTML = `<label>Select Team</label><select id="existingTeamSel">${t.teams.map((tm) => `<option value="${tm.id}">${esc(tm.name)}</option>`).join("")}</select>`;
    }
  };
  renderJoinDynamic();
  document.getElementById("joinMode").onchange = renderJoinDynamic;

  const renderTeams = () => {
    const list = document.getElementById("teamsList");
    list.innerHTML = t.teams.length ? t.teams.map((tm, idx) => `
      <article class="card" style="padding:10px;margin-bottom:8px">
      <strong>${idx + 1}. ${esc(tm.name)}</strong>
      <ul>${tm.members.map((m, memberIdx) => `<li>${esc(m.name)}${m.role ? ` - ${esc(m.role)}` : ""} ${m.paymentTx ? `<span class="tag verified">Paid</span>` : ""} ${isAdmin && m.paymentTx ? `<span class="hint-text">${esc(m.paymentTx)}</span>` : ""} ${isAdmin ? `<button class="mini-danger" data-remove-member="${tm.id}" data-member="${memberIdx}">Remove</button>` : ""}</li>`).join("")}</ul>
      ${isAdmin ? `<button class="btn alt" data-del="${tm.id}">Delete</button>
      <button class="btn alt" data-up="${tm.id}">Move Up</button>
      <button class="btn alt" data-down="${tm.id}">Move Down</button>` : ""}
      </article>`).join("") : "<p>No teams yet.</p>";
    if (isAdmin) {
      list.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { t.teams = t.teams.filter((x) => x.id !== b.dataset.del); saveTournament(t); renderAll(); });
      list.querySelectorAll("[data-remove-member]").forEach((b) => b.onclick = () => {
        const team = t.teams.find((x) => x.id === b.dataset.removeMember);
        const member = team?.members?.[Number(b.dataset.member)];
        if (!team || !member) return;
        t.removedPlayers.push({ name: member.name.toLowerCase(), removedAt: nowIso(), approvedAgain: false });
        team.members.splice(Number(b.dataset.member), 1);
        saveTournament(t);
        renderAll();
      });
      list.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => {
        const i = t.teams.findIndex((x) => x.id === b.dataset.up);
        if (i > 0) [t.teams[i - 1], t.teams[i]] = [t.teams[i], t.teams[i - 1]];
        saveTournament(t);
        renderAll();
      });
      list.querySelectorAll("[data-down]").forEach((b) => b.onclick = () => {
        const i = t.teams.findIndex((x) => x.id === b.dataset.down);
        if (i < t.teams.length - 1) [t.teams[i + 1], t.teams[i]] = [t.teams[i], t.teams[i + 1]];
        saveTournament(t);
        renderAll();
      });
    }
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
    list.querySelectorAll("[data-approve-request]").forEach((b) => b.onclick = () => {
      const req = t.joinRequests.find((r) => r.id === b.dataset.approveRequest);
      if (!req) return;
      req.status = "approved";
      applyJoin(req);
      t.removedPlayers = t.removedPlayers.filter((p) => p.name !== req.name.toLowerCase());
      saveTournament(t);
      renderAll();
    });
    list.querySelectorAll("[data-deny-request]").forEach((b) => b.onclick = () => {
      const req = t.joinRequests.find((r) => r.id === b.dataset.denyRequest);
      if (!req) return;
      req.status = "denied";
      saveTournament(t);
      renderAll();
    });
  };

  const renderAll = () => { renderJoinDynamic(); renderTeams(); renderMatches(); renderJoinRequests(); };
  renderAll();

  const applyJoin = (join) => {
    const paymentMeta = join.payment ? { walletAddress: join.walletAddress, paymentTx: join.payment.txHash, paymentStatus: join.paymentStatus } : {};
    if (join.mode === "create") {
      t.teams.push({ id: uid(), name: join.teamName, members: [{ name: join.name, role: "Captain", ...paymentMeta }] });
    } else {
      const team = t.teams.find((x) => x.id === join.teamId);
      if (team) team.members.push({ name: join.name, role: "Member", ...paymentMeta });
    }
  };

  document.getElementById("joinBtn").onclick = async () => {
    if (isArchivedTournament(t)) return;
    const msg = document.getElementById("joinMsg");
    const joinBtn = document.getElementById("joinBtn");
    msg.textContent = "";
    msg.className = "error";
    const name = (document.getElementById("joinerName").value || "").trim();
    if (!name) return void (msg.textContent = "Enter your name.");
    if (participantTotal(t) >= (t.playerLimit || 32)) return void (msg.textContent = "Player limit reached.");
    const blocked = t.removedPlayers.some((p) => p.name === name.toLowerCase());
    if (blocked) return void (msg.textContent = "This player was removed and needs admin approval before rejoining.");
    const join = { id: uid(), name, mode: document.getElementById("joinMode").value, status: "pending", createdAt: nowIso() };
    if (join.mode === "create") {
      const tn = (document.getElementById("newTeamName").value || "").trim();
      if (!tn) return void (msg.textContent = "Enter team name.");
      if (t.teams.some((x) => x.name.toLowerCase() === tn.toLowerCase())) return void (msg.textContent = "Team name already exists.");
      join.teamName = tn;
    } else {
      const team = t.teams.find((x) => x.id === document.getElementById("existingTeamSel").value);
      if (!team) return void (msg.textContent = "No team selected.");
      if (team.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return void (msg.textContent = "You are already in this team.");
      join.teamId = team.id;
      join.teamName = team.name;
    }
    if (t.paidEntry.enabled) {
      try {
        joinBtn.disabled = true;
        joinBtn.textContent = "Waiting for MetaMask...";
        msg.textContent = "Approve the entry fee in MetaMask to add your team.";
        join.payment = await sendEthWithMetaMask({ to: t.paymentWallet, amountEth: t.paidEntry.entryFeeEth });
        join.walletAddress = join.payment.from;
        join.paymentStatus = "verified-by-wallet";
      } catch (err) {
        msg.textContent = err.message || "Payment was not completed.";
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
      saveTournament(t);
      renderAll();
      msg.className = "success";
      msg.textContent = "Join request sent for admin approval.";
      return;
    }
    join.status = "approved";
    applyJoin(join);
    saveTournament(t);
    renderAll();
    msg.className = "success";
    msg.textContent = "Joined successfully.";
  };

  if (isAdmin) {
    document.getElementById("autoMatchBtn").onclick = () => {
      t.matches = [];
      for (let i = 0; i < t.teams.length - 1; i += 2) {
        t.matches.push(normalizeMatch({ a: t.teams[i].name, b: t.teams[i + 1].name, mode: "auto" }, t.matches.length));
      }
      saveTournament(t);
      renderAll();
    };
    document.getElementById("manualMatchBtn").onclick = () => {
      const a = t.teams.find((x) => x.id === document.getElementById("manualA").value);
      const b = t.teams.find((x) => x.id === document.getElementById("manualB").value);
      if (!a || !b || a.id === b.id) return;
      t.matches.push(normalizeMatch({ a: a.name, b: b.name, mode: "manual" }, t.matches.length));
      saveTournament(t);
      renderAll();
    };
  }
}

function initSchedulePage() {
  const root = document.getElementById("scheduleRoot");
  if (!root) return;

  const tournaments = getTournaments().filter((t) => (t.matches || []).length > 0 || (t.teams || []).length > 0);
  const preselect = new URLSearchParams(location.search).get("tournament") || "";

  const render = () => {
    const selectedId = document.getElementById("scheduleTournamentSelect")?.value || "all";
    const list = selectedId === "all" ? tournaments : tournaments.filter((t) => t.id === selectedId);

    if (!tournaments.length) {
      root.innerHTML = `<div class="card" style="padding:20px"><p>No tournament schedules yet. <a href="create.html">Create a tournament</a>, add teams, then generate matches.</p></div>`;
      return;
    }

    const rows = [];
    const bracket = [];
    list.forEach((t) => {
      const isAdmin = isTournamentAdmin(t);
      (t.matches || []).forEach((raw, i) => {
        const m = normalizeMatch(raw, i);
        rows.push({ t, m, isAdmin });
        bracket.push({ t, m });
      });
    });

    if (!rows.length) {
      root.innerHTML = `
        <div class="schedule-toolbar card" style="padding:16px">${buildToolbar()}</div>
        <div class="card" style="padding:20px;margin-top:14px"><p>Selected tournament has no matches yet. Open the tournament and use Auto Generate Matches or Add Manual Match.</p></div>`;
      bindToolbar();
      return;
    }

    root.innerHTML = `
      <div class="schedule-toolbar card" style="padding:16px">${buildToolbar()}</div>
      <div class="table-wrap card" style="margin-top:14px">
        <table>
          <tr><th>Tournament</th><th>Date</th><th>Stage</th><th>Match</th><th>Time</th><th>Status</th><th>Winner</th>${rows.some((r) => r.isAdmin) ? "<th>Edit</th>" : ""}</tr>
          ${rows.map(({ t, m, isAdmin }) => `
            <tr class="${m.stage === "Grand Final" ? "final-match" : ""}">
              <td>${esc(t.tournamentName)}</td>
              <td>${esc(m.date || "TBD")}</td>
              <td>${esc(m.stage)}</td>
              <td>${esc(m.a)} vs ${esc(m.b)}</td>
              <td>${esc(m.time || "TBD")}</td>
              <td><span class="match-status ${esc(m.status)}">${esc(m.status)}</span></td>
              <td>${esc(m.winner || "—")}</td>
              ${isAdmin ? `<td><a class="btn alt" href="#edit-${m.id}">Edit</a></td>` : ""}
            </tr>
            ${isAdmin ? `<tr id="edit-${m.id}"><td colspan="8">
              <div class="match-edit-row" data-match-id="${m.id}" data-tournament-id="${t.id}">
                <div><label>Date</label><input data-field="date" value="${esc(m.date)}"></div>
                <div><label>Time</label><input data-field="time" value="${esc(m.time)}"></div>
                <div><label>Stage</label><select data-field="stage">
                  <option ${m.stage === "Qualifier" ? "selected" : ""}>Qualifier</option>
                  <option ${m.stage === "Semi Final" ? "selected" : ""}>Semi Final</option>
                  <option ${m.stage === "Grand Final" ? "selected" : ""}>Grand Final</option>
                </select></div>
                <div><label>Status</label><select data-field="status">
                  <option value="scheduled" ${m.status === "scheduled" ? "selected" : ""}>scheduled</option>
                  <option value="completed" ${m.status === "completed" ? "selected" : ""}>completed</option>
                </select></div>
                <div><label>Winner</label><select data-field="winner">
                  <option value="">—</option>
                  <option value="${esc(m.a)}" ${m.winner === m.a ? "selected" : ""}>${esc(m.a)}</option>
                  <option value="${esc(m.b)}" ${m.winner === m.b ? "selected" : ""}>${esc(m.b)}</option>
                </select></div>
                <div><button class="btn" data-save-match>Save Match</button></div>
              </div>
            </td></tr>` : ""}
          `).join("")}
        </table>
      </div>
      <h3 style="margin-top:24px">Bracket Overview</h3>
      <div class="bracket-grid">
        ${bracket.map(({ t, m }) => `
          <article class="bracket-card ${m.stage === "Grand Final" ? "final" : ""}">
            <p class="tag">${esc(t.tournamentName)}</p>
            <h3>${esc(m.a)} vs ${esc(m.b)}</h3>
            <p>${esc(m.stage)} · ${esc(m.date || "TBD")} ${esc(m.time || "")}</p>
            <span class="match-status ${esc(m.status)}">${esc(m.status)}</span>
          </article>`).join("")}
      </div>`;

    bindToolbar();
    root.querySelectorAll("[data-save-match]").forEach((btn) => {
      btn.onclick = () => {
        const row = btn.closest("[data-match-id]");
        const matchId = row.dataset.matchId;
        const tournamentId = row.dataset.tournamentId;
        const all = getTournaments();
        const t = all.find((x) => x.id === tournamentId);
        if (!t || !isTournamentAdmin(t)) return;
        const match = t.matches.find((x) => (x.id || "") === matchId);
        if (!match) return;
        row.querySelectorAll("[data-field]").forEach((el) => { match[el.dataset.field] = el.value; });
        saveTournament(t);
        render();
      };
    });
  };

  function buildToolbar() {
    const options = tournaments.map((t) =>
      `<option value="${t.id}" ${t.id === preselect ? "selected" : ""}>${esc(t.tournamentName)} (${t.matches?.length || 0} matches)</option>`
    ).join("");
    return `
      <div><label>Filter tournament</label>
        <select id="scheduleTournamentSelect">
          <option value="all">All tournaments</option>
          ${options}
        </select>
      </div>
      <div><a class="btn" href="tournaments.html">Browse Tournaments</a></div>`;
  }

  function bindToolbar() {
    document.getElementById("scheduleTournamentSelect")?.addEventListener("change", render);
  }

  render();
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
    b.onclick = () => {
      const updated = getTournaments().filter((t) => t.id !== b.dataset.deleteHistory);
      setTournaments(updated);
      initMyTournamentsPage();
    };
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

function initContactPage() {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("contactStatus");
  if (!form || !status) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    status.textContent = "Thanks. Your support message has been received.";
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initChatbot();
  await syncAllFromCloud();
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
});
