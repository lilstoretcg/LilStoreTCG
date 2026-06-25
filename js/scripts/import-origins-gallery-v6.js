/**
 * LilStore TCG v6 - Importador Origins por filtro visual
 *
 * Este importador abre la galería oficial en un navegador.
 * Tú seleccionas manualmente el filtro "Origins" en la página oficial,
 * esperas que carguen las cartas y luego vuelves a la terminal para continuar.
 *
 * Comandos:
 *   npm install
 *   npx playwright install chromium
 *   npm run import:origins
 *
 * Resultado:
 *   data/origins-import-review.json
 *
 * Luego ese archivo se revisa y se transforma en cards-master.json definitivo.
 */

const fs = require("fs/promises");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const GALLERY_URL = "https://riftbound.leagueoflegends.com/es-es/card-gallery/";
const OUT_PATH = path.join(process.cwd(), "data", "origins-import-review.json");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => {
    rl.close();
    resolve(ans);
  }));
}

function cleanName(name) {
  return String(name || "")
    .replace(/^Riftbound\s+(Unit|Spell|Gear|Legend|Battlefield|None)\s*:\s*/i, "")
    .replace(/\s*\[[^\]]+\].*$/g, "")
    .replace(/\.\s.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function autoScroll(page) {
  let lastCount = 0;
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    const count = await page.evaluate(() => document.querySelectorAll("img").length);
    if (count === lastCount && i > 8) break;
    lastCount = count;
  }
}

async function extractCards(page) {
  return page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    const cards = [];

    for (const img of imgs) {
      const src = img.currentSrc || img.src || "";
      const alt = (img.alt || "").trim();
      if (!src) continue;
      if (/logo|icon|riot|league of legends/i.test(alt)) continue;
      if (!/cmsassets\.rgpub\.io|sanity/i.test(src)) continue;

      const parent = img.closest("article, li, div, a") || img.parentElement;
      const text = (parent?.innerText || alt || "").replace(/\s+/g, " ").trim();
      const rawName = alt || text.split("•")[0] || text.split("|")[0] || text;
      const name = rawName.replace(/\s+/g, " ").trim();

      if (!name || name.length < 2 || name.length > 120) continue;

      cards.push({
        name,
        rawText: text,
        image: src
      });
    }

    const unique = new Map();
    for (const card of cards) {
      const key = card.name.toLowerCase() + "__" + card.image.split("?")[0];
      if (!unique.has(key)) unique.set(key, card);
    }

    return Array.from(unique.values());
  });
}

async function main() {
  console.log("Abriendo galería oficial de Riftbound...");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(GALLERY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  console.log("");
  console.log("PASO MANUAL:");
  console.log("1) En el navegador que se abrió, filtra el set ORIGINS.");
  console.log("2) Si hay botón de cargar más, úsalo o baja hasta el final.");
  console.log("3) Cuando veas cargadas las cartas de Origins, vuelve a esta terminal.");
  console.log("");

  await ask("Presiona ENTER aquí cuando la galería esté filtrada por Origins... ");

  await autoScroll(page);
  const rawCards = await extractCards(page);
  await browser.close();

  const cleaned = rawCards.map((card, index) => ({
    id: index + 1,
    name: cleanName(card.name),
    set: "Origins",
    setCode: "OGN",
    rarity: "Unknown",
    stock: 0,
    status: "soldout",
    marketPrice: 0,
    storePrice: 0,
    image: card.image,
    tcgplayerId: "",
    source: "official-gallery-origins-manual-filter",
    rawName: card.name,
    rawText: card.rawText
  })).filter(card => card.name && card.name.length > 1);

  const dedup = [];
  const seen = new Set();
  for (const card of cleaned) {
    const key = card.name.toLowerCase() + "__" + card.image.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push({ ...card, id: dedup.length + 1 });
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(dedup, null, 2), "utf8");

  console.log("");
  console.log(`Cartas exportadas para revisión: ${dedup.length}`);
  console.log(`Archivo generado: ${OUT_PATH}`);
  console.log("");
  console.log("Siguiente paso: sube data/origins-import-review.json al chat para limpiarlo y convertirlo en el catálogo definitivo.");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
