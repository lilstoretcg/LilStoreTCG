const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-inventory";
const INVENTORY_KEY = "inventory";
const PRICES_URL = "https://riftbound.gg/prices/";

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
  const match = String(publicCode).toLowerCase().match(/([a-z]{3})-(\d{3}[a-z]?)/i);
  return match ? `${match[1]}-${match[2]}` : "";
}

function keyFor(card) {
  return card.publicCode || `${card.setCode || card.set}-${card.name}`;
}

function parsePricesFromHtml(html) {
  const prices = {};
  const clean = String(html || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#36;/g, "$")
    .replace(/\s+/g, " ");

  const codeRegex = /\b(ogn|sfd|unl|ogs)-(\d{3}[a-z]?)\b/gi;
  let match;

  while ((match = codeRegex.exec(clean)) !== null) {
    const code = `${match[1].toLowerCase()}-${match[2].toLowerCase()}`;
    const after = clean.slice(match.index, match.index + 900);
    const dollarMatch = after.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);

    if (dollarMatch) {
      const price = Number(dollarMatch[1]);
      if (Number.isFinite(price) && price > 0) {
        if (!prices[code] || price > prices[code]) prices[code] = price;
      }
      continue;
    }

    const decimalMatch = after.match(/\b([0-9]+\.[0-9]{2})\b/);
    if (decimalMatch) {
      const price = Number(decimalMatch[1]);
      if (Number.isFinite(price) && price > 0) {
        if (!prices[code] || price > prices[code]) prices[code] = price;
      }
    }
  }

  return prices;
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

    const response = await fetch(PRICES_URL, {
      headers: {
        "User-Agent": "LilStoreTCG/1.0 price sync",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      return json(502, { error: `Riftbound.gg respondió con estado ${response.status}.` });
    }

    const html = await response.text();
    const priceMap = parsePricesFromHtml(html);

    const store = getStore(STORE_NAME);
    const current = await store.get(INVENTORY_KEY, { type: "json" });
    const inventory = current || {};

    let updated = 0;
    const notFound = [];

    for (const card of cards) {
      const code = shortCode(card.publicCode);
      if (!code) continue;

      const price = priceMap[code];

      if (!price) {
        notFound.push({ publicCode: card.publicCode, name: card.name });
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
      source: PRICES_URL,
      pricesDetected: Object.keys(priceMap).length,
      updated,
      notFoundCount: notFound.length,
      notFound: notFound.slice(0, 30),
      dollar,
      margin
    });
  } catch (error) {
    return json(500, {
      error: "Error interno sincronizando precios.",
      message: error.message || String(error)
    });
  }
};
