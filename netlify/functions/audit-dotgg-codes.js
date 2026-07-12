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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeCode(raw = "") {
  const text = String(raw || "").toUpperCase().trim();
  const match = text.match(/([A-Z]{3})[-\s]?([A-Z]?\d{2,3}[A-Z]?)/);
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

function findPrice(payload) {
  const rows = extractRows(payload);

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i] || {};
    const candidates = [
      row.closePrice,
      row.openPrice,
      row.highPrice,
      row.lowPrice,
      row.marketPrice,
      row.price,
      row.normalPrice,
      row.Normal,
      row.normal
    ];

    for (const value of candidates) {
      const price = toNumber(value);
      if (price) return price;
    }
  }

  return null;
}

async function testCode(cardId) {
  const url = `${DOTGG_PRICE_URL}?game=riftbound&cardid=${encodeURIComponent(cardId)}&cache=${Date.now()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LilStoreTCG/2.0 code audit",
        "Accept": "application/json"
      }
    });

    const text = await response.text();
    let payload = null;

    try {
      payload = JSON.parse(text);
    } catch {
      return {
        ok: false,
        cardId,
        status: "BAD_JSON",
        price: null,
        sample: text.slice(0, 300)
      };
    }

    const price = findPrice(payload);

    return {
      ok: Boolean(response.ok && price),
      cardId,
      status: response.status,
      price,
      payloadCardId: payload?.cardid || payload?.cardId || "",
      sample: JSON.stringify(payload).slice(0, 300)
    };
  } catch (error) {
    return {
      ok: false,
      cardId,
      status: "FETCH_ERROR",
      price: null,
      sample: error.message || String(error)
    };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });

  try {
    let payload;

    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "JSON inválido." });
    }

    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    const limit = Math.min(Math.max(Number(payload.limit || 80), 1), 200);
    const offset = Math.max(Number(payload.offset || 0), 0);

    const selected = cards.slice(offset, offset + limit);

    const results = [];

    for (const card of selected) {
      const codes = possibleCodes(card);
      const sentCode = codes[0] || "";

      if (!sentCode) {
        results.push({
          name: card.name || "",
          publicCode: card.publicCode || "",
          dotggCode: card.dotggCode || "",
          sentCode: "",
          found: false,
          status: "NO_CODE",
          price: null,
          payloadCardId: "",
          sample: ""
        });
        continue;
      }

      const result = await testCode(sentCode);

      results.push({
        name: card.name || "",
        publicCode: card.publicCode || "",
        dotggCode: card.dotggCode || "",
        sentCode,
        found: result.ok,
        status: result.status,
        price: result.price,
        payloadCardId: result.payloadCardId,
        sample: result.sample
      });

      await sleep(80);
    }

    const found = results.filter(r => r.found).length;
    const missing = results.length - found;

    return json(200, {
      ok: true,
      offset,
      limit,
      checked: results.length,
      found,
      missing,
      results,
      missingSamples: results.filter(r => !r.found).slice(0, 20)
    });
  } catch (error) {
    return json(500, {
      error: "Error interno auditando códigos DotGG.",
      message: error.message || String(error),
      stack: error.stack || ""
    });
  }
};
