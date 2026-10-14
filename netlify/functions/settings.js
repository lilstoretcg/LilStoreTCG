const STORE_NAME = "lilstore-settings";
const BASE_PRICES_KEY = "base-prices";
const PRICING_KEY = "pricing";
const CATALOG_STORE = "lilstore-catalog";
const { DEFAULT_PRICING, applyPricing, readState, updateState, connectSharedStorage, getSharedStore, requireStrongStorage } = require("./pricing-state");

const DEFAULT_BASE_PRICES = {
  common: { normal: 100, foil: 200 },
  uncommon: { normal: 300, foil: 400 },
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

function normalizeBasePrices(input = {}) {
  const out = JSON.parse(JSON.stringify(DEFAULT_BASE_PRICES));

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
    connectSharedStorage(event);
    const store = getSharedStore(STORE_NAME);

    if (event.httpMethod === "GET") {
      const current = await store.get(BASE_PRICES_KEY, { type: "json" });
      const catalogStore = getSharedStore(CATALOG_STORE);
      const { state } = await readState(catalogStore);
      const legacyPricing = await store.get(PRICING_KEY, { type: "json" });
      const sharedPricing = Number(state.pricingVersion || 0) === 0 ? (legacyPricing || state.pricing || DEFAULT_PRICING) : (state.pricing || DEFAULT_PRICING);
      return json(200, { basePrices: current || DEFAULT_BASE_PRICES, pricing: sharedPricing, stateVersion: state.version || 0, pricingVersion: state.pricingVersion || 0, catalogVersion: state.catalogVersion || 0, recoveryRequired: state.version !== state.catalogVersion });
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

      if (payload.pricing) {
        requireStrongStorage();
        const dollar = Number(payload.pricing.dollar);
        const margin = Number(payload.pricing.margin);
        if (!Number.isFinite(dollar) || dollar < 1 || dollar > 100000 || !Number.isFinite(margin) || margin < 0 || margin > 100) {
          return json(400, { error: "Dólar o multiplicador inválido." });
        }
        const pricing = { dollar, margin };
        const expectedVersion = Number(payload.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return json(400, { error: "Falta la versión de configuración cargada. Recarga el panel e inténtalo de nuevo." });
        const rules = await store.get(BASE_PRICES_KEY, { type: "json" }) || DEFAULT_BASE_PRICES;
        const catalogStore = getSharedStore(CATALOG_STORE);
        const operationId = String(payload.operationId || `${Date.now()}-${Math.random()}`);
        try {
          const state = await updateState(catalogStore, current => {
            if (Number(current.pricingVersion || 0) !== expectedVersion) {
              const error = new Error("La configuración cambió en otra sesión. Vuelve a cargar los valores e inténtalo de nuevo.");
              error.statusCode = 409;
              throw error;
            }
            return { ...current, pricing, pricingVersion: Number(current.pricingVersion || 0) + 1, cards: applyPricing(current.cards || [], pricing, rules) };
          }, operationId);
          if (state._replayedOperationId && state.lastOperation !== operationId) {
            return json(409, { error: "Esta operación ya fue confirmada y luego hubo otros cambios. Recarga la configuración antes de continuar." });
          }
          if (state._replayedOperationId && (Number(state.pricing?.dollar) !== dollar || Number(state.pricing?.margin) !== margin)) {
            return json(409, { error: "Esta operación ya se aplicó y luego fue reemplazada por una configuración posterior. Recarga antes de guardar." });
          }
          return json(200, { ok: true, pricing, pricingVersion: state.pricingVersion, catalogVersion: state.catalogVersion, updated: state.cards.length, recoveryRequired: state.version !== state.catalogVersion });
        } catch (error) {
          if (error.statusCode === 409) return json(409, { error: error.message });
          throw error;
        }
      }
      const rules = normalizeBasePrices(payload.basePrices || payload.rules || payload || {});
      await store.setJSON(BASE_PRICES_KEY, rules);

      return json(200, { ok: true, basePrices: rules });
    }

    return json(405, { error: "Método no permitido." });
  } catch (error) {
    return json(500, {
      error: "Error interno en settings.js",
      message: error.message || String(error)
    });
  }
};
