const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-inventory";
const INVENTORY_KEY = "inventory";
const SETTINGS_STORE = "lilstore-settings";
const BASE_PRICES_KEY = "base-prices";
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

function priceFromCandidates(values) {
  for (const value of values) {
    const price = toNumber(value);
    if (price) return price;
  }
  return null;
}

function extractPrices(payload) {
  const rows = extractRows(payload);
  let normalPrice = null;
  let foilPrice = null;

  const sorted = rows
    .filter(row => row && typeof row === "object")
    .sort((a, b) => Number(a.date || a.timestamp || a.todate || 0) - Number(b.date || b.timestamp || b.todate || 0));

  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i];

    if (!normalPrice) {
      normalPrice = priceFromCandidates([
        row.closePrice,
        row.ClosePrice,
        row.normalClosePrice,
        row.NormalClosePrice,
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
      ]);
    }

    if (!foilPrice) {
      foilPrice = priceFromCandidates([
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
      ]);
    }

    if (normalPrice && foilPrice) break;
  }

  return {
    normalPrice,
    foilPrice,
    effectivePrice: normalPrice || foilPrice || null
  };
}

async function fetchDotGG(cardId, attempt = 1) {
  const url = `${DOTGG_PRICE_URL}?game=riftbound&cardid=${encodeURIComponent(cardId)}&cache=${Date.now()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LilStoreTCG/3.0 batch sync",
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    if (response.status === 429 && attempt <= 2) {
      await sleep(1200 * attempt);
      return fetchDotGG(cardId, attempt + 1);
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
      if (/429|too many requests/i.test(text) && attempt <= 2) {
        await sleep(1200 * attempt);
        return fetchDotGG(cardId, attempt + 1);
      }

      return {
        ok: false,
        cardId,
        status: "BAD_JSON",
        message: error.message || String(error),
        sample: text.slice(0, 500)
      };
    }

    const prices = extractPrices(payload);

    if (!prices.effectivePrice) {
      return {
        ok: false,
        cardId,
        status: "NO_PRICE",
        sample: JSON.stringify(payload).slice(0, 500)
      };
    }

    return {
      ok: true,
      cardId,
      normalPrice: prices.normalPrice,
      foilPrice: prices.foilPrice,
      effectivePrice: prices.effectivePrice,
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


function defaultBasePrices() {
  return {
    common: { normal: 100, foil: 200 },
    uncommon: { normal: 300, foil: 400 },
    rare: { normal: 500, foil: 0 },
    epic: { normal: 1000, foil: 0 },
    showcase: { normal: 2000, foil: 0 }
  };
}

async function getBasePrices() {
  try {
    const settingsStore = getStore(SETTINGS_STORE);
    return await settingsStore.get(BASE_PRICES_KEY, { type: "json" }) || defaultBasePrices();
  } catch {
    return defaultBasePrices();
  }
}

function basePriceForCard(card, rules, variant = "normal") {
  const rarity = String(card.rarity || "").toLowerCase();
  const rule = rules[rarity];
  if (!rule) return 0;
  return Math.max(0, Math.round(Number(variant === "foil" ? rule.foil : rule.normal || 0)));
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

    const allCards = Array.isArray(payload.cards) ? payload.cards : [];
    const offset = Math.max(0, Number(payload.offset || 0));
    const limit = Math.min(Math.max(1, Number(payload.limit || 25)), 40);
    const dollar = Number(payload.dollar || 900);
    const margin = Number(payload.margin || 1);
    const syncMode = String(payload.syncMode || "all");

    if (!allCards.length) {
      return json(400, { error: "No se recibieron cartas para actualizar." });
    }

    const cards = allCards.slice(offset, offset + limit);

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

    const store = getStore(STORE_NAME);
    const inventory = await store.get(INVENTORY_KEY, { type: "json" }) || {};
    const basePrices = await getBasePrices();

    let updated = 0;
    const failed = [];
    const notFound = [];

    for (const item of candidates) {
      const priceData = await fetchDotGG(item.cardId);

      if (!priceData.ok) {
        failed.push(priceData);
        notFound.push({
          publicCode: item.card.publicCode,
          dotggCode: item.card.dotggCode,
          cardid: item.cardId,
          name: item.card.name
        });
        await sleep(150);
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

      const market = priceData.normalPrice || priceData.effectivePrice;

      if (market) {
        inventory[key].marketPrice = Number(market.toFixed(2));
        inventory[key].storePrice = Math.max(Math.round(market * dollar * margin), basePriceForCard(item.card, basePrices, "normal"));
      }

      if (supportsFoil(item.card) && priceData.foilPrice) {
        inventory[key].foilMarketPrice = Number(priceData.foilPrice.toFixed(2));
        inventory[key].foilStorePrice = Math.max(Math.round(priceData.foilPrice * dollar * margin), basePriceForCard(item.card, basePrices, "foil"));
      }

      updated++;
      await sleep(150);
    }

    await store.setJSON(INVENTORY_KEY, inventory);

    const nextOffset = offset + limit;
    const done = nextOffset >= allCards.length;

    return json(200, {
      ok: true,
      mode: "batch",
      syncMode,
      offset,
      limit,
      nextOffset,
      done,
      total: allCards.length,
      processed: cards.length,
      uniqueCodes: cards.length,
      updated,
      failedCount: failed.length,
      notFoundCount: notFound.length,
      failed: failed.slice(0, 8),
      notFound: notFound.slice(0, 8),
      debugFailed: failed.slice(0, 8).map(f => ({
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
