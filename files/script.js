const THEME_KEY = "zoltrakk_theme";
const REG_KEY = "tournament_participants";
const TOURNAMENTS_KEY = "zoltrakk_tournaments_v2";
const USERS_KEY = "zoltrakk_users";
const CURRENT_USER_KEY = "zoltrakk_current_user";

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
function setUsers(v) { localStorage.setItem(USERS_KEY, JSON.stringify(v)); }
function getCurrentUser() { return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null"); }
function setCurrentUser(v) { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(v)); }
function clearCurrentUser() { localStorage.removeItem(CURRENT_USER_KEY); }
function getTournaments() { return JSON.parse(localStorage.getItem(TOURNAMENTS_KEY) || "[]"); }
function setTournaments(v) { localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(v)); }

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
    <button class="chatbot-toggle" id="chatbotToggle">AI</button>
    <div class="chatbot-box" id="chatbotBox">
      <div class="chatbot-head">
        <span>Zoltrakk Helper</span>
        <button id="chatbotClose">x</button>
      </div>
      <div class="chatbot-messages" id="chatMessages">
        <div class="chat-msg bot">Welcome to Zoltrakk Arena. I can guide you with tournament creation, joining, and admin tools.</div>
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
    admin: "Creator can delete teams, reorder teams, auto-match, and add manual matches.",
    login: "Signup first, then login. My Tournaments opens when you are logged in.",
    games: "Supported games: League of Legends, Valorant, CS2, Overwatch.",
    contact: "Use Contact page for support and location details.",
    default: "Try: how to create tournament, how to join team, admin powers, supported games."
  };

  const toggle = document.getElementById("chatbotToggle");
  const box = document.getElementById("chatbotBox");
  const close = document.getElementById("chatbotClose");
  const send = document.getElementById("chatSend");
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");

  const reply = (q) => {
    const text = q.toLowerCase();
    if (text.includes("join")) return bot.join;
    if (text.includes("create")) return bot.create;
    if (text.includes("admin")) return bot.admin;
    if (text.includes("login") || text.includes("sign")) return bot.login;
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
  const links = [
    ["index.html", "Home"],
    ["schedule.html", "Schedule"],
    ["players.html", "Players"],
    ["tournaments.html", "Tournaments"],
    ["create.html", "Create"],
    ["team.html", "Team"],
    ["my-tournaments.html", "My Tournaments"],
    ["contact.html", "Support"]
  ];

  let html = links
    .map(([href, label]) => `<a href="${href}" class="${page === href ? "active" : ""}">${label}</a>`)
    .join("");

  html += `<a href="signup.html" class="${page === "signup.html" ? "active" : ""}">Sign Up</a>`;
  html += `<a href="login.html" class="${page === "login.html" ? "active" : ""}">Login</a>`;
  if (user) html += `<a href="#" data-logout>Logout</a>`;

  nav.innerHTML = html;
  const logout = nav.querySelector("[data-logout]");
  if (logout) {
    logout.onclick = (e) => {
      e.preventDefault();
      clearCurrentUser();
      location.href = "login.html";
    };
  }
}

function getRoleTemplate(game) {
  if (game === "League of Legends") return ["Top", "Jungle", "Mid", "ADC", "Support"];
  if (game === "Valorant") return ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"];
  if (game === "Overwatch") return ["Tank", "Damage", "Damage", "Support", "Support"];
  if (game === "CS2") return ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"];
  return [];
}

async function initPlayersPage() {
  const grid = document.getElementById("playerGrid");
  if (!grid) return;
  let players = [];
  try {
    const apiRes = await fetch("/.netlify/functions/players");
    const apiData = await apiRes.json();
    players = apiData.data || [];
  } catch {
    const fallbackRes = await fetch("data.json");
    const fallbackData = await fallbackRes.json();
    players = fallbackData.players || [];
  }

  const render = () => {
    const q = (document.getElementById("searchPlayer")?.value || "").toLowerCase();
    const game = document.getElementById("filterGame")?.value || "";
    const rank = document.getElementById("filterRank")?.value || "";
    let filtered = players.filter((p) => p.name.toLowerCase().includes(q) && (!game || p.game === game) && (!rank || p.rank === rank));
    const rankOrder = { Diamond: 1, Platinum: 2, Gold: 3, Silver: 4 };
    if (rank) filtered = filtered.sort((a, b) => (rankOrder[a.rank] || 99) - (rankOrder[b.rank] || 99));
    grid.innerHTML = filtered.map((p) => `
      <div class="flip-wrap"><article class="player-card"><div class="player-card-inner">
      <img src="${p.image}" alt="${esc(p.name)}"><div class="player-meta">
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
  const getParticipants = () => JSON.parse(localStorage.getItem(REG_KEY) || "[]");
  const setParticipants = (d) => localStorage.setItem(REG_KEY, JSON.stringify(d));

  const renderParticipants = () => {
    const all = getParticipants();
    total.textContent = all.length;
    list.innerHTML = all.map((p, i) => `<li><span>${esc(p.name)} (${esc(p.game)})</span><button data-i="${i}">Remove</button></li>`).join("");
    list.querySelectorAll("button").forEach((b) => b.onclick = () => {
      const a = getParticipants();
      a.splice(+b.dataset.i, 1);
      setParticipants(a);
      renderParticipants();
    });
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    msg.textContent = "";
    const all = getParticipants();
    if (all.length >= 10) return void (msg.textContent = "Tournament limit reached (10 players).");
    all.push({ name: document.getElementById("regName").value.trim(), game: document.getElementById("regGame").value });
    setParticipants(all);
    form.reset();
    renderParticipants();
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

  form.addEventListener("submit", (e) => {
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

    const users = getUsers();
    if (users.some((u) => u.email === em)) return setErr("emailErr", "Account already exists for this email.");
    const user = { id: uid(), firstName: f, lastName: l, age: a, email: em, password: p };
    users.push(user);
    setUsers(users);
    setCurrentUser({ id: user.id, name: `${f} ${l}`, email: user.email });
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

  form.addEventListener("submit", (e) => {
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
    const user = getUsers().find((u) => u.email === em && u.password === p);
    if (!user) return void (document.getElementById("loginStatus").textContent = "Invalid email or password.");
    setCurrentUser({ id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email });
    document.getElementById("loginStatus").className = "success";
    document.getElementById("loginStatus").textContent = "Login successful. Redirecting...";
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
    form.innerHTML = '<p class="error">You must login first to create tournaments.</p><a class="btn" href="login.html">Go to Login</a>';
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

  form.addEventListener("submit", (e) => {
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

    const t = {
      id: tId,
      tournamentName,
      game,
      adminName: user.name,
      adminId,
      ownerUserId: user.id,
      ownerEmail: user.email,
      status: "active",
      teams: firstTeamReady ? [{ id: uid(), name: `${user.name} Team`, members: names.map((n, i) => ({ name: n, role: roles[i] })) }] : [],
      matches: [],
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    const all = getTournaments();
    all.push(t);
    setTournaments(all);
    localStorage.setItem(`zoltrakk_admin_${tId}`, adminId);
    form.reset();
    adminInput.value = user.name;
    lineupFields.innerHTML = "";
    hint.textContent = "";
    msg.className = "success";
    const link = `${location.origin}${location.pathname.replace(/\/[^/]*$/, "/")}tournament.html?id=${tId}`;
    msg.innerHTML = `Tournament created. Share this link: <a href="${link}">${link}</a>`;
  });
}

function initTournamentsPage() {
  const card = document.querySelector("[data-created-tournaments]");
  if (!card) return;
  const all = getTournaments();
  if (!all.length) return void (card.innerHTML = "<p>No tournaments yet. Create one now.</p>");
  card.innerHTML = all.map((t) => {
    const link = `tournament.html?id=${t.id}`;
    return `<article class="card" style="padding:14px;margin-bottom:12px">
      <h3 style="margin:0 0 4px">${esc(t.tournamentName)}</h3>
      <p style="margin:0 0 8px">${esc(t.game)} - ${esc(t.status)}</p>
      <a class="btn" href="${link}">Open Tournament</a>
      <button class="btn alt" data-copy="${link}">Copy Share Link</button>
    </article>`;
  }).join("");
  card.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
    const abs = `${location.origin}${location.pathname.replace(/\/[^/]*$/, "/")}${b.dataset.copy}`;
    try { await navigator.clipboard.writeText(abs); b.textContent = "Copied"; } catch { b.textContent = abs; }
  });
}

function initTournamentDetailPage() {
  const root = document.getElementById("tournamentDetailRoot");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const all = getTournaments();
  const t = all.find((x) => x.id === id);
  if (!t) return void (root.innerHTML = "<p>Tournament not found.</p>");
  const isAdmin = localStorage.getItem(`zoltrakk_admin_${id}`) === t.adminId;

  root.innerHTML = `
    <div class="card" style="padding:16px;margin-bottom:14px">
      <h2>${esc(t.tournamentName)}</h2>
      <p>${esc(t.game)} - Admin: ${esc(t.adminName)} - Status: ${esc(t.status)}</p>
      <p><strong>Share Link:</strong> <span id="shareUrl">${location.href}</span></p>
      <button class="btn alt" id="copyTournamentLink">Copy Link</button>
      ${isAdmin && t.status !== "completed" ? '<button class="btn" id="markCompletedBtn">Mark Completed</button>' : ""}
    </div>
    <div class="card" style="padding:16px;margin-bottom:14px">
      <h3>Join Tournament</h3>
      <div class="form-grid">
        <div><label>Your Name</label><input id="joinerName"></div>
        <div><label>Choose</label><select id="joinMode"><option value="create">Create Team</option><option value="join">Join Existing Team</option></select></div>
      </div>
      <div id="joinDynamic"></div>
      <button class="btn" id="joinBtn">Submit</button>
      <p class="error" id="joinMsg"></p>
    </div>
    <div class="card" style="padding:16px;margin-bottom:14px">
      <h3>Teams</h3>
      <div id="teamsList"></div>
    </div>
    <div class="card" style="padding:16px">
      <h3>Matches</h3>
      ${isAdmin ? `<button class="btn" id="autoMatchBtn">Auto Generate Matches</button>
      <div class="form-grid" style="margin-top:10px">
        <div><select id="manualA"></select></div><div><select id="manualB"></select></div>
      </div><button class="btn alt" id="manualMatchBtn">Add Manual Match</button>` : ""}
      <div id="matchesList" style="margin-top:10px"></div>
    </div>
  `;

  const save = () => {
    const arr = getTournaments();
    const idx = arr.findIndex((x) => x.id === t.id);
    arr[idx] = t;
    setTournaments(arr);
  };

  document.getElementById("copyTournamentLink").onclick = async () => { try { await navigator.clipboard.writeText(location.href); } catch {} };
  if (document.getElementById("markCompletedBtn")) {
    document.getElementById("markCompletedBtn").onclick = () => {
      t.status = "completed";
      t.completedAt = new Date().toISOString();
      save();
      location.reload();
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
      <ul>${tm.members.map((m) => `<li>${esc(m.name)}${m.role ? ` - ${esc(m.role)}` : ""}</li>`).join("")}</ul>
      ${isAdmin ? `<button class="btn alt" data-del="${tm.id}">Delete</button>
      <button class="btn alt" data-up="${tm.id}">Move Up</button>
      <button class="btn alt" data-down="${tm.id}">Move Down</button>` : ""}
      </article>`).join("") : "<p>No teams yet.</p>";
    if (isAdmin) {
      list.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { t.teams = t.teams.filter((x) => x.id !== b.dataset.del); save(); renderAll(); });
      list.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => {
        const i = t.teams.findIndex((x) => x.id === b.dataset.up);
        if (i > 0) [t.teams[i - 1], t.teams[i]] = [t.teams[i], t.teams[i - 1]];
        save();
        renderAll();
      });
      list.querySelectorAll("[data-down]").forEach((b) => b.onclick = () => {
        const i = t.teams.findIndex((x) => x.id === b.dataset.down);
        if (i < t.teams.length - 1) [t.teams[i + 1], t.teams[i]] = [t.teams[i], t.teams[i + 1]];
        save();
        renderAll();
      });
    }
  };

  const renderMatches = () => {
    const ml = document.getElementById("matchesList");
    ml.innerHTML = t.matches.length ? t.matches.map((m, i) => `<p>Match ${i + 1}: ${esc(m.a)} vs ${esc(m.b)} ${m.mode === "manual" ? "(manual)" : "(auto)"}</p>`).join("") : "<p>No matches yet.</p>";
    if (isAdmin) {
      const opts = t.teams.map((tm) => `<option value="${tm.id}">${esc(tm.name)}</option>`).join("");
      document.getElementById("manualA").innerHTML = opts;
      document.getElementById("manualB").innerHTML = opts;
    }
  };

  const renderAll = () => { renderJoinDynamic(); renderTeams(); renderMatches(); };
  renderAll();

  document.getElementById("joinBtn").onclick = () => {
    if (t.status === "completed") return;
    const msg = document.getElementById("joinMsg");
    msg.textContent = "";
    const name = (document.getElementById("joinerName").value || "").trim();
    if (!name) return void (msg.textContent = "Enter your name.");
    if (document.getElementById("joinMode").value === "create") {
      const tn = (document.getElementById("newTeamName").value || "").trim();
      if (!tn) return void (msg.textContent = "Enter team name.");
      if (t.teams.some((x) => x.name.toLowerCase() === tn.toLowerCase())) return void (msg.textContent = "Team name already exists.");
      t.teams.push({ id: uid(), name: tn, members: [{ name, role: "Captain" }] });
    } else {
      const team = t.teams.find((x) => x.id === document.getElementById("existingTeamSel").value);
      if (!team) return void (msg.textContent = "No team selected.");
      if (team.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return void (msg.textContent = "You are already in this team.");
      team.members.push({ name, role: "Member" });
    }
    save();
    renderAll();
    msg.className = "success";
    msg.textContent = "Joined successfully.";
  };

  if (isAdmin) {
    document.getElementById("autoMatchBtn").onclick = () => {
      t.matches = [];
      for (let i = 0; i < t.teams.length - 1; i += 2) t.matches.push({ a: t.teams[i].name, b: t.teams[i + 1].name, mode: "auto" });
      save();
      renderAll();
    };
    document.getElementById("manualMatchBtn").onclick = () => {
      const a = t.teams.find((x) => x.id === document.getElementById("manualA").value);
      const b = t.teams.find((x) => x.id === document.getElementById("manualB").value);
      if (!a || !b || a.id === b.id) return;
      t.matches.push({ a: a.name, b: b.name, mode: "manual" });
      save();
      renderAll();
    };
  }
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
      <p>${esc(t.game)} - Status: ${esc(t.status)}</p>
      <a class="btn" href="tournament.html?id=${t.id}">Open</a>
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

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initChatbot();
  normalizeHeaderNav();
  initPlayersPage();
  initSignupPage();
  initLoginPage();
  initCreateTournamentPage();
  initTournamentsPage();
  initTournamentDetailPage();
  initMyTournamentsPage();
  initContactPage();
});
