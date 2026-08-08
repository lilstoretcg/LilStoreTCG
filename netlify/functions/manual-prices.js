const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-catalog";
const CATALOG_KEY = "cards";
const PRICE_FIELDS = ["marketPrice", "storePrice", "foilMarketPrice", "foilStorePrice"];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-pin",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function normalizePrice(value, field) {
  const price = Math.max(0, Number(value || 0));
  return ["marketPrice", "foilMarketPrice"].includes(field)
    ? Number(price.toFixed(2))
    : Math.round(price);
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });

  try {
    connectLambda(event);
    const pin = process.env.ADMIN_PIN || "";
    const receivedPin = event.headers["x-admin-pin"] || event.headers["X-Admin-Pin"] || "";
    if (!pin) return json(500, { error: "Falta configurar ADMIN_PIN en Netlify." });
    if (receivedPin !== pin) return json(401, { error: "PIN incorrecto." });

    const payload = JSON.parse(event.body || "{}");
    const updates = Array.isArray(payload.updates) ? payload.updates : [];
    if (!updates.length) return json(400, { error: "No se recibieron precios manuales." });

    const byKey = new Map();
    for (const update of updates) {
      const cardKey = String(update.cardKey || "").trim();
      if (cardKey) byKey.set(cardKey, update);
    }

    const store = getStore(STORE_NAME);
    const cards = await store.get(CATALOG_KEY, { type: "json" }) || [];
    let updated = 0;

    for (const card of cards) {
      const key = String(card.publicCode || card.dotggCode || "");
      const update = byKey.get(key);
      if (!update) continue;
      for (const field of PRICE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(update, field)) {
          card[field] = normalizePrice(update[field], field);
        }
      }
      card.priceSource = "manual";
      updated++;
    }

    await store.setJSON(CATALOG_KEY, cards);
    return json(200, { ok: true, updated, cards });
  } catch (error) {
    return json(500, { error: "Error guardando precios manuales.", message: error.message || String(error) });
  }
};
