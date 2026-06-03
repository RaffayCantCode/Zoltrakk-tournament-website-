const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const ALLOWED = new Set(["users", "tournaments", "participants", "user_players"]);

function collectionPath(name) { return path.join(DATA_DIR, `${name}.json`); }

function readCollection(name) {
  try {
    const raw = fs.readFileSync(collectionPath(name), "utf8");
    return JSON.parse(raw);
  } catch { return []; }
}

function writeCollection(name, data) {
  fs.writeFileSync(collectionPath(name), JSON.stringify(data, null, 2));
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
}

function sanitizeUser(user) {
  const { password, passwordHash, salt, ...safe } = user;
  return safe;
}

function prepareUserForCloud(user) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(user.password, salt);
  const { password, ...rest } = user;
  return { ...rest, passwordHash, salt };
}

function verifyPassword(password, user) {
  if (!user.passwordHash || !user.salt) return false;
  return hashPassword(password, user.salt) === user.passwordHash;
}

app.use(express.json({ limit: "10mb" }));

// Store API at /.netlify/functions/store (same path as Netlify Functions)
app.all("/.netlify/functions/store", (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).header("Allow", "GET,POST,OPTIONS").end();

  try {
    if (req.method === "GET") {
      const collection = (req.query.collection || "").trim();
      if (!ALLOWED.has(collection)) return res.status(400).json({ success: false, message: "Invalid collection." });
      const data = readCollection(collection);
      if (collection === "users") return res.json({ success: true, data: data.map(sanitizeUser) });
      return res.json({ success: true, data });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = body.action || "replace";

      if (action === "register") {
        const user = body.user;
        if (!user?.email || !user?.password) return res.status(400).json({ success: false, message: "Invalid user payload." });
        const users = readCollection("users");
        const email = user.email.toLowerCase();
        if (users.some((u) => u.email === email)) return res.status(409).json({ success: false, message: "Account already exists." });
        const cloudUser = prepareUserForCloud({ ...user, email });
        users.push(cloudUser);
        writeCollection("users", users);
        return res.status(201).json({ success: true, user: sanitizeUser(cloudUser) });
      }

      if (action === "login") {
        const email = (body.email || "").trim().toLowerCase();
        const password = body.password || "";
        const users = readCollection("users");
        const found = users.find((u) => u.email === email);
        if (!found) return res.status(404).json({ success: false, message: "No account found with this email address.", code: "EMAIL_NOT_FOUND" });
        if (!verifyPassword(password, found)) return res.status(401).json({ success: false, message: "Incorrect password.", code: "WRONG_PASSWORD" });
        return res.json({ success: true, user: sanitizeUser(found) });
      }

      const collection = (body.collection || "").trim();
      if (!ALLOWED.has(collection)) return res.status(400).json({ success: false, message: "Invalid collection." });
      if (!Array.isArray(body.data)) return res.status(400).json({ success: false, message: "Data must be an array." });

      let payload = body.data;
      if (collection === "users") {
        const existing = readCollection("users");
        const byEmail = new Map(existing.map((u) => [u.email, u]));
        payload = body.data.map((incoming) => {
          const prev = byEmail.get((incoming.email || "").toLowerCase());
          if (!prev) return incoming.password ? prepareUserForCloud(incoming) : incoming;
          if (incoming.password && incoming.password !== prev.passwordHash) return prepareUserForCloud({ ...prev, ...incoming });
          return { ...prev, ...incoming, passwordHash: prev.passwordHash, salt: prev.salt };
        });
      }
      writeCollection(collection, payload);
      return res.json({ success: true, synced: payload.length });
    }

    return res.status(405).json({ success: false, message: "Method not allowed." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Store error." });
  }
});

// Serve static files from ../files/
app.use(express.static(path.join(__dirname, "..", "files")));

app.listen(PORT, () => {
  console.log(`Zoltrakk server running at http://localhost:${PORT}`);
  console.log(`Store API at http://localhost:${PORT}/.netlify/functions/store`);
  console.log(`Static files served from ${path.join(__dirname, "..", "files")}`);
});
