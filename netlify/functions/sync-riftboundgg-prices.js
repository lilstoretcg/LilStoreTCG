const { getStore, connectLambda } = require("@netlify/blobs");
const STORE_NAME = "lilstore-inventory";
const INVENTORY_KEY = "inventory";
const DOTGG_PRICE_URL = "https://api.dotgg.gg/cgfw/getcardprices";
function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type, x-admin-pin", "Access-Control-Allow-Methods":"POST, OPTIONS" }, body: JSON.stringify(body) };
}
function shortCode(publicCode="") { const match = String(publicCode).toUpperCase().match(/([A-Z]{3})-(\d{3}[A-Z]?)/); return match ? `${match[1]}-${match[2]}` : ""; }
function keyFor(card) { return card.publicCode || `${card.setCode || card.set}-${card.name}`; }
function toNumber(value) { if (value === null || value === undefined) return null; const n = Number(String(value).replace(",", ".").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; }
function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.prices)) return payload.prices;
  if (payload && Array.isArray(payload.history)) return payload.history;
  if (payload && Array.isArray(payload.result)) return payload.result;
  if (payload && typeof payload === "object") { for (const v of Object.values(payload)) if (Array.isArray(v)) return v; }
  return [];
}
function latestPriceFromHistory(payload) {
  const rows = extractRows(payload);
  if (!rows.length) return null;
  const normalized = rows.filter(r => r && typeof r === "object").sort((a,b)=>Number(a.date||a.timestamp||0)-Number(b.date||b.timestamp||0));
  for (let i = normalized.length - 1; i >= 0; i--) {
    const row = normalized[i];
    const candidates = [row.Normal, row.normal, row.marketPrice, row.market, row.price, row.closePrice, row.openPrice, row.highPrice, row.lowPrice];
    for (const value of candidates) { const price = toNumber(value); if (price) return price; }
  }
  return null;
}
async function getDotGGPrice(cardId) {
  const url = `${DOTGG_PRICE_URL}?game=riftbound&cardid=${encodeURIComponent(cardId)}&cache=${Date.now()}`;
  const response = await fetch(url, { headers: { "User-Agent":"LilStoreTCG/1.0 price sync", "Accept":"application/json" }});
  if (!response.ok) return { ok:false, cardId, status:response.status };
  const payload = await response.json();
  const price = latestPriceFromHistory(payload);
  if (!price) return { ok:false, cardId, status:"NO_PRICE", sample: JSON.stringify(payload).slice(0,300) };
  return { ok:true, cardId, price };
}
async function asyncPool(limit, items, fn) { const ret=[]; const executing=[]; for (const item of items) { const p=Promise.resolve().then(()=>fn(item)); ret.push(p); const e=p.then(()=>executing.splice(executing.indexOf(e),1)); executing.push(e); if (executing.length>=limit) await Promise.race(executing); } return Promise.all(ret); }
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok:true });
  if (event.httpMethod !== "POST") return json(405, { error:"Método no permitido." });
  try {
    connectLambda(event);
    const adminPin = process.env.ADMIN_PIN || "";
    const receivedPin = event.headers["x-admin-pin"] || event.headers["X-Admin-Pin"] || "";
    if (!adminPin) return json(500, { error:"Falta configurar ADMIN_PIN en Netlify." });
    if (receivedPin !== adminPin) return json(401, { error:"PIN incorrecto." });
    let payload; try { payload = JSON.parse(event.body || "{}"); } catch { return json(400, { error:"JSON inválido." }); }
    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    const dollar = Number(payload.dollar || 900);
    const margin = Number(payload.margin || 1);
    if (!cards.length) return json(400, { error:"No se recibieron cartas para actualizar." });
    const cardsWithCodes = cards.map(card => ({ ...card, dotggId: shortCode(card.publicCode) })).filter(card => card.dotggId);
    const uniqueCodes = [...new Set(cardsWithCodes.map(card => card.dotggId))];
    const priceResults = await asyncPool(8, uniqueCodes, getDotGGPrice);
    const priceMap = {}; const failed = [];
    for (const r of priceResults) { if (r.ok) priceMap[r.cardId] = r.price; else failed.push(r); }
    const store = getStore(STORE_NAME);
    const current = await store.get(INVENTORY_KEY, { type:"json" });
    const inventory = current || {};
    let updated=0; const notFound=[];
    for (const card of cardsWithCodes) {
      const price = priceMap[card.dotggId];
      if (!price) { notFound.push({ publicCode:card.publicCode, cardid:card.dotggId, name:card.name }); continue; }
      const key = keyFor(card);
      if (typeof inventory[key] === "number") inventory[key] = { stock: inventory[key] };
      inventory[key] = inventory[key] || {};
      inventory[key].stock = Number(inventory[key].stock ?? card.stock ?? 0);
      inventory[key].marketPrice = Number(price.toFixed(2));
      inventory[key].storePrice = Math.round(price * dollar * margin);
      updated++;
    }
    await store.setJSON(INVENTORY_KEY, inventory);
    return json(200, { ok:true, source:DOTGG_PRICE_URL, uniqueCodes:uniqueCodes.length, updated, failedCount:failed.length, notFoundCount:notFound.length, failed:failed.slice(0,10), notFound:notFound.slice(0,10), dollar, margin });
  } catch (error) { return json(500, { error:"Error interno sincronizando precios DotGG.", message:error.message || String(error) }); }
};
