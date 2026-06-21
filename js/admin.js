let cards = [];
let inventory = {};

const rowsEl = document.getElementById("stockRows");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");
const saveBtn = document.getElementById("saveBtn");
const syncPricesBtn = document.getElementById("syncPricesBtn");
const syncCatalogBtn = document.getElementById("syncCatalogBtn");
const message = document.getElementById("message");
const exportBackupExcelBtn = document.getElementById("exportBackupExcelBtn");
const exportBackupJsonBtn = document.getElementById("exportBackupJsonBtn");
const exportBackupBothBtn = document.getElementById("exportBackupBothBtn");

function keyFor(card){
  return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
}

function supportsFoil(card){
  return ["common", "uncommon"].includes(String(card.rarity || "").toLowerCase());
}

function normalizeEntry(card){
  const key = keyFor(card);
  const entry = inventory[key];

  if(typeof entry === "number"){
    return {
      stock: Number(entry || 0),
      foilStock: 0,
      marketPrice: Number(card.marketPrice || 0),
      storePrice: Number(card.storePrice || 0),
      foilMarketPrice: Number(card.foilMarketPrice || 0),
      foilStorePrice: Number(card.foilStorePrice || 0)
    };
  }

  return {
    stock: Number(entry?.stock ?? card.stock ?? 0),
    foilStock: Number(entry?.foilStock ?? card.foilStock ?? 0),
    marketPrice: Number(entry?.marketPrice ?? card.marketPrice ?? 0),
    storePrice: Number(entry?.storePrice ?? card.storePrice ?? 0),
    foilMarketPrice: Number(entry?.foilMarketPrice ?? card.foilMarketPrice ?? 0),
    foilStorePrice: Number(entry?.foilStorePrice ?? card.foilStorePrice ?? 0)
  };
}

function showMessage(text, isError=false){
  if(!message) return;
  message.textContent = text;
  message.style.color = isError ? "#fecaca" : "#a7f3d0";
}

function currentStockFor(card){
  return normalizeEntry(card).stock;
}

function currentFoilStockFor(card){
  return supportsFoil(card) ? normalizeEntry(card).foilStock : 0;
}

function updateStats(){
  const totalUnits = cards.reduce((sum, card)=>sum + currentStockFor(card) + currentFoilStockFor(card), 0);
  const availableCards = cards.filter(card=>currentStockFor(card)>0 || currentFoilStockFor(card)>0).length;

  document.getElementById("totalCards").textContent = cards.length;
  document.getElementById("availableCards").textContent = availableCards;
  document.getElementById("totalUnits").textContent = totalUnits;
}

function render(){
  if(!rowsEl) return;

  const q = (searchInput?.value || "").toLowerCase();
  const filter = stockFilter?.value || "";

  const filtered = cards.filter(card=>{
    const stock = currentStockFor(card);
    const foilStock = currentFoilStockFor(card);
    const matchesText =
      String(card.name || "").toLowerCase().includes(q) ||
      String(card.publicCode || "").toLowerCase().includes(q) ||
      String(card.dotggCode || "").toLowerCase().includes(q);

    const matchesStock =
      !filter ||
      (filter === "available" && (stock > 0 || foilStock > 0)) ||
      (filter === "soldout" && stock <= 0 && foilStock <= 0);

    return matchesText && matchesStock;
  });

  rowsEl.innerHTML = filtered.map(card=>{
    const key = keyFor(card);
    const entry = normalizeEntry(card);
    const hasFoil = supportsFoil(card);
    const foilDisabled = hasFoil ? "" : "disabled";
    const foilTitle = hasFoil ? "Stock foil" : "Foil no aplica para esta rareza";

    return `
      <tr>
        <td>
          <div class="card-name">${card.name}</div>
          <div class="card-code">${card.cardType || ""}</div>
        </td>
        <td>${card.set || ""}</td>
        <td>${card.rarity || ""}</td>
        <td>${card.publicCode || card.dotggCode || "-"}</td>
        <td><input type="number" min="0" value="${entry.stock}" data-field="stock" data-card-key="${key}"></td>
        <td><input type="number" min="0" value="${hasFoil ? entry.foilStock : 0}" data-field="foilStock" data-card-key="${key}" ${foilDisabled} title="${foilTitle}"></td>
        <td><input type="number" min="0" step="0.01" value="${entry.marketPrice}" data-field="marketPrice" data-card-key="${key}"></td>
        <td><input type="number" min="0" step="1" value="${entry.storePrice}" data-field="storePrice" data-card-key="${key}"></td>
        <td><input type="number" min="0" step="0.01" value="${hasFoil ? entry.foilMarketPrice : 0}" data-field="foilMarketPrice" data-card-key="${key}" ${foilDisabled} title="${foilTitle}"></td>
        <td><input type="number" min="0" step="1" value="${hasFoil ? entry.foilStorePrice : 0}" data-field="foilStorePrice" data-card-key="${key}" ${foilDisabled} title="${foilTitle}"></td>
      </tr>
    `;
  }).join("");

  updateStats();
}

async function load(){
  showMessage("Cargando catálogo...");

  try{
    const catalogRes = await fetch("/.netlify/functions/catalog?v=" + Date.now(), { cache:"no-store" });
    if(catalogRes.ok){
      const remoteCards = await catalogRes.json();
      if(Array.isArray(remoteCards) && remoteCards.length){
        cards = remoteCards;
      }
    }
  }catch(e){}

  if(!cards.length){
    try{
      const cardsRes = await fetch("data/cards.json?v=" + Date.now(), { cache:"no-store" });
      cards = await cardsRes.json();
    }catch(e){
      cards = [];
    }
  }

  try{
    const invRes = await fetch("/.netlify/functions/stock?v=" + Date.now(), { cache:"no-store" });
    if(invRes.ok){
      inventory = await invRes.json();
    }
  }catch(e){
    inventory = {};
    showMessage("Modo local: no se pudo leer inventario remoto. En Netlify funcionará con Functions.", true);
  }

  render();
  showMessage(`Catálogo cargado: ${cards.length} cartas.`);
}

async function save(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador.", true);
    return;
  }

  document.querySelectorAll("[data-card-key]").forEach(input=>{
    if(input.disabled) return;

    const key = input.dataset.cardKey;
    const field = input.dataset.field;
    const value = Number(input.value || 0);

    if(typeof inventory[key] === "number"){
      inventory[key] = { stock: inventory[key] };
    }

    inventory[key] = inventory[key] || {};

    inventory[key][field] = (field === "marketPrice" || field === "foilMarketPrice")
      ? Math.max(0, Number(value.toFixed(2)))
      : Math.max(0, Math.round(value));
  });

  Object.keys(inventory).forEach(key=>{
    const e = inventory[key];
    if(!e || (
      Number(e.stock || 0) <= 0 &&
      Number(e.foilStock || 0) <= 0 &&
      Number(e.marketPrice || 0) <= 0 &&
      Number(e.storePrice || 0) <= 0 &&
      Number(e.foilMarketPrice || 0) <= 0 &&
      Number(e.foilStorePrice || 0) <= 0
    )){
      delete inventory[key];
    }
  });

  const res = await fetch("/.netlify/functions/stock", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-pin": pin
    },
    body: JSON.stringify({ inventory })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showMessage(data.error || "No se pudo guardar.", true);
    return;
  }

  showMessage(`Inventario guardado correctamente. Cartas editadas: ${data.updated}`);
  render();
}

async function syncDotGGCatalog(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador antes de actualizar catálogo.", true);
    return;
  }

  showMessage("Actualizando catálogo desde DotGG...");

  const res = await fetch("/.netlify/functions/sync-dotgg-catalog", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-pin": pin
    },
    body: JSON.stringify({
      currentCards: cards.map(card => ({
        name: card.name,
        publicCode: card.publicCode,
        dotggCode: card.dotggCode,
        set: card.set,
        setCode: card.setCode,
        tcgplayerId: card.tcgplayerId,
        cardType: card.cardType
      }))
    })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showMessage(data.error || data.message || "No se pudo actualizar el catálogo.", true);
    return;
  }

  try{
    const catalogRes = await fetch("/.netlify/functions/catalog?v=" + Date.now(), { cache:"no-store" });
    if(catalogRes.ok){
      const remoteCards = await catalogRes.json();
      if(Array.isArray(remoteCards) && remoteCards.length){
        cards = remoteCards;
      }
    }
  }catch(e){}

  render();
  showMessage(`Catálogo DotGG actualizado: ${data.saved} cartas. Sets: ${Object.entries(data.bySet || {}).map(([k,v])=>`${k}: ${v}`).join(", ")}`);
}

async function syncRiftboundPrices(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador antes de actualizar precios.", true);
    return;
  }

  const dollar = Number(document.getElementById("dollarInput")?.value || 900);
  const margin = Number(document.getElementById("marginInput")?.value || 1);

  showMessage("Actualizando precios desde DotGG... Esto puede tardar unos segundos.");

  const res = await fetch("/.netlify/functions/sync-riftboundgg-prices", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-pin": pin
    },
    body: JSON.stringify({
      cards: cards.map(card => ({
        name: card.name,
        publicCode: card.publicCode || card.dotggCode,
        dotggCode: card.dotggCode,
        set: card.set,
        setCode: card.setCode,
        rarity: card.rarity,
        stock: currentStockFor(card),
        foilStock: supportsFoil(card) ? currentFoilStockFor(card) : 0,
        marketPrice: normalizeEntry(card).marketPrice,
        storePrice: normalizeEntry(card).storePrice,
        foilMarketPrice: supportsFoil(card) ? normalizeEntry(card).foilMarketPrice : 0,
        foilStorePrice: supportsFoil(card) ? normalizeEntry(card).foilStorePrice : 0
      })),
      dollar,
      margin
    })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showMessage(data.error || data.message || "No se pudieron sincronizar los precios.", true);
    return;
  }

  try{
    const invRes = await fetch("/.netlify/functions/stock?v=" + Date.now(), { cache:"no-store" });
    if(invRes.ok){
      inventory = await invRes.json();
    }
  }catch(e){}

  render();
  showMessage(`Precios actualizados: ${data.updated}. Códigos consultados: ${data.uniqueCodes}. Sin precio encontrado: ${data.notFoundCount}. Fallidos: ${data.failedCount}.`);
}


function backupDateStamp(){
  const now = new Date();
  const date = now.toISOString().slice(0,10);
  const time = now.toTimeString().slice(0,5).replace(":", "-");
  return `${date}_${time}`;
}

function downloadTextFile(filename, content, mime="application/json"){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupRows(){
  return cards.map(card=>{
    const entry = normalizeEntry(card);
    const hasFoil = supportsFoil(card);

    return {
      "Codigo": card.publicCode || card.dotggCode || "",
      "Carta": card.name || "",
      "Set": card.set || "",
      "Rareza": card.rarity || "",
      "Tipo": card.cardType || "",
      "Stock Normal": entry.stock,
      "Stock Foil": hasFoil ? entry.foilStock : 0,
      "Mercado Normal USD": entry.marketPrice,
      "LilStore Normal CLP": entry.storePrice,
      "Mercado Foil USD": hasFoil ? entry.foilMarketPrice : 0,
      "LilStore Foil CLP": hasFoil ? entry.foilStorePrice : 0,
      "Tiene Foil": hasFoil ? "Sí" : "No"
    };
  });
}

function exportBackupExcel(){
  if(!cards.length){
    showMessage("El catálogo aún no está cargado.", true);
    return;
  }

  if(!window.XLSX){
    showMessage("No se pudo cargar la librería Excel. Intenta recargar la página.", true);
    return;
  }

  const rows = backupRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 16 }, { wch: 38 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");

  const summary = [
    ["Resumen LilStore TCG"],
    ["Fecha", new Date().toLocaleString("es-CL")],
    ["Cartas catálogo", cards.length],
    ["Cartas con stock", cards.filter(card=>currentStockFor(card)>0 || currentFoilStockFor(card)>0).length],
    ["Unidades normales", cards.reduce((sum, card)=>sum + currentStockFor(card), 0)],
    ["Unidades foil", cards.reduce((sum, card)=>sum + currentFoilStockFor(card), 0)],
    ["Total unidades", cards.reduce((sum, card)=>sum + currentStockFor(card) + currentFoilStockFor(card), 0)],
    ["Valor normal CLP", cards.reduce((sum, card)=>sum + currentStockFor(card) * normalizeEntry(card).storePrice, 0)],
    ["Valor foil CLP", cards.reduce((sum, card)=>sum + currentFoilStockFor(card) * normalizeEntry(card).foilStorePrice, 0)],
    ["Valor total CLP", cards.reduce((sum, card)=>sum + currentStockFor(card) * normalizeEntry(card).storePrice + currentFoilStockFor(card) * normalizeEntry(card).foilStorePrice, 0)]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary["!cols"] = [{ wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

  XLSX.writeFile(wb, `LilStoreTCG_backup_stock_${backupDateStamp()}.xlsx`);
  showMessage("Backup Excel descargado correctamente.");
}

function exportBackupJson(){
  if(!cards.length){
    showMessage("El catálogo aún no está cargado.", true);
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    source: "LilStore TCG Admin",
    version: "v8.0",
    inventory,
    summary: {
      catalogCards: cards.length,
      cardsWithStock: cards.filter(card=>currentStockFor(card)>0 || currentFoilStockFor(card)>0).length,
      normalUnits: cards.reduce((sum, card)=>sum + currentStockFor(card), 0),
      foilUnits: cards.reduce((sum, card)=>sum + currentFoilStockFor(card), 0),
      totalUnits: cards.reduce((sum, card)=>sum + currentStockFor(card) + currentFoilStockFor(card), 0),
      normalValueCLP: cards.reduce((sum, card)=>sum + currentStockFor(card) * normalizeEntry(card).storePrice, 0),
      foilValueCLP: cards.reduce((sum, card)=>sum + currentFoilStockFor(card) * normalizeEntry(card).foilStorePrice, 0),
      totalValueCLP: cards.reduce((sum, card)=>sum + currentStockFor(card) * normalizeEntry(card).storePrice + currentFoilStockFor(card) * normalizeEntry(card).foilStorePrice, 0)
    }
  };

  downloadTextFile(
    `LilStoreTCG_backup_inventory_${backupDateStamp()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );

  showMessage("Backup JSON descargado correctamente.");
}

function exportBackupBoth(){
  exportBackupExcel();
  setTimeout(exportBackupJson, 500);
}


searchInput?.addEventListener("input", render);
stockFilter?.addEventListener("change", render);
saveBtn?.addEventListener("click", save);
if(syncPricesBtn) syncPricesBtn.addEventListener("click", syncRiftboundPrices);
if(syncCatalogBtn) syncCatalogBtn.addEventListener("click", syncDotGGCatalog);
exportBackupExcelBtn?.addEventListener("click", exportBackupExcel);
exportBackupJsonBtn?.addEventListener("click", exportBackupJson);
exportBackupBothBtn?.addEventListener("click", exportBackupBoth);

load();
