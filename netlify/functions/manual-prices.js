const STORE_NAME = "lilstore-catalog";
const PRICE_FIELDS = ["marketPrice", "storePrice", "foilMarketPrice", "foilStorePrice"];
const { updateState, connectSharedStorage, getSharedStore, requireStrongStorage } = require("./pricing-state");

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
    connectSharedStorage(event);
    const pin = process.env.ADMIN_PIN || "";
    const receivedPin = event.headers["x-admin-pin"] || event.headers["X-Admin-Pin"] || "";
    if (!pin) return json(500, { error: "Falta configurar ADMIN_PIN en Netlify." });
    if (receivedPin !== pin) return json(401, { error: "PIN incorrecto." });
    requireStrongStorage();

    const payload = JSON.parse(event.body || "{}");
    const updates = Array.isArray(payload.updates) ? payload.updates : [];
    if (!updates.length) return json(400, { error: "No se recibieron precios manuales." });

    const byKey = new Map();
    for (const update of updates) {
      const cardKey = String(update.cardKey || "").trim();
      if (cardKey) byKey.set(cardKey, update);
    }

    const store = getSharedStore(STORE_NAME);
    const operationId = String(payload.operationId || `${Date.now()}-${Math.random()}`);
    const state = await updateState(store, current => {
      let updated = 0;
      const cards = (current.cards || []).map(card => {
        const key = String(card.publicCode || card.dotggCode || "");
        const update = byKey.get(key);
        if (!update) return card;
        const next = { ...card };
        for (const field of PRICE_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(update, field)) next[field] = normalizePrice(update[field], field);
        }
        next.priceSource = "manual";
        updated++;
        return next;
      });
      return { ...current, cards, lastManualUpdateCount: updated };
    }, operationId);
    if (state._replayedOperationId && state.lastOperation !== operationId) {
      return json(409, { error: "Esta edición ya se aplicó y después hubo otros cambios. Recarga los precios antes de continuar." });
    }
    return json(200, { ok: true, updated: state.lastManualUpdateCount || 0, cards: state.cards });
  } catch (error) {
    return json(500, { error: "Error guardando precios manuales.", message: error.message || String(error) });
  }
};
