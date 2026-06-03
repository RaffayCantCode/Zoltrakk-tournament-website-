import {
  ALLOWED,
  corsHeaders,
  v2Response,
  sanitizeUser,
  prepareUserForCloud,
  verifyPassword
} from "./_utils.js";

const STORE_NAME = "zoltrakk-arena";

function jsonRes(status, body) {
  return v2Response(status, body);
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Try Blobs via context.stores first (most reliable in v2 format),
  // then fall back to @netlify/blobs getStore, then memory.
  let store;
  try { store = context.stores?.site; } catch {}
  if (!store) {
    try {
      const { getStore } = await import("@netlify/blobs");
      store = getStore(STORE_NAME);
    } catch {}
  }

  const mem = new Map();
  function memGet(k) { try { return JSON.parse(mem.get(k) || "[]") } catch { return [] } }
  function memSet(k, v) { mem.set(k, JSON.stringify(v)) }

  async function readCol(key) {
    if (store) {
      try {
        const d = await store.get(key, { type: "json" });
        if (Array.isArray(d)) return d;
      } catch {}
    }
    return memGet(key);
  }

  async function writeCol(key, data) {
    memSet(key, data);
    if (store) {
      try { await store.setJSON(key, data); } catch {}
    }
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const collection = url.searchParams.get("collection") || "";
      if (!ALLOWED.has(collection)) {
        return jsonRes(400, { success: false, message: "Invalid collection." });
      }
      const data = await readCol(collection);
      if (collection === "users") {
        return jsonRes(200, { success: true, data: data.map(sanitizeUser) });
      }
      return jsonRes(200, { success: true, data });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action || "replace";

      if (action === "register") {
        const user = body.user;
        if (!user?.email || !user?.password) {
          return jsonRes(400, { success: false, message: "Invalid user payload." });
        }
        const users = await readCol("users");
        const email = user.email.toLowerCase();
        if (users.some((u) => u.email === email)) {
          return jsonRes(409, { success: false, message: "Account already exists." });
        }
        const cloudUser = prepareUserForCloud({ ...user, email });
        users.push(cloudUser);
        await writeCol("users", users);
        return jsonRes(201, { success: true, user: sanitizeUser(cloudUser) });
      }

      if (action === "login") {
        const email = (body.email || "").trim().toLowerCase();
        const password = body.password || "";
        const users = await readCol("users");
        const found = users.find((u) => u.email === email);
        if (!found) {
          return jsonRes(404, { success: false, message: "No account found with this email address.", code: "EMAIL_NOT_FOUND" });
        }
        if (!verifyPassword(password, found)) {
          return jsonRes(401, { success: false, message: "Incorrect password.", code: "WRONG_PASSWORD" });
        }
        return jsonRes(200, { success: true, user: sanitizeUser(found) });
      }

      const collection = (body.collection || "").trim();
      if (!ALLOWED.has(collection)) {
        return jsonRes(400, { success: false, message: "Invalid collection." });
      }
      if (!Array.isArray(body.data)) {
        return jsonRes(400, { success: false, message: "Data must be an array." });
      }

      let payload = body.data;
      if (collection === "users") {
        const existing = await readCol("users");
        const byEmail = new Map(existing.map((u) => [u.email, u]));
        payload = body.data.map((incoming) => {
          const prev = byEmail.get((incoming.email || "").toLowerCase());
          if (!prev) return incoming.password ? prepareUserForCloud(incoming) : incoming;
          if (incoming.password && incoming.password !== prev.passwordHash) {
            return prepareUserForCloud({ ...prev, ...incoming });
          }
          return { ...prev, ...incoming, passwordHash: prev.passwordHash, salt: prev.salt };
        });
      }

      await writeCol(collection, payload);
      return jsonRes(200, { success: true, synced: payload.length });
    }

    return jsonRes(405, { success: false, message: "Method not allowed." });
  } catch (error) {
    return jsonRes(500, { success: false, message: error.message || "Store error." });
  }
};
