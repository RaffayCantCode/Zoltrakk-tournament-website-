const fs = require("fs");
const path = require("path");

exports.handler = async function handler() {
  try {
    const dataPath = path.join(process.cwd(), "files", "data.json");
    const raw = fs.readFileSync(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, data: parsed.players || [] })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Failed to load players data." })
    };
  }
};
