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

    // DotGG a veces devuelve only Foil para cartas no common/uncommon.
    // Si normal no existe, foil sirve como precio de mercado principal.
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
        "User-Agent": "LilStoreTCG/2.0 price sync slow",
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    // DotGG puede responder 429 como HTML.
    if (response.status === 429 && attempt <= 4) {
      const waitMs = 2500 * attempt;
      await sleep(waitMs);
      return fetchDotGG(cardId, attempt + 1);
    }

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
      // Si aparece HTML 429 aunque status venga raro.
      if (/429|too many requests/i.test(text) && attempt <= 4) {
        const waitMs = 2500 * attempt;
        await sleep(waitMs);
        return fetchDotGG(cardId, attempt + 1);
      }

      return {
        ok: false,
        cardId,
        status: "BAD_JSON",
        message: error.message || String(error),
        sample: text.slice(0, 600)
      };
    }

    const prices = extractPrices(payload);

    if (!prices.effectivePrice) {
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
      normalPrice: prices.normalPrice,
      foilPrice: prices.foilPrice,
      effectivePrice: prices.effectivePrice,
      payloadCardId: payload?.cardid || payload?.cardId || null
    };
  } catch (error) {
    if (attempt <= 3) {
      await sleep(1000 * attempt);
      return fetchDotGG(cardId, attempt + 1);
    }

    return {
      ok: false,
      cardId,
      status: "FETCH_ERROR",
      message: error.message || String(error)
    };
  }
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

    const uniqueByCode = new Map();
    for (const item of candidates) {
      if (!uniqueByCode.has(item.cardId)) uniqueByCode.set(item.cardId, item);
    }

    const uniqueItems = Array.from(uniqueByCode.values());

    const store = getStore(STORE_NAME);
    const inventory = await store.get(INVENTORY_KEY, { type: "json" }) || {};

    const resultMap = {};
    const failed = [];

    // Modo lento: 1 consulta a la vez + pausa.
    // Esto evita 429 y prioriza completitud por sobre velocidad.
    for (let i = 0; i < uniqueItems.length; i++) {
      const item = uniqueItems[i];
      const result = await fetchDotGG(item.cardId);

      if (result.ok) {
        resultMap[item.cardId] = result;
      } else {
        failed.push(result);
      }

      await sleep(350);
    }

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

      // Precio principal:
      // - normal si existe
      // - si normal no existe, usar foil como respaldo de mercado
      const market = priceData.normalPrice || priceData.effectivePrice;
      if (market) {
        inventory[key].marketPrice = Number(market.toFixed(2));
        inventory[key].storePrice = Math.round(market * dollar * margin);
      }

      // Precio foil solo aplica a common/uncommon.
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
      mode: "slow-429-safe",
      uniqueCodes: uniqueItems.length,
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
