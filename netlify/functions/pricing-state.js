const { connectLambda, getStore, setEnvironmentContext } = require("@netlify/blobs");
const LEGACY_CATALOG_KEY = "cards";
const PRICING_STATE_KEY = "pricing-state";
const DEFAULT_PRICING = { dollar: 900, margin: 1 };
let strongStorageEnabled = false;

function connectSharedStorage(event) {
  connectLambda(event);
  const apiToken = process.env.NETLIFY_BLOBS_API_TOKEN || "";
  if (apiToken) {
    const eventSiteID = event.headers?.["x-nf-site-id"] || event.headers?.["X-Nf-Site-Id"];
    const configuredSiteID = process.env.NETLIFY_SITE_ID;
    if (configuredSiteID && eventSiteID && configuredSiteID !== eventSiteID) {
      throw new Error("El ID de sitio de la petición no coincide con NETLIFY_SITE_ID.");
    }
    const siteID = configuredSiteID || eventSiteID;
    if (!siteID) throw new Error("Falta NETLIFY_SITE_ID para usar acceso directo y consistente a Netlify Blobs.");
    setEnvironmentContext({ apiURL: process.env.NETLIFY_BLOBS_API_URL || "https://api.netlify.com", siteID, token: apiToken });
    strongStorageEnabled = true;
  } else {
    strongStorageEnabled = false;
  }
}

function getSharedStore(name) {
  return getStore({ name, consistency: strongStorageEnabled ? "strong" : "eventual" });
}

function requireStrongStorage() {
  if (!strongStorageEnabled) {
    const error = new Error("Configura NETLIFY_BLOBS_API_TOKEN en Netlify para habilitar escrituras versionadas seguras.");
    error.statusCode = 503;
    throw error;
  }
}

function applyPricing(cards, pricing, basePrices) {
  return cards.map(original => {
    const card = { ...original };
    if (card.priceSource === "manual") return card;
    const rarity = String(card.rarity || "").toLowerCase();
    const rules = basePrices[rarity] || {};
    const normalMarket = Number(card.marketPrice || 0);
    if (normalMarket > 0) {
      card.storePrice = Math.max(Math.round(normalMarket * pricing.dollar * pricing.margin), Number(rules.normal || 0));
    }
    if (["common", "uncommon"].includes(rarity)) {
      const foilMarket = Number(card.foilMarketPrice || 0);
      if (foilMarket > 0) {
        card.foilStorePrice = Math.max(Math.round(foilMarket * pricing.dollar * pricing.margin), Number(rules.foil || 0));
      }
    }
    return card;
  });
}

function applyDotggQuote(original, quote, pricing, basePrices, hasFoil) {
  if (!original || original.priceSource === "manual") return { card: original, changed: false };
  const market = quote.normalPrice || quote.effectivePrice;
  if (!market) return { card: original, changed: false };
  const card = { ...original, marketPrice: Number(market.toFixed(2)), priceSource: "dotgg", requiresManualPrice: false };
  const rarity = String(card.rarity || "").toLowerCase();
  const rules = basePrices[rarity] || {};
  card.storePrice = Math.max(Math.round(market * pricing.dollar * pricing.margin), Number(rules.normal || 0));
  if (hasFoil && quote.foilPrice) {
    card.foilMarketPrice = Number(quote.foilPrice.toFixed(2));
    card.foilStorePrice = Math.max(Math.round(quote.foilPrice * pricing.dollar * pricing.margin), Number(rules.foil || 0));
  }
  return { card, changed: true };
}

async function readState(store) {
  const entry = await store.getWithMetadata(PRICING_STATE_KEY, { type: "json" });
  if (entry) return { state: entry.data, etag: entry.etag };
  const legacy = await store.get(LEGACY_CATALOG_KEY, { type: "json" });
  return { state: { version: 0, catalogVersion: 0, pricingVersion: 0, pricing: DEFAULT_PRICING, cards: Array.isArray(legacy) ? legacy : [], lastOperation: null, operationIds: [] }, etag: null };
}

async function updateState(store, mutate, operationId, attempts = 6) {
  operationId = String(operationId || "").trim();
  if (!operationId) throw new Error("Se requiere operationId para actualizar el estado versionado.");
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { state, etag } = await readState(store);
    if (state.lastOperation === operationId || (Array.isArray(state.operationIds) && state.operationIds.includes(operationId))) {
      return { ...state, _replayedOperationId: operationId };
    }
    const next = await mutate(state);
    next.version = Number(state.version || 0) + 1;
    next.catalogVersion = next.version;
    next.pricingVersion = Number(next.pricingVersion ?? state.pricingVersion ?? 0);
    next.lastOperation = operationId;
    next.operationIds = [...new Set([...(Array.isArray(state.operationIds) ? state.operationIds : []), operationId])];
    const result = await store.setJSON(PRICING_STATE_KEY, next, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    // SDK 10.7.12+ forwards the conditional headers for setJSON. Require its
    // documented success ETag; an empty ETag can mean a swallowed transport error.
    if (result?.modified && typeof result.etag === "string" && result.etag.length > 0) return next;
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, Math.min(100 * (attempt + 1), 500)));
  }
  throw new Error("No se pudo publicar el catálogo por una actualización concurrente. Reintenta la operación.");
}

module.exports = { DEFAULT_PRICING, PRICING_STATE_KEY, applyPricing, applyDotggQuote, readState, updateState, connectSharedStorage, getSharedStore, requireStrongStorage };
