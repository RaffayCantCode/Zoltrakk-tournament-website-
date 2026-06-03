const { getStore } = require("@netlify/blobs");
const {
  STORE_NAME,
  ALLOWED,
  corsHeaders,
  jsonResponse,
  sanitizeUser,
  prepareUserForCloud,
  verifyPassword,
  readCollection,
  writeCollection
} = require("./_utils");

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  const store = getStore(STORE_NAME);

  try {
    if (event.httpMethod === "GET") {
      const collection = (event.queryStringParameters?.collection || "").trim();
      if (!ALLOWED.has(collection)) {
        return jsonResponse(400, { success: false, message: "Invalid collection." });
      }
      const data = await readCollection(store, collection);
      if (collection === "users") {
        return jsonResponse(200, { success: true, data: data.map(sanitizeUser) });
      }
      return jsonResponse(200, { success: true, data });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const action = body.action || "replace";

      if (action === "register") {
        const user = body.user;
        if (!user?.email || !user?.password) {
          return jsonResponse(400, { success: false, message: "Invalid user payload." });
        }
        const users = await readCollection(store, "users");
        const email = user.email.toLowerCase();
        if (users.some((u) => u.email === email)) {
          return jsonResponse(409, { success: false, message: "Account already exists." });
        }
        const cloudUser = prepareUserForCloud({ ...user, email });
        users.push(cloudUser);
        await writeCollection(store, "users", users);
        return jsonResponse(201, {
          success: true,
          user: sanitizeUser(cloudUser)
        });
      }

      if (action === "login") {
        const email = (body.email || "").trim().toLowerCase();
        const password = body.password || "";
        const users = await readCollection(store, "users");
        const found = users.find((u) => u.email === email);
        if (!found) {
          return jsonResponse(404, { success: false, message: "No account found with this email address.", code: "EMAIL_NOT_FOUND" });
        }
        if (!verifyPassword(password, found)) {
          return jsonResponse(401, { success: false, message: "Incorrect password.", code: "WRONG_PASSWORD" });
        }
        return jsonResponse(200, { success: true, user: sanitizeUser(found) });
      }

      const collection = (body.collection || "").trim();
      if (!ALLOWED.has(collection)) {
        return jsonResponse(400, { success: false, message: "Invalid collection." });
      }
      if (!Array.isArray(body.data)) {
        return jsonResponse(400, { success: false, message: "Data must be an array." });
      }

      let payload = body.data;
      if (collection === "users") {
        const existing = await readCollection(store, "users");
        const byEmail = new Map(existing.map((u) => [u.email, u]));
        payload = body.data.map((incoming) => {
          const prev = byEmail.get((incoming.email || "").toLowerCase());
          if (!prev) {
            return incoming.password ? prepareUserForCloud(incoming) : incoming;
          }
          if (incoming.password && incoming.password !== prev.passwordHash) {
            return prepareUserForCloud({ ...prev, ...incoming });
          }
          return { ...prev, ...incoming, passwordHash: prev.passwordHash, salt: prev.salt };
        });
      }

      await writeCollection(store, collection, payload);
      return jsonResponse(200, { success: true, synced: payload.length });
    }

    return jsonResponse(405, { success: false, message: "Method not allowed." });
  } catch (error) {
    return jsonResponse(500, { success: false, message: error.message || "Store error." });
  }
};
