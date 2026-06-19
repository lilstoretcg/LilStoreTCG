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

function latestPriceFromHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const sorted = [...history].sort((a, b) => Number(a.date || 0) - Number(b.date || 0));
  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i];
    const candidates = [row.Normal, row.closePrice, row.openPrice, row.highPrice, row.lowPrice];
    for (const value of candidates) {
      const price = Number(value);
      if (Number.isFinite(price) && price > 0) return price;
    }
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
  if (!response.ok) return { ok: false, cardId, status: response.status };
  const history = await response.json();
  const price = latestPriceFromHistory(history);
  if (!price) return { ok: false, cardId, status: "NO_PRICE" };
  return { ok: true, cardId, price };
}

async function asyncPool(limit, items, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    const e = p.then(() => executing.splice(executing.indexOf(e), 1));
    executing.push(e);
    if (executing.length >= limit) await Promise.race(executing);
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
    if (!cards.length) return json(400, { error: "No se recibieron cartas para actualizar." });

    const cardsWithCodes = cards
      .map(card => ({ ...card, dotggId: shortCode(card.publicCode) }))
      .filter(card => card.dotggId);

    const uniqueCodes = [...new Set(cardsWithCodes.map(card => card.dotggId))];
    const priceResults = await asyncPool(8, uniqueCodes, getDotGGPrice);

    const priceMap = {};
    const failed = [];
    for (const result of priceResults) {
      if (result.ok) priceMap[result.cardId] = result.price;
      else failed.push(result);
    }

    const store = getStore(STORE_NAME);
    const current = await store.get(INVENTORY_KEY, { type: "json" });
    const inventory = current || {};

    let updated = 0;
    const notFound = [];

    for (const card of cardsWithCodes) {
      const price = priceMap[card.dotggId];
      if (!price) {
        notFound.push({ publicCode: card.publicCode, cardid: card.dotggId, name: card.name });
        continue;
      }

      const key = keyFor(card);
      if (typeof inventory[key] === "number") inventory[key] = { stock: inventory[key] };
      inventory[key] = inventory[key] || {};
      inventory[key].stock = Number(inventory[key].stock ?? card.stock ?? 0);
      inventory[key].marketPrice = Number(price.toFixed(2));
      inventory[key].storePrice = Math.round(price * dollar * margin);
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
      failed: failed.slice(0, 20),
      notFound: notFound.slice(0, 20),
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
