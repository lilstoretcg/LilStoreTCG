const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "lilstore-catalog";
const CATALOG_KEY = "cards";
const DOTGG_CARDS_URL = "https://api.dotgg.gg/cgfw/getcards?game=riftbound&mode=indexed";

const KNOWN_SETS = {
  OGN: "Origins",
  SFD: "Spiritforged",
  UNL: "Unleashed"
};

const ALLOWED_SET_CODES = new Set(["OGN", "SFD", "UNL"]);
const ALLOWED_SET_NAMES = new Set(["Origins", "Spiritforged", "Unleashed"]);

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
  const match = String(value).toUpperCase().match(/([A-Z]{3})-(\d{3}[A-Z]?)/);
  return match ? `${match[1]}-${match[2]}` : "";
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
    image,
    tcgplayerId: "",
    source: "dotgg-catalog-api",
    cardType: Array.isArray(entry.cardType) ? entry.cardType.map(x => x.label || x.name || x).join(", ") : (entry.cardType || entry.type || ""),
    originalRarity: originalRarity || rarity
  };
}

function normalizeArrayCard(entry) {
  const strings = entry.filter(v => typeof v === "string").map(v => v.trim()).filter(Boolean);

  const code = shortCode(strings.find(v => shortCode(v)) || "");
  if (!code) return null;

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

function sortCards(cards) {
  const order = { Origins: 0, Spiritforged: 1, Unleashed: 2 };
  return cards.sort((a, b) =>
    (order[a.set] ?? 99) - (order[b.set] ?? 99) ||
    String(a.set).localeCompare(String(b.set)) ||
    String(a.dotggCode).localeCompare(String(b.dotggCode), undefined, { numeric: true })
  );
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

    const existingCards = Array.isArray(payload.currentCards) ? payload.currentCards : [];
    const preservePublicCodeByShortCode = {};
    const preserveDataByShortCode = {};

    for (const card of existingCards) {
      const code = shortCode(card.publicCode || card.dotggCode || "");
      if (!code) continue;
      preservePublicCodeByShortCode[code] = card.publicCode || code;
      preserveDataByShortCode[code] = {
        tcgplayerId: card.tcgplayerId || "",
        cardType: card.cardType || ""
      };
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

    for (const raw of rawCards) {
      const card = normalizeDotGGCard(raw);
      if (!card || !card.dotggCode) continue;

      // LilStore solo trabaja sets conseguibles: Origins, Spiritforged y Unleashed.
      if (!ALLOWED_SET_CODES.has(card.setCode) && !ALLOWED_SET_NAMES.has(card.set)) continue;

      const key = card.dotggCode;
      if (seen.has(key)) continue;
      seen.add(key);

      card.publicCode = preservePublicCodeByShortCode[key] || card.publicCode;
      if (preserveDataByShortCode[key]) {
        card.tcgplayerId = preserveDataByShortCode[key].tcgplayerId || "";
        card.cardType = card.cardType || preserveDataByShortCode[key].cardType || "";
      }

      normalized.push(card);
    }

    const sorted = sortCards(normalized).map((card, index) => ({ ...card, id: index + 1 }));

    const store = getStore(STORE_NAME);
    await store.setJSON(CATALOG_KEY, sorted);

    const bySet = {};
    const byRarity = {};
    for (const card of sorted) {
      bySet[card.set] = (bySet[card.set] || 0) + 1;
      byRarity[card.rarity] = (byRarity[card.rarity] || 0) + 1;
    }

    return json(200, {
      ok: true,
      source: DOTGG_CARDS_URL,
      rawCount: rawCards.length,
      saved: sorted.length,
      bySet,
      byRarity,
      sample: sorted.slice(0, 3)
    });
  } catch (error) {
    return json(500, {
      error: "Error interno sincronizando catálogo DotGG.",
      message: error.message || String(error)
    });
  }
};
