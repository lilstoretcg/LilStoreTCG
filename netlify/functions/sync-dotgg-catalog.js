const { normalizeCardCode } = require("./card-code");

const STORE_NAME = "lilstore-catalog";
const { updateState, connectSharedStorage, getSharedStore, requireStrongStorage } = require("./pricing-state");
const DOTGG_CARDS_URL = "https://api.dotgg.gg/cgfw/getcards?game=riftbound&mode=indexed";

const KNOWN_SETS = {
  OGN: "Origins",
  SFD: "Spiritforged",
  UNL: "Unleashed",
  VEN: "Vendetta"
};

const ALLOWED_SET_CODES = new Set([
  "OGN",
  "SFD",
  "UNL",
  "VEN"
]);

const ALLOWED_SET_NAMES = new Set([
  "Origins",
  "Spiritforged",
  "Unleashed",
  "Vendetta"
]);

const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Showcase"];
const RARITY_SET = new Set(RARITIES.map(r => r.toLowerCase()));

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

function shortCode(value = "") {
  return normalizeCardCode(value);
}

function setNameFromCode(code, fallback = "") {
  const prefix = shortCode(code).split("-")[0];
  return KNOWN_SETS[prefix] || fallback || prefix || "Unknown";
}

function setCodeFromCode(code, fallback = "") {
  const prefix = shortCode(code).split("-")[0];
  return prefix || fallback || "UNK";
}

function storeRarity(value) {
  let raw = value;
  if (raw && typeof raw === "object") raw = raw.label || raw.name || raw.value;
  const r = String(raw || "").trim().toLowerCase();

  if (r === "common") return "Common";
  if (r === "uncommon") return "Uncommon";
  if (r === "rare") return "Rare";
  if (r === "epic" || r === "legend" || r === "legendary") return "Epic";
  if (r === "showcase" || r === "signature" || r === "overnumbered" || r === "alternate art") return "Showcase";

  return "Rare";
}

function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.cards)) return payload.cards;
  if (payload && Array.isArray(payload.result)) return payload.result;
  if (payload && Array.isArray(payload.rows)) return payload.rows;

  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload)) {
      if (Array.isArray(value)) return value;
    }
  }

  return [];
}

function normalizeObjectCard(entry) {
  const code =
    shortCode(entry.cardid || entry.cardId || entry.cardID || entry.code || entry.publicCode || entry.id || entry.cardcode);

  if (!code) return null;

  const rawName = entry.name || entry.cardName || entry.title || entry.slugName || "";
  const name = String(rawName || "").trim();
  if (!name) return null;

  const originalRarity =
    entry.rarity?.label || entry.rarity?.name || entry.rarity || entry.rarityName || entry.cardRarity || "";

  const rarity = storeRarity(originalRarity);

  const setCode = setCodeFromCode(code, entry.set || entry.setCode || "");
  const set =
    entry.setName || entry.set?.name || entry.setLabel || KNOWN_SETS[setCode] || setCode;

  const image =
    entry.image || entry.cardImage?.url || entry.cardImage || entry.imageUrl || entry.img || entry.art || entry.thumbnail || "assets/logo.png";

  let displayName = name;
  if (rarity === "Showcase" && !/\(/.test(displayName)) displayName = `${displayName} (Showcase)`;

  return {
    dotggCode: code,
    name: displayName,
    set,
    setCode,
    collectorNumber: entry.collectorNumber || entry.number || null,
    publicCode: code,
    rarity,
    stock: 0,
    status: "soldout",
    marketPrice: 0,
    storePrice: 0,
    requiresManualPrice: false,
    image,
    tcgplayerId: "",
    source: "dotgg-catalog-api",
    cardType: Array.isArray(entry.cardType) ? entry.cardType.map(x => x.label || x.name || x).join(", ") : (entry.cardType || entry.type || ""),
    originalRarity: originalRarity || rarity
  };
}

function normalizeArrayCard(entry) {
  const strings = entry.filter(v => typeof v === "string").map(v => v.trim()).filter(Boolean);

  const sourceCode = strings.find(v => shortCode(v)) || "";
  const code = shortCode(sourceCode);
  if (!code) return null;

  const sourceCodePrefix = String(sourceCode).toUpperCase().split("/")[0];
  const isCardSlug = value =>
    Boolean(sourceCodePrefix) &&
    String(value).toUpperCase().startsWith(`${sourceCodePrefix}-`);

  const image = strings.find(v => /^https?:\/\//i.test(v) && /\.(webp|png|jpg|jpeg)/i.test(v)) || "assets/logo.png";

  const setCode = setCodeFromCode(code);
  const set =
    strings.find(v => Object.values(KNOWN_SETS).includes(v)) ||
    KNOWN_SETS[setCode] ||
    setCode;

  const rarityRaw =
    strings.find(v => RARITY_SET.has(v.toLowerCase())) ||
    strings.find(v => ["Legend", "Legendary", "Signature", "Overnumbered", "Alternate Art"].includes(v)) ||
    "";

  const rarity = storeRarity(rarityRaw);

  const name =
    strings.find(v =>
      v !== code &&
      v !== set &&
      v !== setCode &&
      v !== rarityRaw &&
      !/^https?:\/\//i.test(v) &&
      !shortCode(v) &&
      !isCardSlug(v) &&
      v.length > 1
    ) || "";

  if (!name) return null;

  let displayName = name;
  if (rarity === "Showcase" && !/\(/.test(displayName)) displayName = `${displayName} (Showcase)`;

  const numbers = entry.filter(v => typeof v === "number");
  const collectorNumber = numbers.length ? numbers[0] : null;

  return {
    dotggCode: code,
    name: displayName,
    set,
    setCode,
    collectorNumber,
    publicCode: code,
    rarity,
    stock: 0,
    status: "soldout",
    marketPrice: 0,
    storePrice: 0,
    requiresManualPrice: false,
    image,
    tcgplayerId: "",
    source: "dotgg-catalog-api",
    cardType: "",
    originalRarity: rarityRaw || rarity
  };
}

function normalizeDotGGCard(entry) {
  if (Array.isArray(entry)) return normalizeArrayCard(entry);
  if (entry && typeof entry === "object") return normalizeObjectCard(entry);
  return null;
}

function uniqueCatalogKey(card = {}) {
  const setCode = String(card.setCode || "").toUpperCase().trim();
  const code = shortCode(card.dotggCode || card.publicCode || "");
  return `${setCode}:${code}`;
}

function sortCards(cards) {
  const order = { Origins: 0, Spiritforged: 1, Unleashed: 2, Vendetta: 3 };
  return cards.sort((a, b) =>
    (order[a.set] ?? 99) - (order[b.set] ?? 99) ||
    String(a.set).localeCompare(String(b.set)) ||
    String(a.dotggCode).localeCompare(String(b.dotggCode), undefined, { numeric: true })
  );
}

function mergeCatalog(existingCards, incomingCards) {
  const existingByCode = new Map();
  for (const card of existingCards || []) {
    const code = shortCode(card.publicCode || card.dotggCode || "");
    const queue = existingByCode.get(code) || [];
    queue.push(card);
    existingByCode.set(code, queue);
  }
  let nextId = (existingCards || []).reduce((max, card) => Math.max(max, Number(card.id) || 0), 0) + 1;
  const matchedExisting = new Set();
  const modified = [];
  let added = 0;
  const merged = (incomingCards || []).map(incoming => {
    const code = shortCode(incoming.publicCode || incoming.dotggCode || "");
    const existing = existingByCode.get(code)?.shift();
    if (!existing) { added++; return { ...incoming, id: incoming.id ?? nextId++ }; }
    matchedExisting.add(existing);
    if (["name", "set", "setCode", "rarity", "image", "cardType"].some(field => incoming[field] !== undefined && incoming[field] !== existing[field])) modified.push(code);
    return {
      ...existing, ...incoming,
      id: existing.id ?? incoming.id ?? nextId++,
      publicCode: existing.publicCode || incoming.publicCode,
      stock: existing.stock ?? incoming.stock,
      foilStock: existing.foilStock ?? incoming.foilStock,
      variants: existing.variants ?? incoming.variants,
      marketPrice: existing.marketPrice ?? incoming.marketPrice,
      storePrice: existing.storePrice ?? incoming.storePrice,
      foilMarketPrice: existing.foilMarketPrice ?? incoming.foilMarketPrice,
      foilStorePrice: existing.foilStorePrice ?? incoming.foilStorePrice,
      priceSource: existing.priceSource ?? incoming.priceSource,
      requiresManualPrice: existing.requiresManualPrice ?? incoming.requiresManualPrice,
      tcgplayerId: existing.tcgplayerId || incoming.tcgplayerId,
      cardType: existing.cardType || incoming.cardType
    };
  });
  const missing = (existingCards || []).filter(card => !matchedExisting.has(card));
  return { cards: sortCards([...merged, ...missing]), added, modified, missing };
}

exports.mergeCatalog = mergeCatalog;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });

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

    const response = await fetch(DOTGG_CARDS_URL, {
      headers: {
        "User-Agent": "LilStoreTCG/1.0 catalog sync",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return json(502, { error: `DotGG respondió con estado ${response.status}.` });
    }

    const dotggPayload = await response.json();
    const rawCards = extractArrayPayload(dotggPayload);

    const normalized = [];
    const seen = new Set();
    let duplicateCount = 0;

    for (const raw of rawCards) {
      const card = normalizeDotGGCard(raw);
      if (!card || !card.dotggCode) continue;

      // LilStore solo trabaja con los sets soportados por la tienda.
      if (!ALLOWED_SET_CODES.has(card.setCode) && !ALLOWED_SET_NAMES.has(card.set)) continue;

      const key = uniqueCatalogKey(card);
      if (seen.has(key)) { duplicateCount++; continue; }
      seen.add(key);

      normalized.push(card);
    }

    const sorted = sortCards(normalized);

    const store = getSharedStore(STORE_NAME);
    let mergeReport;
    const operationId = String(payload.operationId || "").trim();
    const catalogState = await updateState(store, current => {
      mergeReport = mergeCatalog(current.cards || [], sorted);
      return { ...current, cards: mergeReport.cards };
    }, operationId);
    if (catalogState._replayedOperationId && catalogState.lastOperation !== operationId) {
      return json(409, { error: "Esta sincronización ya fue confirmada y después hubo otros cambios. Vuelve a ejecutarla con un identificador nuevo." });
    }
    mergeReport ||= { cards: catalogState.cards || [], added: 0, modified: [], missing: [] };

    const bySet = {};
    const byRarity = {};
    for (const card of sorted) {
      bySet[card.set] = (bySet[card.set] || 0) + 1;
      byRarity[card.rarity] = (byRarity[card.rarity] || 0) + 1;
    }


    const namesBySet = {};
    const duplicateCodeGroups = {};
    const invalidCards = [];

    for (const card of sorted) {
      const normalizedName = String(card.name || "")
        .replace(/\s*\(Showcase\)\s*$/i, "")
        .trim()
        .toLowerCase();

      if (!namesBySet[normalizedName]) namesBySet[normalizedName] = new Set();
      namesBySet[normalizedName].add(card.setCode || card.set || "UNK");

      const codeKey = shortCode(card.publicCode || card.dotggCode || "");
      if (!duplicateCodeGroups[codeKey]) duplicateCodeGroups[codeKey] = [];
      duplicateCodeGroups[codeKey].push({
        name: card.name,
        set: card.set,
        setCode: card.setCode
      });

      if (!card.name || !card.setCode || !codeKey) {
        invalidCards.push({
          name: card.name || "",
          set: card.set || "",
          setCode: card.setCode || "",
          code: codeKey || ""
        });
      }
    }

    const duplicateNameGroups = Object.entries(namesBySet)
      .filter(([, setCodes]) => setCodes.size > 1)
      .map(([name, setCodes]) => ({
        name,
        sets: Array.from(setCodes).sort()
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const duplicateCodes = Object.entries(duplicateCodeGroups)
      .filter(([, entries]) => entries.length > 1)
      .map(([code, entries]) => ({ code, entries }));

    return json(200, {
      ok: true,
      source: DOTGG_CARDS_URL,
      rawCount: rawCards.length,
      saved: sorted.length,
      added: mergeReport.added,
      modified: mergeReport.modified.length,
      modifiedCodes: mergeReport.modified,
      retainedMissing: mergeReport.missing.length,
      missingCodes: mergeReport.missing.map(card => card.publicCode || card.dotggCode),
      bySet,
      byRarity,
      duplicateCount,
      duplicateNameGroups,
      duplicateCodes,
      invalidCards,
      integrity: {
        uniqueBySetAndCode: duplicateCodes.length === 0,
        totalUnique: sorted.length,
        duplicateNameGroupCount: duplicateNameGroups.length,
        duplicateCodeCount: duplicateCodes.length,
        invalidCardCount: invalidCards.length
      },
      sample: sorted.slice(0, 3)
    });
  } catch (error) {
    return json(500, {
      error: "Error interno sincronizando catálogo DotGG.",
      message: error.message || String(error)
    });
  }
};
