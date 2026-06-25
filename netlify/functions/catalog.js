const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-catalog";
const CATALOG_KEY = "cards";
const ALLOWED_SET_CODES = new Set(["OGN", "SFD", "UNL"]);
const ALLOWED_SET_NAMES = new Set(["Origins", "Spiritforged", "Unleashed"]);

function allowedCard(card = {}) {
  const setCode = String(card.setCode || card.dotggCode || card.publicCode || "").toUpperCase().slice(0, 3);
  const setName = String(card.set || "");
  return ALLOWED_SET_CODES.has(setCode) || ALLOWED_SET_NAMES.has(setName);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore(STORE_NAME);
    const catalog = await store.get(CATALOG_KEY, { type: "json" });
    return json(200, Array.isArray(catalog) ? catalog.filter(allowedCard) : []);
  } catch (error) {
    return json(200, []);
  }
};
