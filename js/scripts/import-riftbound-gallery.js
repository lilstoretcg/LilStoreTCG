/**
 * LilStore TCG - Importador de galería oficial Riftbound
 *
 * Objetivo:
 * - Abrir la galería oficial de Riftbound.
 * - Extraer cartas visibles del set seleccionado.
 * - Generar/actualizar data/cards-master.json.
 *
 * Importante:
 * - Este script está pensado para ejecutarse LOCALMENTE, no en Netlify.
 * - Requiere Playwright:
 *     npm install
 *     npx playwright install chromium
 *
 * Uso:
 *     npm run import:gallery
 *
 * Luego subes el proyecto actualizado a Netlify.
 */

const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const GALLERY_URL = "https://riftbound.leagueoflegends.com/es-es/card-gallery/";
const OUT_PATH = path.join(process.cwd(), "data", "cards-master.json");
const CURRENT_PATH = path.join(process.cwd(), "data", "cards-master.json");

const SETS_TO_IMPORT = [
  "Origins"
  // Próximamente:
  // "Spiritforged",
  // "Unleashed"
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function detectSet(text) {
  if (/origins|ogn/i.test(text)) return "Origins";
  if (/spiritforged|sfd/i.test(text)) return "Spiritforged";
  if (/unleashed|unl/i.test(text)) return "Unleashed";
  return "";
}

function detectSetCode(set) {
  if (set === "Origins") return "OGN";
  if (set === "Spiritforged") return "SFD";
  if (set === "Unleashed") return "UNL";
  return "";
}

function detectRarity(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("showcase")) return "Showcase";
  if (t.includes("epic")) return "Epic";
  if (t.includes("rare")) return "Rare";
  if (t.includes("uncommon")) return "Uncommon";
  if (t.includes("common")) return "Common";
  if (t.includes("legend")) return "Legend";
  return "Unknown";
}

async function loadExistingCards() {
  try {
    const raw = await fs.readFile(CURRENT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function mergeCards(existing, imported) {
  const byKey = new Map();

  for (const card of existing) {
    const key = `${card.name}__${card.set}`;
    byKey.set(key, card);
  }

  for (const card of imported) {
    const key = `${card.name}__${card.set}`;
    const current = byKey.get(key);

    if (current) {
      byKey.set(key, {
        ...current,
        image: current.image && current.image !== "assets/logo.png" ? current.image : card.image,
        rarity: current.rarity && current.rarity !== "Unknown" ? current.rarity : card.rarity,
        setCode: current.setCode || card.setCode,
        status: Number(current.stock || 0) > 0 ? "available" : "soldout"
      });
    } else {
      byKey.set(key, {
        ...card,
        stock: 0,
        status: "soldout",
        marketPrice: 0,
        storePrice: 0,
        tcgplayerId: "",
        source: "official-gallery"
      });
    }
  }

  return Array.from(byKey.values()).map((card, index) => ({
    id: index + 1,
    ...card
  }));
}

async function autoScroll(page) {
  let previousHeight = 0;
  for (let i = 0; i < 30; i++) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === previousHeight) break;
    previousHeight = height;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
  }
}

async function clickLoadMore(page) {
  for (let i = 0; i < 20; i++) {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, a"));
      const btn = buttons.find(el => /mostrar más|cargar más|load more|show more/i.test(el.textContent || ""));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clicked) break;
    await page.waitForTimeout(1200);
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

      const parent = img.closest("article, li, div, a") || img.parentElement;
      const text = (parent?.innerText || alt || "").replace(/\s+/g, " ").trim();

      // Evita logos, iconos y elementos decorativos.
      if (!alt && text.length < 3) continue;
      if (/logo|icon|riot|league of legends/i.test(alt)) continue;

      const nameCandidate = alt || text.split("•")[0] || text.split("|")[0] || text;
      const name = nameCandidate.replace(/\s+/g, " ").trim();

      if (!name || name.length < 2 || name.length > 90) continue;

      cards.push({
        name,
        rawText: text,
        image: src
      });
    }

    const unique = new Map();
    for (const card of cards) {
      const key = card.name.toLowerCase();
      if (!unique.has(key)) unique.set(key, card);
    }

    return Array.from(unique.values());
  });
}

async function main() {
  console.log("Abriendo galería oficial:", GALLERY_URL);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await page.goto(GALLERY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Intento simple: si hay filtros visibles, el usuario puede ajustar SETS_TO_IMPORT después.
  await clickLoadMore(page);
  await autoScroll(page);

  const rawCards = await extractCards(page);
  await browser.close();

  console.log(`Cartas detectadas: ${rawCards.length}`);

  const imported = rawCards.map(card => {
    const text = `${card.name} ${card.rawText}`;
    let set = detectSet(text);

    // Si la galería está filtrada por Origins o no entrega set visible,
    // se asigna Origins por defecto en esta primera importación.
    if (!set) set = "Origins";

    return {
      name: card.name.includes(` - ${set}`) ? card.name : `${card.name} - ${set} (${detectSetCode(set)})`,
      set,
      setCode: detectSetCode(set),
      rarity: detectRarity(text),
      image: card.image
    };
  }).filter(card => SETS_TO_IMPORT.includes(card.set));

  const existing = await loadExistingCards();
  const merged = mergeCards(existing, imported);

  await fs.writeFile(OUT_PATH, JSON.stringify(merged, null, 2), "utf8");

  // También actualiza cards.json para que la tienda use el catálogo maestro.
  await fs.writeFile(path.join(process.cwd(), "data", "cards.json"), JSON.stringify(merged, null, 2), "utf8");

  console.log(`Importadas/actualizadas: ${imported.length}`);
  console.log(`Total catálogo maestro: ${merged.length}`);
  console.log("Archivo actualizado:", OUT_PATH);
}

main().catch(err => {
  console.error("Error importando galería:", err);
  process.exit(1);
});
