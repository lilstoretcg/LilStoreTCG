const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-inventory";
const INVENTORY_KEY = "inventory";
const SETTINGS_STORE = "lilstore-settings";
const MIN_PRICES_KEY = "minimum-prices";
const DOTGG_PRICE_URL = "https://api.dotgg.gg/cgfw/getcardprices";

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

function shortCode(publicCode = "") {
  const match = String(publicCode).toUpperCase().match(/([A-Z]{3})-(\d{3}[A-Z]?)/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function keyFor(card) {
  return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
}

function supportsFoil(card) {
  return ["common", "uncommon"].includes(String(card.rarity || "").toLowerCase());
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(",", ".").replace(/[^0-9.\-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;

  if (payload && Array.isArray(payload.lines)) return payload.lines;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.prices)) return payload.prices;
  if (payload && Array.isArray(payload.history)) return payload.history;
  if (payload && Array.isArray(payload.result)) return payload.result;
  if (payload && Array.isArray(payload.rows)) return payload.rows;

  if (payload && typeof payload === "object") {
    return [payload];
  }

  return [];
}

function findPriceDeep(obj, depth = 0) {
  if (!obj || depth > 5) return null;

  if (typeof obj !== "object") {
    return toNumber(obj);
  }

  const preferredKeys = [
    "Normal", "normal",
    "Foil", "foil",
    "Holofoil", "holofoil",
    "ColdFoil", "coldfoil",
    "tcgplayerPrice", "tcgPlayerPrice", "tcgplayer", "tcgPlayer",
    "marketPrice", "market", "price",
    "closePrice", "openPrice", "highPrice", "lowPrice"
  ];

  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const price = toNumber(obj[key]);
      if (price) return price;
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const price = findPriceDeep(value, depth + 1);
      if (price) return price;
    }
  }

  return null;
}

function latestPriceFromHistory(payload) {
  const rows = extractRows(payload);
  if (!rows.length) return null;

  const normalized = rows
    .filter(row => row && typeof row === "object")
    .sort((a, b) => Number(a.date || a.timestamp || a.todate || 0) - Number(b.date || b.timestamp || b.todate || 0));

  for (let i = normalized.length - 1; i >= 0; i--) {
    const price = findPriceDeep(normalized[i]);
    if (price) return price;
  }

  return null;
}


function priceFromCandidates(values) {
  for (const value of values) {
    const price = toNumber(value);
    if (price) return price;
  }
  return null;
}

function latestNormalFoilPrices(payload) {
  const rows = extractRows(payload);
  if (!rows.length) return { normalPrice: null, foilPrice: null };

  const sorted = rows
    .filter(row => row && typeof row === "object")
    .sort((a, b) => Number(a.date || a.timestamp || a.todate || 0) - Number(b.date || b.timestamp || b.todate || 0));

  let normalPrice = null;
  let foilPrice = null;

  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i];

    if (!normalPrice) {
      normalPrice = priceFromCandidates([
        row.closePrice,
        row.ClosePrice,
        row.openPrice,
        row.OpenPrice,
        row.highPrice,
        row.HighPrice,
        row.lowPrice,
        row.LowPrice,
        row.Normal,
        row.normal,
        row.normalPrice,
        row.NormalPrice,
        row.marketPrice,
        row.MarketPrice,
        row.price,
        row.Price
      ]);
    }

    if (!foilPrice) {
      foilPrice = priceFromCandidates([
        row.foilClosePrice,
        row.FoilClosePrice,
        row.foilPrice,
        row.FoilPrice,
        row.Foil,
        row.foil,
        row.holofoil,
        row.Holofoil,
        row.holoFoilPrice,
        row.HoloFoilPrice
      ]);
    }

    if (normalPrice && foilPrice) break;
  }

  if (!normalPrice) normalPrice = latestPriceFromHistory(payload);

  return { normalPrice, foilPrice };
}

async function getDotGGPrice(cardId) {
  const url = `${DOTGG_PRICE_URL}?game=riftbound&cardid=${encodeURIComponent(cardId)}&cache=${Date.now()}`;

  let response;
  let text = "";

  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "LilStoreTCG/1.0 price sync",
        "Accept": "application/json"
      }
    });

    text = await response.text();
  } catch (error) {
    return {
      ok: false,
      cardId,
      status: "FETCH_ERROR",
      message: error.message || String(error)
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      cardId,
      status: response.status,
      sample: text.slice(0, 500)
    };
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      cardId,
      status: "BAD_JSON",
      sample: text.slice(0, 500),
      message: error.message || String(error)
    };
  }

  const { normalPrice, foilPrice } = latestNormalFoilPrices(payload);
  const price = normalPrice || foilPrice || null;

  if (!price) {
    return {
      ok: false,
      cardId,
      status: "NO_PRICE",
      sample: JSON.stringify(payload).slice(0, 700)
    };
  }

  return {
    ok: true,
    cardId,
    price,
    normalPrice,
    foilPrice
  };
}

async function asyncPool(limit, items, iteratorFn) {
  const ret = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    const e = p.then(() => executing.splice(executing.indexOf(e), 1));
    executing.push(e);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(ret);
}


function defaultMinPrices() {
  return {
    common: { normal: 100, foil: 200 },
    uncommon: { normal: 150, foil: 300 },
    rare: { normal: 500, foil: 0 },
    epic: { normal: 1000, foil: 0 },
    showcase: { normal: 2000, foil: 0 }
  };
}

async function getMinPriceRules() {
  try {
    const settingsStore = getStore(SETTINGS_STORE);
    return await settingsStore.get(MIN_PRICES_KEY, { type: "json" }) || defaultMinPrices();
  } catch {
    return defaultMinPrices();
  }
}

function applyMinimumPriceToEntry(card, entry, rules) {
  const rarity = String(card.rarity || "").toLowerCase();
  const rule = rules[rarity];
  if (!rule) return entry;

  entry.storePrice = Math.max(Number(entry.storePrice || 0), Number(rule.normal || 0));

  if (["common", "uncommon"].includes(rarity)) {
    entry.foilStorePrice = Math.max(Number(entry.foilStorePrice || 0), Number(rule.foil || 0));
  }

  return entry;
}


// DEBUG_DOTGG_DIAGNOSTIC
async function debugDotGG(event = {}) {
  const testCardId = event.queryStringParameters?.cardid || "OGN-001";
  const url = `${DOTGG_PRICE_URL}?game=riftbound&cardid=${encodeURIComponent(testCardId)}&cache=${Date.now()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LilStoreTCG/1.0 diagnostic",
        "Accept": "application/json"
      }
    });

    const text = await response.text();
    let parsed = null;

    try {
      parsed = JSON.parse(text);
    } catch {}

    return json(200, {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      contentType: response.headers.get("content-type"),
      textPreview: text.slice(0, 1200),
      parsedPreview: parsed
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: "No se pudo conectar con DotGG.",
      message: error.message || String(error),
      stack: error.stack || "",
      name: error.name || "Error",
      url
    });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET" && event.queryStringParameters?.debug) {
    return await debugDotGG(event);
  }
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });

  try {
    connectLambda(event);

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

    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    const dollar = Number(payload.dollar || 900);
    const margin = Number(payload.margin || 1);

    if (!cards.length) {
      return json(400, { error: "No se recibieron cartas para actualizar." });
    }

    const minPriceRules = await getMinPriceRules();

    const cardsWithCodes = cards
      .map(card => ({ ...card, dotggId: shortCode(card.publicCode) }))
      .filter(card => card.dotggId);

    const uniqueCodes = [...new Set(cardsWithCodes.map(card => card.dotggId))];
    const priceResults = await asyncPool(3, uniqueCodes, getDotGGPrice);

    const priceMap = {};
    const failed = [];

    for (const result of priceResults) {
      if (result.ok) {
        priceMap[result.cardId] = {
          price: result.price,
          normalPrice: result.normalPrice,
          foilPrice: result.foilPrice
        };
      } else {
        failed.push(result);
      }
    }

    const store = getStore(STORE_NAME);
    const current = await store.get(INVENTORY_KEY, { type: "json" });
    const inventory = current || {};

    let updated = 0;
    const notFound = [];

    for (const card of cardsWithCodes) {
      const priceData = priceMap[card.dotggId];
      const price = priceData?.price;

      if (!price) {
        notFound.push({
          publicCode: card.publicCode,
          cardid: card.dotggId,
          name: card.name
        });
        continue;
      }

      const key = keyFor(card);

      if (typeof inventory[key] === "number") {
        inventory[key] = { stock: inventory[key] };
      }

      inventory[key] = inventory[key] || {};
      inventory[key].stock = Number(inventory[key].stock ?? card.stock ?? 0);

      if (supportsFoil(card)) {
        inventory[key].foilStock = Number(inventory[key].foilStock ?? card.foilStock ?? 0);
      }

      const normalPrice = priceData.normalPrice || price;
      inventory[key].marketPrice = Number(normalPrice.toFixed(2));
      inventory[key].storePrice = Math.round(normalPrice * dollar * margin);

      if (supportsFoil(card) && priceData.foilPrice) {
        inventory[key].foilMarketPrice = Number(priceData.foilPrice.toFixed(2));
        inventory[key].foilStorePrice = Math.round(priceData.foilPrice * dollar * margin);
      }

      applyMinimumPriceToEntry(card, inventory[key], minPriceRules);
      updated++;
    }

    await store.setJSON(INVENTORY_KEY, inventory);

    return json(200, {
      ok: true,
      source: DOTGG_PRICE_URL,
      uniqueCodes: uniqueCodes.length,
      updated,
      failedCount: failed.length,
      notFoundCount: notFound.length,
      failed: failed.slice(0, 10),
      debugFailed: failed.slice(0, 8).map(f => ({ cardId: f.cardId, status: f.status, sample: f.sample, message: f.message })),
      failedSamples: failed.slice(0, 5).map(f => ({ cardId: f.cardId, status: f.status, sample: f.sample })),
      notFound: notFound.slice(0, 10),
      dollar,
      margin
    });
  } catch (error) {
    return json(500, {
      error: "Error interno sincronizando precios DotGG.",
      message: error.message || String(error),
      stack: error.stack || "",
      name: error.name || "Error"
    });
  }
};
