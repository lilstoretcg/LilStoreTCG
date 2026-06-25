const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const USD_TO_CLP = Number(process.env.USD_TO_CLP || 900);
const STORE_MULTIPLIER = Number(process.env.STORE_MULTIPLIER || 0.95);

const excelPath = path.join(process.cwd(), "stock.xlsx");
const cardsPath = path.join(process.cwd(), "data", "cards.json");
const masterPath = path.join(process.cwd(), "data", "cards-master.json");

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase();
}

if (!fs.existsSync(excelPath)) {
  console.error("No se encontró stock.xlsx en la carpeta principal del proyecto.");
  console.error("Asegúrate de guardar el Excel con el nombre stock.xlsx.");
  process.exit(1);
}

if (!fs.existsSync(cardsPath)) {
  console.error("No se encontró data/cards.json.");
  process.exit(1);
}

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames.includes("Stock") ? "Stock" : workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const stockByPublicCode = new Map();

for (const row of rows) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }

  const publicCode = String(normalized["public code"] || "").trim();
  if (!publicCode) continue;

  stockByPublicCode.set(publicCode, {
    stock: Math.max(0, Math.floor(toNumber(normalized["stock"], 0))),
    marketPrice: Math.max(0, toNumber(normalized["market usd"], 0))
  });
}

const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
let updated = 0;

const updatedCards = cards.map(card => {
  const publicCode = String(card.publicCode || "").trim();
  const stockInfo = stockByPublicCode.get(publicCode);

  if (!stockInfo) return card;

  updated++;

  const marketPrice = stockInfo.marketPrice;
  const storePrice = marketPrice > 0
    ? Math.round(marketPrice * USD_TO_CLP * STORE_MULTIPLIER)
    : 0;

  return {
    ...card,
    stock: stockInfo.stock,
    status: stockInfo.stock > 0 ? "available" : "soldout",
    marketPrice,
    storePrice
  };
});

fs.writeFileSync(cardsPath, JSON.stringify(updatedCards, null, 2), "utf8");
fs.writeFileSync(masterPath, JSON.stringify(updatedCards, null, 2), "utf8");

console.log("Stock actualizado correctamente.");
console.log(`Cartas leídas desde stock.xlsx: ${stockByPublicCode.size}`);
console.log(`Cartas actualizadas en cards.json: ${updated}`);
console.log(`Dólar fijo: ${USD_TO_CLP} CLP`);
console.log(`Multiplicador LilStore: ${STORE_MULTIPLIER}`);
