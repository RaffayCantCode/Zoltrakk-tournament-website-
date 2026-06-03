const crypto = require("crypto");

const STORE_NAME = "zoltrakk-arena";
const ALLOWED = new Set(["users", "tournaments", "participants", "user_players"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
    body: JSON.stringify(body)
  };
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

async function readCollection(store, key) {
  const data = await store.get(key, { type: "json" });
  return Array.isArray(data) ? data : [];
}

async function writeCollection(store, key, data) {
  await store.setJSON(key, data);
}

module.exports = {
  STORE_NAME,
  ALLOWED,
  corsHeaders,
  jsonResponse,
  sanitizeUser,
  prepareUserForCloud,
  verifyPassword,
  readCollection,
  writeCollection
};
