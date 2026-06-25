const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-settings";
const BASE_PRICES_KEY = "minimum-prices";

const DEFAULT_MIN_PRICES = {
  common: { normal: 100, foil: 200 },
  uncommon: { normal: 150, foil: 300 },
  rare: { normal: 500, foil: 0 },
  epic: { normal: 1000, foil: 0 },
  showcase: { normal: 2000, foil: 0 }
};

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

function normalizeRules(input = {}) {
  const out = JSON.parse(JSON.stringify(DEFAULT_MIN_PRICES));

  Object.keys(out).forEach(rarity => {
    const row = input[rarity] || input[rarity.toLowerCase()] || {};
    out[rarity].normal = Math.max(0, Math.round(Number(row.normal ?? out[rarity].normal ?? 0)));
    out[rarity].foil = Math.max(0, Math.round(Number(row.foil ?? out[rarity].foil ?? 0)));
  });

  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    connectLambda(event);
    const store = getStore(STORE_NAME);

    if (event.httpMethod === "GET") {
      const current = await store.get(BASE_PRICES_KEY, { type: "json" });
      return json(200, current || DEFAULT_MIN_PRICES);
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

      const rules = normalizeRules(payload.rules || payload.basePrices || payload || {});
      await store.setJSON(BASE_PRICES_KEY, rules);

      return json(200, { ok: true, rules });
    }

    return json(405, { error: "Método no permitido." });
  } catch (error) {
    return json(500, {
      error: "Error interno en settings.js",
      message: error.message || String(error)
    });
  }
};
