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
  return card.publicCode || `${card.setCode || card.set}-${card.name}`;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(",", ".").replace(/[^0-9.\-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;

  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.prices)) return payload.prices;
  if (payload && Array.isArray(payload.history)) return payload.history;
  if (payload && Array.isArray(payload.result)) return payload.result;
  if (payload && Array.isArray(payload.rows)) return payload.rows;

  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload)) {
      if (Array.isArray(value)) return value;
    }

    // DotGG sometimes returns one single object instead of an array.
    // Example: { cardid, fromdate, todate, Normal, Foil, ... }
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

async function getDotGGPrice(cardId) {
  const url = `${DOTGG_PRICE_URL}?game=riftbound&cardid=${encodeURIComponent(cardId)}&cache=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "LilStoreTCG/1.0 price sync",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    return { ok: false, cardId, status: response.status };
  }

  const payload = await response.json();
  const rows = extractRows(payload);
  let normalPrice = null;
  let foilPrice = null;

  const normalized = rows
    .filter(row => row && typeof row === "object")
    .sort((a, b) => Number(a.date || a.timestamp || a.todate || 0) - Number(b.date || b.timestamp || b.todate || 0));

  for (let i = normalized.length - 1; i >= 0; i--) {
    const row = normalized[i];

    if (!normalPrice) {
      normalPrice = findPriceDeep({
        Normal: row.Normal,
        normal: row.normal,
        tcgplayerPrice: row.tcgplayerPrice,
        tcgPlayerPrice: row.tcgPlayerPrice,
        marketPrice: row.marketPrice,
        market: row.market,
        price: row.price,
        closePrice: row.closePrice,
        openPrice: row.openPrice,
        highPrice: row.highPrice,
        lowPrice: row.lowPrice
      });
    }

    if (!foilPrice) {
      foilPrice = findPriceDeep({
        Foil: row.Foil,
        foil: row.foil,
        Holofoil: row.Holofoil,
        holofoil: row.holofoil,
        ColdFoil: row.ColdFoil,
        coldfoil: row.coldfoil
      });
    }

    if (normalPrice && foilPrice) break;
  }

  const price = normalPrice || foilPrice || null;

  if (!price) {
    return {
      ok: false,
      cardId,
      status: "NO_PRICE",
      sample: JSON.stringify(payload).slice(0, 700)
    };
  }

  return { ok: true, cardId, price, normalPrice, foilPrice };
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

exports.handler = async (event) => {
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

    const cardsWithCodes = cards
      .map(card => ({ ...card, dotggId: shortCode(card.publicCode) }))
      .filter(card => card.dotggId);

    const uniqueCodes = [...new Set(cardsWithCodes.map(card => card.dotggId))];
    const priceResults = await asyncPool(8, uniqueCodes, getDotGGPrice);

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
      inventory[key].foilStock = Number(inventory[key].foilStock ?? card.foilStock ?? 0);

      if (priceData.normalPrice) {
        inventory[key].marketPrice = Number(priceData.normalPrice.toFixed(2));
        inventory[key].storePrice = Math.round(priceData.normalPrice * dollar * margin);
      } else {
        inventory[key].marketPrice = Number(price.toFixed(2));
        inventory[key].storePrice = Math.round(price * dollar * margin);
      }

      if (priceData.foilPrice) {
        inventory[key].foilMarketPrice = Number(priceData.foilPrice.toFixed(2));
        inventory[key].foilStorePrice = Math.round(priceData.foilPrice * dollar * margin);
      }

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
      notFound: notFound.slice(0, 10),
      dollar,
      margin
    });
  } catch (error) {
    return json(500, {
      error: "Error interno sincronizando precios DotGG.",
      message: error.message || String(error)
    });
  }
};
