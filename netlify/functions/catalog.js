const STORE_NAME = "lilstore-catalog";
const { readState, connectSharedStorage, getSharedStore } = require("./pricing-state");
const ALLOWED_SET_CODES = new Set([
  "OGN",
  "SFD",
  "UNL",
  "VEN"
]);

const ALLOWED_SET_NAMES = new Set([
  "Origins",
  "Spiritforged",
  "Unleashed",
  "Vendetta"
]);

function allowedCard(card = {}) {
  const setCode = String(card.setCode || card.dotggCode || card.publicCode || "").toUpperCase().slice(0, 3);
  const setName = String(card.set || "");
  return ALLOWED_SET_CODES.has(setCode) || ALLOWED_SET_NAMES.has(setName);
}

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    connectSharedStorage(event);
    const store = getSharedStore(STORE_NAME);
    const { state } = await readState(store);
    const catalog = state.cards;

console.log("CATALOG READ", {
  host: event.headers?.host,
  path: event.path,
  sfd247: (catalog || [])
    .filter(card =>
      String(card.publicCode || card.dotggCode || "")
        .toUpperCase()
        .startsWith("SFD-247")
    )
    .map(card => ({
      id: card.id,
      name: card.name,
      publicCode: card.publicCode,
      dotggCode: card.dotggCode,
      marketPrice: card.marketPrice
    }))
});

    return json(200, Array.isArray(catalog) ? catalog.filter(allowedCard) : [], {
      "X-LilStore-State-Version": String(state.version || 0),
      "X-LilStore-Catalog-Version": String(state.catalogVersion || 0),
      "X-LilStore-Pricing-Version": String(state.pricingVersion || 0)
    });
  } catch (error) {
    return json(500, { error: "No se pudo leer el catálogo versionado.", message: error.message || String(error) });
  }
};
