const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-inventory";
const INVENTORY_KEY = "inventory";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-pin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    connectLambda(event);
    const store = getStore(STORE_NAME);

    if (event.httpMethod === "GET") {
      const current = await store.get(INVENTORY_KEY, { type: "json" });
      return json(200, current || {});
    }

    if (event.httpMethod === "POST") {
      const adminPin = process.env.ADMIN_PIN || "";
      const receivedPin = event.headers["x-admin-pin"] || event.headers["X-Admin-Pin"] || "";

      if (!adminPin) return json(500, { error: "Falta configurar ADMIN_PIN en Netlify." });
      if (receivedPin !== adminPin) return json(401, { error: "PIN incorrecto." });

      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "JSON inválido." });
      }

      const inventory = payload.inventory || payload.stock || {};
      await store.setJSON(INVENTORY_KEY, inventory);

      return json(200, {
        ok: true,
        updated: Object.keys(inventory).length,
        inventory
      });
    }

    return json(405, { error: "Método no permitido." });
  } catch (error) {
    return json(500, {
      error: "Error interno en stock.js",
      message: error.message || String(error)
    });
  }
};
