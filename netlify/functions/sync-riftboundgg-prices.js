const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-inventory";
const INVENTORY_KEY = "inventory";
const DOTGG_PRICE_URL = "https://api.dotgg.gg/cgfw/getcardprices";

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function keyFor(card) {
  return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
}

function supportsFoil(card) {
  return ["common", "uncommon"].includes(String(card.rarity || "").toLowerCase());
}

function normalizeCode(raw = "") {
  const text = String(raw || "").toUpperCase().trim();

  // Examples accepted:
  // OGN-001/298 -> OGN-001
  // OGN-001 -> OGN-001
  // OGN-001A -> OGN-001A
  // SFD-118A -> SFD-118A
  const match = text.match(/([A-Z]{3})[-\s]?(\d{3}[A-Z]?)/);
  if (!match) return "";

  return `${match[1]}-${match[2]}`;
}

function possibleCodes(card = {}) {
  const rawValues = [
    card.cardid,
    card.cardId,
    card.dotggId,
    card.dotggCode,
    card.publicCode,
    card.code,
    card.number
  ].filter(Boolean);

  const out = [];

  for (const raw of rawValues) {
    const normalized = normalizeCode(raw);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }

  return out;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;

  if (payload && Array.isArray(payload.lines)) return payload.lines;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.prices)) return payload.prices;
  if (payload && Array.isArray(payload.history)) return payload.history;
  if (payload && Array.isArray(payload.result)) return payload.result;
  if (payload && Array.isArray(payload.rows)) return payload.rows;

  if (payload && typeof payload === "object") return [payload];

  return [];
}

function deepPrices(obj, depth = 0, found = []) {
  if (!obj || depth > 6) return found;

  if (typeof obj !== "object") {
    const n = toNumber(obj);
    if (n) found.push(n);
    return found;
  }

  const preferredKeys = [
    "closePrice", "ClosePrice",
    "openPrice", "OpenPrice",
    "highPrice", "HighPrice",
    "lowPrice", "LowPrice",
    "marketPrice", "MarketPrice",
    "price", "Price",
    "normalPrice", "NormalPrice",
    "Normal", "normal"
  ];

  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const n = toNumber(obj[key]);
      if (n) found.push(n);
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      deepPrices(value, depth + 1, found);
    }
  }

  return found;
}

function extractNormalPrice(payload) {
  const rows = extractRows(payload);
  if (!rows.length) return null;

  const sorted = rows
    .filter(row => row && typeof row === "object")
    .sort((a, b) => Number(a.date || a.timestamp || a.todate || 0) - Number(b.date || b.timestamp || b.todate || 0));

  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i];

    const direct = [
      row.closePrice,
      row.ClosePrice,
      row.openPrice,
      row.OpenPrice,
      row.highPrice,
      row.HighPrice,
      row.lowPrice,
      row.LowPrice,
      row.marketPrice,
      row.MarketPrice,
      row.normalPrice,
      row.NormalPrice,
      row.Normal,
      row.normal,
      row.price,
      row.Price
    ].map(toNumber).find(Boolean);

    if (direct) return direct;

    const deep = deepPrices(row);
    if (deep.length) return deep[0];
  }

  const deep = deepPrices(payload);
  return deep.length ? deep[0] : null;
}

function extractFoilPrice(payload) {
  const rows = extractRows(payload);
  if (!rows.length) return null;

  const sorted = rows
    .filter(row => row && typeof row === "object")
    .sort((a, b) => Number(a.date || a.timestamp || a.todate || 0) - Number(b.date || b.timestamp || b.todate || 0));

  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i];

    const direct = [
      row.foilClosePrice,
      row.FoilClosePrice,
      row.foilOpenPrice,
      row.FoilOpenPrice,
      row.foilHighPrice,
      row.FoilHighPrice,
      row.foilLowPrice,
      row.FoilLowPrice,
      row.foilMarketPrice,
      row.FoilMarketPrice,
      row.foilPrice,
      row.FoilPrice,
      row.Foil,
      row.foil,
      row.holofoil,
      row.Holofoil,
      row.holoFoilPrice,
      row.HoloFoilPrice
    ].map(toNumber).find(Boolean);

    if (direct) return direct;
  }

  return null;
}

async function fetchDotGG(cardId, attempt = 1) {
  const url = `${DOTGG_PRICE_URL}?game=riftbound&cardid=${encodeURIComponent(cardId)}&cache=${Date.now()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LilStoreTCG/2.0 price sync",
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        cardId,
        status: response.status,
        statusText: response.statusText,
        sample: text.slice(0, 600)
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
        message: error.message || String(error),
        sample: text.slice(0, 600)
      };
    }

    const normalPrice = extractNormalPrice(payload);
    const foilPrice = extractFoilPrice(payload);

    if (!normalPrice && !foilPrice && attempt < 2) {
      await sleep(150);
      return fetchDotGG(cardId, attempt + 1);
    }

    if (!normalPrice && !foilPrice) {
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
      normalPrice,
      foilPrice,
      payloadCardId: payload?.cardid || payload?.cardId || null
    };
  } catch (error) {
    return {
      ok: false,
      cardId,
      status: "FETCH_ERROR",
      message: error.message || String(error)
    };
  }
}

async function asyncPool(limit, items, iteratorFn) {
  const ret = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    const e = p.then(() => {
      const index = executing.indexOf(e);
      if (index >= 0) executing.splice(index, 1);
    });

    executing.push(e);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(ret);
}

async function debugDotGG(event = {}) {
  const cardId = event.queryStringParameters?.cardid || "OGN-001";
  const result = await fetchDotGG(cardId);

  return json(200, {
    ok: result.ok,
    cardId,
    result
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  if (event.httpMethod === "GET" && event.queryStringParameters?.debug) {
    return await debugDotGG(event);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido." });
  }

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

    const candidates = [];

    for (const card of cards) {
      const codes = possibleCodes(card);
      if (!codes.length) continue;

      candidates.push({
        card,
        key: keyFor(card),
        cardId: codes[0]
      });
    }

    const uniqueCardIds = [...new Set(candidates.map(item => item.cardId))];

    // Secuencial con baja concurrencia para evitar bloqueos del endpoint.
    const results = await asyncPool(2, uniqueCardIds, fetchDotGG);

    const resultMap = {};
    const failed = [];

    for (const result of results) {
      if (result.ok) {
        resultMap[result.cardId] = result;
      } else {
        failed.push(result);
      }
    }

    const store = getStore(STORE_NAME);
    const inventory = await store.get(INVENTORY_KEY, { type: "json" }) || {};

    let updated = 0;
    const notFound = [];
    const touched = new Set();

    for (const item of candidates) {
      const priceData = resultMap[item.cardId];

      if (!priceData) {
        notFound.push({
          publicCode: item.card.publicCode,
          dotggCode: item.card.dotggCode,
          cardid: item.cardId,
          name: item.card.name
        });
        continue;
      }

      const key = item.key;

      if (typeof inventory[key] === "number") {
        inventory[key] = { stock: inventory[key] };
      }

      inventory[key] = inventory[key] || {};
      inventory[key].stock = Number(inventory[key].stock ?? item.card.stock ?? 0);

      if (supportsFoil(item.card)) {
        inventory[key].foilStock = Number(inventory[key].foilStock ?? item.card.foilStock ?? 0);
      }

      const normalPrice = priceData.normalPrice || priceData.foilPrice;
      if (normalPrice) {
        inventory[key].marketPrice = Number(normalPrice.toFixed(2));
        inventory[key].storePrice = Math.round(normalPrice * dollar * margin);
      }

      if (supportsFoil(item.card) && priceData.foilPrice) {
        inventory[key].foilMarketPrice = Number(priceData.foilPrice.toFixed(2));
        inventory[key].foilStorePrice = Math.round(priceData.foilPrice * dollar * margin);
      }

      if (!touched.has(key)) {
        updated++;
        touched.add(key);
      }
    }

    await store.setJSON(INVENTORY_KEY, inventory);

    return json(200, {
      ok: true,
      source: DOTGG_PRICE_URL,
      uniqueCodes: uniqueCardIds.length,
      updated,
      failedCount: failed.length,
      notFoundCount: notFound.length,
      failed: failed.slice(0, 10),
      notFound: notFound.slice(0, 10),
      debugFailed: failed.slice(0, 10).map(f => ({
        cardId: f.cardId,
        status: f.status,
        message: f.message,
        sample: f.sample
      })),
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
