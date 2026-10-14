const { normalizeCardCode } = require("./card-code");

const CATALOG_STORE = "lilstore-catalog";

const SETTINGS_STORE = "lilstore-settings";
const BASE_PRICES_KEY = "base-prices";
const { applyPricing, applyDotggQuote, readState, updateState, connectSharedStorage, getSharedStore, requireStrongStorage } = require("./pricing-state");

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

function supportsFoil(card) {
  return ["common", "uncommon"].includes(String(card.rarity || "").toLowerCase());
}

function normalizeCode(raw = "") {
  return normalizeCardCode(raw);
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

    if (normalized && !out.includes(normalized)) {
      out.push(normalized);
    }
  }

  // Respaldo usando setCode + collectorNumber
  if (card.setCode && card.collectorNumber) {

    const fallback =
      `${String(card.setCode).toUpperCase()}-${String(card.collectorNumber).padStart(3, "0")}`;

    if (!out.includes(fallback)) {
      out.push(fallback);
    }

  }

  return out;
}
function findCatalogCard(catalog, card = {}) {

  const searchCodes = possibleCodes(card);

  return catalog.find(catalogCard => {

    const catalogCodes = possibleCodes(catalogCard);

    if (catalogCodes.some(code => searchCodes.includes(code))) {
      return true;
    }

    if (
      Number(catalogCard.collectorNumber) === Number(card.collectorNumber) &&
      String(catalogCard.setCode || "").toUpperCase() ===
      String(card.setCode || "").toUpperCase()
    ) {
      return true;
    }

    return false;

  }) || null;

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

function extractPricesFromRows(rows) {
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

function extractPrices(payload) {
  const usdPrices = extractPricesFromRows(extractRows(payload));
  if (usdPrices.effectivePrice) return usdPrices;

  return extractPricesFromRows(Array.isArray(payload?.lines_cm) ? payload.lines_cm : []);
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
    const settingsStore = getSharedStore(SETTINGS_STORE);
    return await settingsStore.get(BASE_PRICES_KEY, { type: "json" }) || defaultBasePrices();
  } catch {
    return defaultBasePrices();
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
    connectSharedStorage(event);

    const adminPin = process.env.ADMIN_PIN || "";
    const receivedPin = event.headers["x-admin-pin"] || event.headers["X-Admin-Pin"] || "";

    if (!adminPin) return json(500, { error: "Falta configurar ADMIN_PIN en Netlify." });
    if (receivedPin !== adminPin) return json(401, { error: "PIN incorrecto." });
    requireStrongStorage();

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "JSON inválido." });
    }

    const allCards = Array.isArray(payload.cards) ? payload.cards : [];
    const offset = Math.max(0, Number(payload.offset || 0));
    const limit = Math.min(Math.max(1, Number(payload.limit || 25)), 40);
    const dollar = Number(payload.dollar ?? 900);
    const margin = Number(payload.margin ?? 1);
    const expectedPricingVersion = Number(payload.expectedPricingVersion);
    const priorFailedCount = Math.max(0, Number(payload.priorFailedCount || 0));
    const syncMode = String(payload.syncMode || "all");

    if (!allCards.length) {
      return json(400, { error: "No se recibieron cartas para actualizar." });
    }
    if (!Number.isFinite(dollar) || dollar < 1 || dollar > 100000 || !Number.isFinite(margin) || margin < 0 || margin > 100 || !Number.isInteger(expectedPricingVersion) || expectedPricingVersion < 0) {
      return json(400, { error: "Configuración de precios inválida o desactualizada." });
    }

    const cards = allCards.slice(offset, offset + limit);

    const candidates = [];

    for (const card of cards) {
      const codes = possibleCodes(card);
      if (!codes.length) continue;

      candidates.push({
        card,
        cardId: codes[0],
        catalogCode: normalizeCode(card.publicCode || card.dotggCode)
      });
    }

    const catalogStore = getSharedStore(CATALOG_STORE);

const { state: catalogState } = await readState(catalogStore);
const catalog = catalogState.cards || [];
    if (Number(catalogState.pricingVersion || 0) !== expectedPricingVersion) {
      return json(409, { error: "La configuración de precios cambió antes de iniciar la sincronización. Recarga el administrador e inténtalo de nuevo." });
    }

    const basePrices = await getBasePrices();
    const legacyPricing = await getSharedStore(SETTINGS_STORE).get("pricing", { type: "json" });
    let updated = 0;
    const updatedCatalogCodes = new Set();
    const failed = [];
    const noPrice = [];

    for (const item of candidates) {
      const priceData = await fetchDotGG(item.cardId);
      const catalogCard = findCatalogCard(catalog, item.card);

      if (!priceData.ok) {
        if (priceData.status === "NO_PRICE") {
          if (catalogCard && catalogCard.priceSource !== "manual") {
            catalogCard.requiresManualPrice = true;
            updatedCatalogCodes.add(normalizeCode(catalogCard.publicCode || catalogCard.dotggCode));
          }
          noPrice.push({
            publicCode: item.card.publicCode,
            dotggCode: item.card.dotggCode,
            cardid: item.cardId,
            name: item.card.name
          });
        } else {
          failed.push(priceData);
        }

        await sleep(150);
        continue;
      }

      if (item.card.publicCode === "SFD-247") {
      console.log("MATCH", {
        buscada: item.card.publicCode,
        encontrada: catalogCard?.publicCode,
        nombre: catalogCard?.name
     });
   }


     const market = priceData.normalPrice || priceData.effectivePrice;

if (item.card.publicCode === "SFD-247") {
  console.log("WRITE", {
    buscada: item.card.publicCode,
    encontrada: catalogCard?.publicCode,
    antes: catalogCard?.marketPrice,
    nuevo: market
  });
}

if (catalogCard && market) {
  const quoteResult = applyDotggQuote(catalogCard, priceData, { dollar, margin }, basePrices, supportsFoil(item.card));
  if (quoteResult.changed) {
    Object.assign(catalogCard, quoteResult.card);
    updated++;
    updatedCatalogCodes.add(normalizeCode(catalogCard.publicCode || catalogCard.dotggCode));
  }
  await sleep(150);

}

}

    const done = offset + limit >= allCards.length;
    const operationPricing = { dollar, margin };
    const verifyState = await updateState(catalogStore, current => {
      if (Number(current.pricingVersion || 0) !== expectedPricingVersion) {
        const error = new Error("La configuración de precios cambió durante la sincronización. Vuelve a cargar el administrador e inténtalo de nuevo.");
        error.statusCode = 409;
        throw error;
      }
      const sourceByCode = new Map(catalog.map(card => [normalizeCode(card.publicCode || card.dotggCode), card]));
      const merged = (current.cards || []).map(card => {
        const code = normalizeCode(card.publicCode || card.dotggCode);
        const source = sourceByCode.get(code);
        if (!source || !updatedCatalogCodes.has(code) || card.priceSource === "manual") return card;
        return { ...card, marketPrice: source.marketPrice, foilMarketPrice: source.foilMarketPrice, priceSource: source.priceSource, requiresManualPrice: source.requiresManualPrice };
      });
      const publishPricing = done && failed.length === 0 && priorFailedCount === 0;
      const currentPricing = Number(current.pricingVersion || 0) === 0 ? (legacyPricing || current.pricing || { dollar, margin }) : (current.pricing || { dollar, margin });
      const pricing = publishPricing ? operationPricing : currentPricing;
      return { ...current, pricing, pricingVersion: Number(current.pricingVersion || 0) + (publishPricing ? 1 : 0), cards: applyPricing(merged, pricing, basePrices) };
    }, String(payload.operationId || `dotgg-${offset}-${Date.now()}-${Math.random()}`));
    if (verifyState._replayedOperationId && verifyState.lastOperation !== payload.operationId) {
      return json(409, { error: "Este lote ya se aplicó y el catálogo cambió después. Reinicia la sincronización con datos actualizados." });
    }

const verify = verifyState.cards;

const saved = verify.find(c => c.publicCode === "SFD-247");

console.log("VERIFY", {
  market: saved?.marketPrice,
  store: saved?.storePrice
});

    const nextOffset = offset + limit;
    const pricingApplied = done && failed.length === 0 && priorFailedCount === 0;

    return json(200, {
      ok: true,
      mode: "batch",
      syncMode,
      offset,
      limit,
      nextOffset,
      done,
      pricingApplied,
      total: allCards.length,
      processed: cards.length,
      uniqueCodes: cards.length,
      updated,
      failedCount: failed.length,
      technicalErrorCount: failed.length,
      notFoundCount: noPrice.length,
      noPriceCount: noPrice.length,
      failed: failed.slice(0, 8),
      noPrice: noPrice.slice(0, 20),
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
    const statusCode = Number(error.statusCode) || 500;
    return json(statusCode, {
      error: statusCode === 409 ? error.message : "Error interno sincronizando precios DotGG.",
      message: error.message || String(error),
      stack: error.stack || "",
      name: error.name || "Error"
    });
  }
};
