let cards = [];
let inventory = {};

const rowsEl = document.getElementById("stockRows");
const searchInput = document.getElementById("searchInput");
const setFilter = document.getElementById("setFilter");
const priceFilter = document.getElementById("priceFilter");
const stockFilter = document.getElementById("stockFilter"); // compatibilidad antigua
const saveBtn = document.getElementById("saveBtn");
const syncPricesBtn = document.getElementById("syncPricesBtn");
const syncStockPricesBtn = document.getElementById("syncStockPricesBtn");
const syncAllPricesBtn = document.getElementById("syncAllPricesBtn");
const syncCatalogBtn = document.getElementById("syncCatalogBtn");
const message = document.getElementById("message");
const auditDotGGBtn = document.getElementById("auditDotGGBtn");
const auditOffsetInput = document.getElementById("auditOffsetInput");
const auditLimitInput = document.getElementById("auditLimitInput");
const auditResult = document.getElementById("auditResult");
const exportBackupExcelBtn = document.getElementById("exportBackupExcelBtn");
const exportBackupJsonBtn = document.getElementById("exportBackupJsonBtn");
const exportBackupBothBtn = document.getElementById("exportBackupBothBtn");
const orderIdInput = document.getElementById("orderIdInput");
const searchOrderBtn = document.getElementById("searchOrderBtn");
const completeOrderBtn = document.getElementById("completeOrderBtn");
const orderPreview = document.getElementById("orderPreview");
const restoreExcelBackupBtn = document.getElementById("restoreExcelBackupBtn");
const restoreBackupFileInput = document.getElementById("restoreBackupFileInput");
const restoreUploadedBackupBtn = document.getElementById("restoreUploadedBackupBtn");
const saveBasePricesBtn = document.getElementById("saveBasePricesBtn");
const applyBasePricesBtn = document.getElementById("applyBasePricesBtn");

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
  const setValue = setFilter?.value || "";
  const priceValue = priceFilter?.value || "";
  const legacyStockFilter = stockFilter?.value || "";

  const filtered = cards.filter(card=>{
    const stock = currentStockFor(card);
    const foilStock = currentFoilStockFor(card);
    const priceEntry = normalizeEntry(card);
    const hasMarketPrice =
      Number(priceEntry.marketPrice || 0) > 0 ||
      Number(priceEntry.foilMarketPrice || 0) > 0;
    const matchesText =
      String(card.name || "").toLowerCase().includes(q) ||
      String(card.publicCode || "").toLowerCase().includes(q) ||
      String(card.dotggCode || "").toLowerCase().includes(q);

    const matchesSet = !setValue || String(card.set || "") === setValue || String(card.setCode || "") === setValue;

    const matchesPrice =
      !priceValue ||
      (priceValue === "priced" && hasMarketPrice) ||
      (priceValue === "no-price" && !hasMarketPrice);

    const matchesStock =
      !legacyStockFilter ||
      (legacyStockFilter === "available" && (stock > 0 || foilStock > 0)) ||
      (legacyStockFilter === "soldout" && stock <= 0 && foilStock <= 0);

    return matchesText && matchesSet && matchesPrice && matchesStock;
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



function cleanOrderId(value){
  return String(value || "").replace("#","").trim().padStart(5, "0");
}

function orderStatusLabel(status){
  if(status === "completed") return "Descontado";
  if(status === "cancelled") return "Cancelado";
  return "Pendiente";
}

function renderOrderPreview(order){
  if(!orderPreview) return;

  const itemsHtml = (order.items || []).map(item=>{
    const variant = item.variant === "foil" ? "Foil" : "Normal";
    return `
      <div class="order-preview-item">
        <strong>${item.name}</strong>
        <span>${item.code || item.cardKey} · ${variant} x${item.qty}</span>
        <b>$${Number(item.subtotal || 0).toLocaleString("es-CL")} CLP</b>
      </div>
    `;
  }).join("");

  orderPreview.innerHTML = `
    <div class="order-preview-head">
      <strong>Pedido #${order.id}</strong>
      <span>${orderStatusLabel(order.status)}</span>
    </div>
    <div class="order-preview-list">${itemsHtml}</div>
    <div class="order-preview-total">
      <span>Total</span>
      <strong>$${Number(order.total || 0).toLocaleString("es-CL")} CLP</strong>
    </div>
  `;
}

async function searchOrder(){
  const id = cleanOrderId(orderIdInput?.value);
  if(!id || id === "00000"){
    showMessage("Ingresa un número de pedido válido.", true);
    return;
  }

  const res = await fetch("/.netlify/functions/orders?id=" + encodeURIComponent(id), { cache:"no-store" });
  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    if(orderPreview) orderPreview.textContent = data.error || "No se encontró el pedido.";
    showMessage(data.error || "No se encontró el pedido.", true);
    return;
  }

  renderOrderPreview(data.order);
  showMessage(`Pedido #${data.order.id} cargado.`);
}

async function completeOrder(){
  const pin = document.getElementById("adminPin").value.trim();
  const id = cleanOrderId(orderIdInput?.value);

  if(!pin){
    showMessage("Ingresa el PIN administrador.", true);
    return;
  }

  if(!id || id === "00000"){
    showMessage("Ingresa un número de pedido válido.", true);
    return;
  }

  if(!confirm(`¿Descontar stock del pedido #${id}? Esta acción no debería repetirse.`)){
    return;
  }

  const res = await fetch("/.netlify/functions/orders", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-pin": pin
    },
    body: JSON.stringify({
      action:"confirm",
      orderId:id
    })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showMessage(data.error || "No se pudo descontar el pedido.", true);
    if(data.order) renderOrderPreview(data.order);
    return;
  }

  inventory = data.inventory || inventory;
  renderOrderPreview(data.order);
  render();
  updateStats();
  showMessage(data.message || `Pedido #${id} confirmado correctamente.`);
  if(typeof loadOrdersHistoryV14 === "function") await loadOrdersHistoryV14();
}


function escapeCsv(value){
  const text = String(value ?? "");
  if(/[",\n;]/.test(text)){
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadAuditCsv(results){
  const headers = ["Carta","Codigo local","DotGG local","Codigo enviado","Encontrada","Status","Precio","Payload cardid","Muestra"];
  const rows = results.map(r => [
    r.name,
    r.publicCode,
    r.dotggCode,
    r.sentCode,
    r.found ? "SI" : "NO",
    r.status,
    r.price || "",
    r.payloadCardId || "",
    String(r.sample || "").replace(/\s+/g, " ").slice(0, 250)
  ]);

  const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dotgg_audit_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderAuditResults(data){
  if(!auditResult) return;

  const missing = (data.missingSamples || []).map(r => `
    <div class="audit-row">
      <strong>${r.name || "-"}</strong>
      <span>Local: ${r.publicCode || r.dotggCode || "-"}</span>
      <span>Enviado: ${r.sentCode || "-"}</span>
      <span>Status: ${r.status}</span>
      <span>Precio: ${r.price || "-"}</span>
    </div>
  `).join("");

  auditResult.innerHTML = `
    <div class="audit-summary">
      <strong>Revisadas: ${data.checked}</strong>
      <span>Encontradas: ${data.found}</span>
      <span>Sin precio: ${data.missing}</span>
    </div>
    <h3>Primeras fallidas</h3>
    <div class="audit-list">${missing || "<p>Sin fallidas en este rango.</p>"}</div>
  `;
}

async function auditDotGGCodes(){
  if(!cards.length){
    showMessage("El catálogo aún no está cargado.", true);
    return;
  }

  const offset = Number(auditOffsetInput?.value || 0);
  const limit = Number(auditLimitInput?.value || 80);

  showMessage(`Auditando códigos DotGG desde ${offset}, cantidad ${limit}...`);

  try{
    const res = await fetch("/.netlify/functions/audit-dotgg-codes", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        offset,
        limit,
        cards: cards.map(card => ({
          name: card.name,
          publicCode: card.publicCode,
          dotggCode: card.dotggCode,
          cardid: card.cardid,
          cardId: card.cardId,
          code: card.code,
          number: card.number
        }))
      })
    });

    const data = await res.json().catch(()=>({}));

    if(!res.ok){
      showMessage(data.error || data.message || "No se pudo auditar DotGG.", true);
      return;
    }

    console.log("DotGG audit:", data);
    renderAuditResults(data);
    downloadAuditCsv(data.results || []);

    showMessage(`Auditoría lista: ${data.found}/${data.checked} encontradas. Se descargó CSV.`);
  }catch(error){
    showMessage("Error auditando DotGG: " + (error.message || error), true);
  }
}


function rarityKey(card){
  return String(card.rarity || "").toLowerCase();
}

function basePriceInputs(){
  return {
    common: {
      normal: document.getElementById("baseCommonNormal"),
      foil: document.getElementById("baseCommonFoil")
    },
    uncommon: {
      normal: document.getElementById("baseUncommonNormal"),
      foil: document.getElementById("baseUncommonFoil")
    },
    rare: {
      normal: document.getElementById("baseRareNormal"),
      foil: document.getElementById("baseRareFoil")
    },
    epic: {
      normal: document.getElementById("baseEpicNormal"),
      foil: document.getElementById("baseEpicFoil")
    },
    showcase: {
      normal: document.getElementById("baseShowcaseNormal"),
      foil: document.getElementById("baseShowcaseFoil")
    }
  };
}

function readBasePrices(){
  const inputs = basePriceInputs();
  const rules = {};
  Object.keys(inputs).forEach(rarity=>{
    rules[rarity] = {
      normal: Math.max(0, Math.round(Number(inputs[rarity].normal?.value || 0))),
      foil: Math.max(0, Math.round(Number(inputs[rarity].foil?.value || 0)))
    };
  });
  return rules;
}

function fillBasePrices(rules = {}){
  const inputs = basePriceInputs();
  Object.keys(inputs).forEach(rarity=>{
    if(inputs[rarity].normal) inputs[rarity].normal.value = Number(rules[rarity]?.normal ?? inputs[rarity].normal.value ?? 0);
    if(inputs[rarity].foil) inputs[rarity].foil.value = Number(rules[rarity]?.foil ?? inputs[rarity].foil.value ?? 0);
  });
}

async function loadBasePrices(){
  try{
    const res = await fetch("/.netlify/functions/settings?v=" + Date.now(), { cache:"no-store" });
    if(!res.ok) return;
    const rules = await res.json();
    fillBasePrices(rules);
  }catch(e){}
}

async function saveBasePrices(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador para guardar precios base.", true);
    return;
  }

  const res = await fetch("/.netlify/functions/settings", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-pin": pin
    },
    body: JSON.stringify({ basePrices: readBasePrices() })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showMessage(data.error || "No se pudieron guardar los precios base.", true);
    return;
  }

  fillBasePrices(data.basePrices);
  showMessage("Precios base guardados correctamente.");
}

function basePriceForCard(card, variant="normal"){
  const rules = readBasePrices();
  const rarity = rarityKey(card);
  const rule = rules[rarity] || {};
  return Math.max(0, Math.round(Number(variant === "foil" ? rule.foil : rule.normal || 0)));
}

async function saveInventoryToRemote(successMessage){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador.", true);
    return false;
  }

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
    showMessage(data.error || "No se pudo guardar inventario.", true);
    return false;
  }

  showMessage(successMessage || `Inventario guardado. Registros: ${data.updated}`);
  return true;
}

async function applyBasePrices(){
  let changed = 0;

  cards.forEach(card=>{
    const key = keyFor(card);
    const entry = normalizeEntry(card);
    inventory[key] = inventory[key] || {};
    if(typeof inventory[key] === "number") inventory[key] = { stock: inventory[key] };

    const normalBase = basePriceForCard(card, "normal");
    const normalFinal = Math.max(Number(entry.storePrice || 0), normalBase);
    if(normalFinal !== Number(entry.storePrice || 0)) changed++;
    inventory[key].stock = Number(entry.stock || 0);
    inventory[key].marketPrice = Number(entry.marketPrice || 0);
    inventory[key].storePrice = normalFinal;

    if(supportsFoil(card)){
      const foilBase = basePriceForCard(card, "foil");
      const foilFinal = Math.max(Number(entry.foilStorePrice || 0), foilBase);
      if(foilFinal !== Number(entry.foilStorePrice || 0)) changed++;
      inventory[key].foilStock = Number(entry.foilStock || 0);
      inventory[key].foilMarketPrice = Number(entry.foilMarketPrice || 0);
      inventory[key].foilStorePrice = foilFinal;
    }
  });

  render();
  await saveInventoryToRemote(`Precios base aplicados. Cambios realizados: ${changed}.`);
}

async function restoreExcelBackup(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador para restaurar respaldo.", true);
    return;
  }

  if(!confirm("¿Restaurar el stock desde el respaldo Excel? Esto reemplazará el inventario remoto actual.")){
    return;
  }

  const resBackup = await fetch("data/inventory_backup_from_excel.json?v=" + Date.now(), { cache:"no-store" });
  if(!resBackup.ok){
    showMessage("No se pudo leer el respaldo de inventario.", true);
    return;
  }

  const backupInventory = await resBackup.json();
  inventory = backupInventory;

  const ok = await saveInventoryToRemote(`Stock restaurado desde respaldo. Registros: ${Object.keys(inventory).length}.`);
  if(ok){
    render();
  }
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
setFilter?.addEventListener("change", render);
stockFilter?.addEventListener("change", render);
saveBtn?.addEventListener("click", save);
if(syncPricesBtn) syncPricesBtn.addEventListener("click", syncRiftboundPrices);
if(syncCatalogBtn) syncCatalogBtn.addEventListener("click", syncDotGGCatalog);
exportBackupExcelBtn?.addEventListener("click", exportBackupExcel);
exportBackupJsonBtn?.addEventListener("click", exportBackupJson);
exportBackupBothBtn?.addEventListener("click", exportBackupBoth);
searchOrderBtn?.addEventListener("click", searchOrder);
completeOrderBtn?.addEventListener("click", completeOrder);

auditDotGGBtn?.addEventListener("click", auditDotGGCodes);
restoreExcelBackupBtn?.addEventListener("click", restoreExcelBackup);
saveBasePricesBtn?.addEventListener("click", saveBasePrices);
applyBasePricesBtn?.addEventListener("click", applyBasePrices);
loadBasePrices();
load();

// v10 batch sync: no se encontró syncRiftboundPrices para reemplazar.


// v10.1 DotGG batch progress override
let __dotggSyncCancelRequested = false;

function setDotGGProgress(done, total, details = ""){
  const fill = document.getElementById("dotggProgressFill");
  const text = document.getElementById("dotggProgressText");
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  if(fill) fill.style.width = percent + "%";
  if(text){
    text.innerHTML = `
      <strong>${percent}%</strong> · ${done}/${total} cartas procesadas<br>
      ${details || ""}
    `;
  }
}

async function syncRiftboundPricesBatchV101(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador antes de actualizar precios.", true);
    return;
  }

  const dollar = Number(document.getElementById("dollarInput")?.value || 900);
  const margin = Number(document.getElementById("marginInput")?.value || 1);
  const batchSize = 25;

  const payloadCards = cards.map(card => ({
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
  }));

  if(!payloadCards.length){
    showMessage("No hay cartas cargadas para sincronizar.", true);
    return;
  }

  __dotggSyncCancelRequested = false;

  let offset = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let totalNotFound = 0;
  let totalProcessed = 0;
  let lote = 1;
  const totalLotes = Math.ceil(payloadCards.length / batchSize);
  let lastData = null;

  setDotGGProgress(0, payloadCards.length, "Iniciando sincronización por lotes...");
  showMessage(`Iniciando sincronización por lotes DotGG: 0/${payloadCards.length}...`);

  while(offset < payloadCards.length){
    if(__dotggSyncCancelRequested){
      showMessage(`Sincronización cancelada. Procesadas: ${totalProcessed}. Actualizadas: ${totalUpdated}.`, true);
      setDotGGProgress(totalProcessed, payloadCards.length, "Sincronización cancelada por el usuario.");
      return;
    }

    const loteDesde = offset + 1;
    const loteHasta = Math.min(offset + batchSize, payloadCards.length);

    setDotGGProgress(
      totalProcessed,
      payloadCards.length,
      `Lote ${lote} de ${totalLotes} · Cartas ${loteDesde}-${loteHasta} · Actualizadas: ${totalUpdated} · Sin precio: ${totalNotFound} · Errores técnicos: ${totalFailed}`
    );

    showMessage(`Actualizando lote DotGG ${lote}/${totalLotes}: ${loteDesde}-${loteHasta} de ${payloadCards.length}...`);

    const res = await fetch("/.netlify/functions/sync-riftboundgg-prices", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-admin-pin": pin
      },
      body: JSON.stringify({
        cards: payloadCards,
        offset,
        limit: batchSize,
        dollar,
        margin
      })
    });

    const data = await res.json().catch(()=>({}));
    lastData = data;

    if(!res.ok){
      console.error("DotGG batch error:", data);
      const detail = data.message || data.error || "No se pudieron sincronizar los precios.";
      showMessage(detail, true);
      setDotGGProgress(totalProcessed, payloadCards.length, `Error en lote ${lote}: ${detail}`);
      return;
    }

    const processed = Number(data.processed || data.uniqueCodes || batchSize || 0);
    totalUpdated += Number(data.updated || 0);
    totalFailed += Number(data.failedCount || 0);
    totalNotFound += Number(data.notFoundCount || 0);
    totalProcessed += processed;

    offset = Number(data.nextOffset || (offset + batchSize));
    lote++;

    setDotGGProgress(
      Math.min(offset, payloadCards.length),
      payloadCards.length,
      `Actualizadas: ${totalUpdated} · Sin precio: ${totalNotFound} · Errores técnicos: ${totalFailed}`
    );

    await new Promise(resolve => setTimeout(resolve, 800));
  }

  try{
    const invRes = await fetch("/.netlify/functions/stock?v=" + Date.now(), { cache:"no-store" });
    if(invRes.ok){
      inventory = await invRes.json();
    }
  }catch(e){}

  render();

  const finalMessage = `Sincronización completa. Procesadas: ${totalProcessed}. Precios actualizados: ${totalUpdated}. Sin precio: ${totalNotFound}. Fallidos: ${totalFailed}.`;
  setDotGGProgress(payloadCards.length, payloadCards.length, finalMessage);
  showMessage(finalMessage);
  console.log("Último lote DotGG:", lastData);
}

function bindDotGGBatchV101(){
  const oldBtn = document.getElementById("syncPricesBtn");
  if(oldBtn){
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener("click", syncRiftboundPricesBatchV101);
  }

  const cancelBtn = document.getElementById("cancelDotGGSyncBtn");
  if(cancelBtn){
    cancelBtn.addEventListener("click", ()=>{
      __dotggSyncCancelRequested = true;
      setDotGGProgress(0, cards.length || 0, "Cancelando al terminar el lote actual...");
    });
  }
}

document.addEventListener("DOMContentLoaded", bindDotGGBatchV101);


// v11.0 Admin collapsible sections
function setupAdminCollapsiblesV11(){
  const panels = Array.from(document.querySelectorAll("section.panel, .panel"));
  if(!panels.length) return;

  panels.forEach((panel, index)=>{
    if(panel.dataset.collapsibleReady === "1") return;
    panel.dataset.collapsibleReady = "1";

    const title = panel.querySelector("h2, h3");
    if(!title) return;

    const titleText = title.textContent.trim().toLowerCase();

    // Keep inventory/table visible if it has no h2 or is the main stock table.
    const shouldOpen =
      titleText.includes("pin") ||
      titleText.includes("buscar") ||
      titleText.includes("inventario") ||
      titleText.includes("sincronización de precios") ||
      titleText.includes("precio base");

    panel.classList.add("admin-collapsible");
    if(shouldOpen) panel.classList.add("open");
    else panel.classList.add("closed");

    const content = document.createElement("div");
    content.className = "admin-collapsible-content";

    const children = Array.from(panel.children);
    children.forEach(child=>{
      if(child !== title) content.appendChild(child);
    });

    const header = document.createElement("button");
    header.type = "button";
    header.className = "admin-collapsible-header";
    header.innerHTML = `
      <span>${title.textContent}</span>
      <span class="admin-collapsible-icon">${panel.classList.contains("open") ? "▼" : "▶"}</span>
    `;

    title.replaceWith(header);
    panel.appendChild(content);

    header.addEventListener("click", ()=>{
      const isOpen = panel.classList.toggle("open");
      panel.classList.toggle("closed", !isOpen);
      const icon = header.querySelector(".admin-collapsible-icon");
      if(icon) icon.textContent = isOpen ? "▼" : "▶";
    });
  });
}

document.addEventListener("DOMContentLoaded", setupAdminCollapsiblesV11);


// v12 Admin UX: reliable collapsibles + statistics center
function formatCLPV12(value){
  return "$" + Math.round(Number(value || 0)).toLocaleString("es-CL") + " CLP";
}

function calculateAdminStatsV12(){
  if(!Array.isArray(cards) || !cards.length) return null;

  const bySet = {};
  let totalValue = 0;
  let normalUnits = 0;
  let foilUnits = 0;

  cards.forEach(card=>{
    const entry = normalizeEntry(card);
    const set = card.set || card.setCode || "Sin set";

    const stock = Number(entry.stock || 0);
    const foilStock = supportsFoil(card) ? Number(entry.foilStock || 0) : 0;
    const normalPrice = Number(entry.storePrice || 0);
    const foilPrice = Number(entry.foilStorePrice || 0);

    normalUnits += stock;
    foilUnits += foilStock;
    totalValue += (stock * normalPrice) + (foilStock * foilPrice);

    if(!bySet[set]){
      bySet[set] = { normal:0, foil:0, units:0, value:0 };
    }

    bySet[set].normal += stock;
    bySet[set].foil += foilStock;
    bySet[set].units += stock + foilStock;
    bySet[set].value += (stock * normalPrice) + (foilStock * foilPrice);
  });

  return { totalValue, normalUnits, foilUnits, bySet };
}

function updateAdminStatsCenterV12(){
  const stats = calculateAdminStatsV12();
  if(!stats) return;

  const valueEl = document.getElementById("statInventoryValue");
  const normalEl = document.getElementById("statNormalUnits");
  const foilEl = document.getElementById("statFoilUnits");
  const chartEl = document.getElementById("setStockChart");

  if(valueEl) valueEl.textContent = formatCLPV12(stats.totalValue);
  if(normalEl) normalEl.textContent = Number(stats.normalUnits || 0).toLocaleString("es-CL");
  if(foilEl) foilEl.textContent = Number(stats.foilUnits || 0).toLocaleString("es-CL");

  if(chartEl){
    const rows = Object.entries(stats.bySet).sort((a,b)=>b[1].units-a[1].units);
    const maxUnits = Math.max(1, ...rows.map(([,v])=>v.units));

    chartEl.innerHTML = rows.map(([set, data])=>{
      const pct = Math.max(2, Math.round((data.units / maxUnits) * 100));
      return `
        <div class="set-chart-row-v12">
          <div class="set-chart-head-v12">
            <strong>${set}</strong>
            <span>${Number(data.units).toLocaleString("es-CL")} unidades · ${formatCLPV12(data.value)}</span>
          </div>
          <div class="set-chart-bar-v12">
            <div style="width:${pct}%"></div>
          </div>
          <small>Normal: ${Number(data.normal).toLocaleString("es-CL")} · Foil: ${Number(data.foil).toLocaleString("es-CL")}</small>
        </div>
      `;
    }).join("");
  }
}

function setupAdminCollapsiblesV12(){
  const panels = Array.from(document.querySelectorAll("section.panel"));
  panels.forEach(panel=>{
    if(panel.dataset.v12Ready === "1") return;
    panel.dataset.v12Ready = "1";

    const heading = panel.querySelector(":scope > h2, :scope > h3");
    if(!heading) return;

    const title = heading.textContent.trim();
    const lower = title.toLowerCase();

    panel.classList.add("admin-collapse-v12");

    const openByDefault =
      lower.includes("sincronización de precios") ||
      lower.includes("progreso") ||
      lower.includes("precio base") ||
      lower.includes("centro de estadísticas");

    panel.classList.toggle("open", openByDefault);
    panel.classList.toggle("closed", !openByDefault);

    const body = document.createElement("div");
    body.className = "admin-collapse-body-v12";

    Array.from(panel.children).forEach(child=>{
      if(child !== heading) body.appendChild(child);
    });

    const header = document.createElement("button");
    header.type = "button";
    header.className = "admin-collapse-header-v12";
    header.innerHTML = `<span>${title}</span><span class="admin-collapse-arrow-v12">${openByDefault ? "▼" : "▶"}</span>`;

    heading.replaceWith(header);
    panel.appendChild(body);

    header.addEventListener("click", ()=>{
      const isOpen = !panel.classList.contains("open");
      panel.classList.toggle("open", isOpen);
      panel.classList.toggle("closed", !isOpen);
      const arrow = header.querySelector(".admin-collapse-arrow-v12");
      if(arrow) arrow.textContent = isOpen ? "▼" : "▶";
    });
  });
}

// Patch existing render/updateStats without touching old code deeply
const __updateStatsOriginalV12 = typeof updateStats === "function" ? updateStats : null;
if(__updateStatsOriginalV12){
  updateStats = function(){
    __updateStatsOriginalV12();
    updateAdminStatsCenterV12();
  };
}

const __renderOriginalV12 = typeof render === "function" ? render : null;
if(__renderOriginalV12){
  render = function(){
    __renderOriginalV12();
    updateAdminStatsCenterV12();
  };
}

document.addEventListener("DOMContentLoaded", ()=>{
  setupAdminCollapsiblesV12();
  setTimeout(updateAdminStatsCenterV12, 500);
});


// v12.1 Restore backup from uploaded XLSX/JSON/ZIP
function normalizeHeaderV121(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function rowValueV121(row, names){
  const normalized = {};
  Object.keys(row || {}).forEach(key=>{
    normalized[normalizeHeaderV121(key)] = row[key];
  });

  for(const name of names){
    const key = normalizeHeaderV121(name);
    if(Object.prototype.hasOwnProperty.call(normalized, key)) return normalized[key];
  }
  return "";
}

function numberV121(value){
  const n = Number(String(value ?? "0").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function codeV121(value){
  const text = String(value || "").toUpperCase();
  const match = text.match(/([A-Z]{3})[-\s]?([A-Z]?\d{2,3}[A-Z]?)/);
  return match ? `${match[1]}-${match[2]}` : text.trim();
}

function cardKeyFromBackupRowV121(row){
  const code = codeV121(rowValueV121(row, ["Código", "Codigo", "Code", "publicCode", "dotggCode"]));
  if(code) return code;

  const set = rowValueV121(row, ["Set"]);
  const name = rowValueV121(row, ["Carta", "Nombre", "Name"]);
  return `${set}-${name}`;
}

function inventoryFromRowsV121(rows){
  const result = {};

  rows.forEach(row=>{
    const key = cardKeyFromBackupRowV121(row);
    if(!key) return;

    const stock = numberV121(rowValueV121(row, ["Stock Normal", "Stock", "Normal Stock", "stock"]));
    const foilStock = numberV121(rowValueV121(row, ["Stock Foil", "Foil Stock", "foilStock"]));
    const marketPrice = numberV121(rowValueV121(row, ["Mercado Normal USD", "Mercado USD", "Market USD", "marketPrice"]));
    const storePrice = numberV121(rowValueV121(row, ["LilStore Normal CLP", "LilStore CLP", "Precio CLP", "storePrice"]));
    const foilMarketPrice = numberV121(rowValueV121(row, ["Mercado Foil USD", "Foil Market USD", "foilMarketPrice"]));
    const foilStorePrice = numberV121(rowValueV121(row, ["LilStore Foil CLP", "Foil CLP", "foilStorePrice"]));

    result[key] = {
      stock: Math.max(0, Math.round(stock)),
      foilStock: Math.max(0, Math.round(foilStock)),
      marketPrice: Math.max(0, Number(marketPrice.toFixed ? marketPrice.toFixed(2) : marketPrice)),
      storePrice: Math.max(0, Math.round(storePrice)),
      foilMarketPrice: Math.max(0, Number(foilMarketPrice.toFixed ? foilMarketPrice.toFixed(2) : foilMarketPrice)),
      foilStorePrice: Math.max(0, Math.round(foilStorePrice))
    };
  });

  return result;
}

function looksLikeInventoryObjectV121(obj){
  if(!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if(!keys.length) return false;
  const first = obj[keys[0]];
  return typeof first === "number" || (first && typeof first === "object" && ("stock" in first || "foilStock" in first || "storePrice" in first));
}

async function parseBackupFileV121(file){
  const lower = file.name.toLowerCase();

  if(lower.endsWith(".json")){
    const text = await file.text();
    const parsed = JSON.parse(text);
    if(looksLikeInventoryObjectV121(parsed)) return parsed;
    if(Array.isArray(parsed)) return inventoryFromRowsV121(parsed);
    if(looksLikeInventoryObjectV121(parsed.inventory)) return parsed.inventory;
    if(Array.isArray(parsed.rows)) return inventoryFromRowsV121(parsed.rows);
    throw new Error("El JSON no parece ser un respaldo válido.");
  }

  if(lower.endsWith(".xlsx")){
    if(typeof XLSX === "undefined") throw new Error("No se cargó la librería XLSX.");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type:"array" });
    const sheetName = workbook.SheetNames.includes("Inventario") ? "Inventario" : workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval:"" });
    return inventoryFromRowsV121(rows);
  }

  if(lower.endsWith(".zip")){
    if(typeof JSZip === "undefined") throw new Error("No se cargó la librería JSZip.");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const files = Object.values(zip.files).filter(f=>!f.dir);
    const preferred = files.find(f=>/\.json$/i.test(f.name)) || files.find(f=>/\.xlsx$/i.test(f.name));
    if(!preferred) throw new Error("El ZIP no contiene JSON ni Excel de respaldo.");

    const blob = await preferred.async("blob");
    const nestedFile = new File([blob], preferred.name);
    return parseBackupFileV121(nestedFile);
  }

  throw new Error("Formato no soportado. Usa .xlsx, .json o .zip.");
}

async function restoreUploadedBackupV121(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador para restaurar respaldo.", true);
    return;
  }

  const file = restoreBackupFileInput?.files?.[0];
  if(!file){
    showMessage("Selecciona un respaldo Excel, JSON o ZIP.", true);
    return;
  }

  if(!confirm("¿Restaurar stock desde el archivo subido? Esto reemplazará el inventario remoto actual.")){
    return;
  }

  try{
    showMessage("Leyendo respaldo...");
    const parsedInventory = await parseBackupFileV121(file);

    if(!parsedInventory || !Object.keys(parsedInventory).length){
      showMessage("El respaldo no contiene inventario válido.", true);
      return;
    }

    inventory = parsedInventory;
    const ok = await saveInventoryToRemote(`Stock restaurado desde archivo. Registros: ${Object.keys(inventory).length}.`);
    if(ok){
      render();
      updateStats();
      if(typeof updateAdminStatsCenterV12 === "function") updateAdminStatsCenterV12();
    }
  }catch(error){
    console.error(error);
    showMessage("No se pudo restaurar el respaldo: " + (error.message || error), true);
  }
}

restoreUploadedBackupBtn?.addEventListener("click", restoreUploadedBackupV121);


// v12.1 Reliable collapsible fix
function fixCollapsiblesV121(){
  document.querySelectorAll(".admin-collapse-header-v12, .admin-collapsible-header").forEach(header=>{
    if(header.dataset.v121Fixed === "1") return;
    header.dataset.v121Fixed = "1";

    header.addEventListener("click", (event)=>{
      event.preventDefault();
      event.stopImmediatePropagation();

      const panel = header.closest("section.panel");
      if(!panel) return;

      const isOpen = panel.classList.contains("open");
      panel.classList.toggle("open", !isOpen);
      panel.classList.toggle("closed", isOpen);

      const arrow = header.querySelector(".admin-collapse-arrow-v12, .admin-collapsible-icon");
      if(arrow) arrow.textContent = !isOpen ? "▼" : "▶";
    }, true);
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  setTimeout(fixCollapsiblesV121, 50);
  setTimeout(fixCollapsiblesV121, 600);
});

// v13 smart sync and catalog integrity
function v13HistoryKey(){ return "lilstore_price_sync_history_v13"; }
function renderLastSyncV13(){
  const el=document.getElementById("lastPriceSyncInfo"); if(!el) return;
  const h=JSON.parse(localStorage.getItem(v13HistoryKey())||"[]");
  if(!h.length){el.textContent="Última actualización: todavía no se ha registrado una sincronización.";return;}
  const x=h[0], d=new Date(x.finishedAt), mode=x.mode==="stock"?"Solo cartas con stock":"Catálogo completo";
  el.innerHTML=`<strong>Última actualización:</strong> ${d.toLocaleString("es-CL")} · ${mode} · ${Number(x.processed||0).toLocaleString("es-CL")} procesadas · ${Number(x.updated||0).toLocaleString("es-CL")} actualizadas`;
}
function saveSyncV13(r){const h=JSON.parse(localStorage.getItem(v13HistoryKey())||"[]");h.unshift(r);localStorage.setItem(v13HistoryKey(),JSON.stringify(h.slice(0,10)));renderLastSyncV13();}
function payloadCardsV13(mode){
  const all=cards.map(card=>({name:card.name,publicCode:card.publicCode||card.dotggCode,dotggCode:card.dotggCode,set:card.set,setCode:card.setCode,rarity:card.rarity,stock:currentStockFor(card),foilStock:supportsFoil(card)?currentFoilStockFor(card):0,marketPrice:normalizeEntry(card).marketPrice,storePrice:normalizeEntry(card).storePrice,foilMarketPrice:supportsFoil(card)?normalizeEntry(card).foilMarketPrice:0,foilStorePrice:supportsFoil(card)?normalizeEntry(card).foilStorePrice:0}));
  return mode==="stock"?all.filter(c=>Number(c.stock||0)>0||Number(c.foilStock||0)>0):all;
}
async function syncPricesV13(mode="stock"){
  const pin=document.getElementById("adminPin").value.trim(); if(!pin){showMessage("Ingresa el PIN administrador antes de actualizar precios.",true);return;}
  const dollar=Number(document.getElementById("dollarInput")?.value||900), margin=Number(document.getElementById("marginInput")?.value||1), batchSize=25;
  const payloadCards=payloadCardsV13(mode); if(!payloadCards.length){showMessage(mode==="stock"?"No hay cartas con stock para actualizar.":"No hay cartas cargadas.",true);return;}
  __dotggSyncCancelRequested=false; let offset=0,totalUpdated=0,totalFailed=0,totalNotFound=0,totalProcessed=0,batch=1; const totalBatches=Math.ceil(payloadCards.length/batchSize), label=mode==="stock"?"cartas con stock":"todo el catálogo";
  setDotGGProgress(0,payloadCards.length,`Iniciando actualización de ${label}...`);
  while(offset<payloadCards.length){
    if(__dotggSyncCancelRequested){showMessage(`Sincronización cancelada. Procesadas: ${totalProcessed}.`,true);return;}
    const res=await fetch("/.netlify/functions/sync-riftboundgg-prices",{method:"POST",headers:{"Content-Type":"application/json","x-admin-pin":pin},body:JSON.stringify({cards:payloadCards,offset,limit:batchSize,dollar,margin,syncMode:mode})});
    const data=await res.json().catch(()=>({})); if(!res.ok){const detail=data.message||data.error||"No se pudieron sincronizar los precios.";showMessage(detail,true);setDotGGProgress(totalProcessed,payloadCards.length,`Error en lote ${batch}: ${detail}`);return;}
    const processed=Number(data.processed||data.uniqueCodes||0); totalProcessed+=processed; totalUpdated+=Number(data.updated||0); totalFailed+=Number(data.failedCount||0); totalNotFound+=Number(data.notFoundCount||0); offset=Number(data.nextOffset||(offset+batchSize));
    setDotGGProgress(Math.min(offset,payloadCards.length),payloadCards.length,`Lote ${batch}/${totalBatches} · Actualizadas: ${totalUpdated} · Sin precio: ${totalNotFound} · Errores técnicos: ${totalFailed}`); batch++; await new Promise(r=>setTimeout(r,800));
  }
  try{const r=await fetch("/.netlify/functions/stock?v="+Date.now(),{cache:"no-store"});if(r.ok)inventory=await r.json();}catch(e){}
  render(); updateStats(); saveSyncV13({finishedAt:new Date().toISOString(),mode,processed:totalProcessed,updated:totalUpdated,notFound:totalNotFound,failed:totalFailed});
  const msg=`Sincronización completa (${label}). Procesadas: ${totalProcessed}. Actualizadas: ${totalUpdated}. Sin precio: ${totalNotFound}. Errores técnicos: ${totalFailed}.`; setDotGGProgress(payloadCards.length,payloadCards.length,msg); showMessage(msg);
}
function renderCatalogAuditV13(data=null){const el=document.getElementById("catalogAuditSummary");if(!el)return;const x=data||JSON.parse(localStorage.getItem("lilstore_catalog_audit_v13")||"null");if(!x){el.textContent="Aún no se ha registrado una actualización de catálogo.";return;}const b=x.bySet||{};el.innerHTML=`<strong>Último catálogo:</strong> Origins ${Number(b.Origins||0).toLocaleString("es-CL")} · Spiritforged ${Number(b.Spiritforged||0).toLocaleString("es-CL")} · Unleashed ${Number(b.Unleashed||0).toLocaleString("es-CL")} · Total ${Number(x.saved||0).toLocaleString("es-CL")}`;}
const __catalogOriginalV13=typeof syncDotGGCatalog==="function"?syncDotGGCatalog:null;
if(__catalogOriginalV13){syncDotGGCatalog=async function(){const pin=document.getElementById("adminPin").value.trim();if(!pin){showMessage("Ingresa el PIN administrador antes de actualizar catálogo.",true);return;}showMessage("Actualizando catálogo desde DotGG...");const res=await fetch("/.netlify/functions/sync-dotgg-catalog",{method:"POST",headers:{"Content-Type":"application/json","x-admin-pin":pin},body:JSON.stringify({currentCards:cards.map(c=>({name:c.name,publicCode:c.publicCode,dotggCode:c.dotggCode,set:c.set,setCode:c.setCode,tcgplayerId:c.tcgplayerId,cardType:c.cardType}))})});const data=await res.json().catch(()=>({}));if(!res.ok){showMessage(data.error||data.message||"No se pudo actualizar el catálogo.",true);return;}localStorage.setItem("lilstore_catalog_audit_v13",JSON.stringify({saved:data.saved,bySet:data.bySet,duplicateCount:data.duplicateCount||0,updatedAt:new Date().toISOString()}));renderCatalogAuditV13(data);try{const cr=await fetch("/.netlify/functions/catalog?v="+Date.now(),{cache:"no-store"});if(cr.ok){const rc=await cr.json();if(Array.isArray(rc)&&rc.length)cards=rc;}}catch(e){}render();showMessage(`Catálogo actualizado: ${data.saved} cartas. Origins: ${data.bySet?.Origins||0}, Spiritforged: ${data.bySet?.Spiritforged||0}, Unleashed: ${data.bySet?.Unleashed||0}.`);};}
document.addEventListener("DOMContentLoaded",()=>{syncStockPricesBtn?.addEventListener("click",()=>syncPricesV13("stock"));syncAllPricesBtn?.addEventListener("click",()=>syncPricesV13("all"));renderLastSyncV13();renderCatalogAuditV13();const old=document.getElementById("syncCatalogBtn");if(old){const n=old.cloneNode(true);old.parentNode.replaceChild(n,old);n.addEventListener("click",syncDotGGCatalog);}});


// v13.1 - Catalog integrity audit
function normalizeCatalogNameV131(name){
  return String(name || "")
    .replace(/\s*\(Showcase\)\s*$/i, "")
    .trim()
    .toLowerCase();
}

function catalogCardCodeV131(card){
  const text = String(card.publicCode || card.dotggCode || "").toUpperCase();
  const match = text.match(/([A-Z]{3})[-\s]?([A-Z]?\d{2,3}[A-Z]?)/);
  return match ? `${match[1]}-${match[2]}` : text.trim();
}

function auditCatalogV131(){
  const bySet = {};
  const names = {};
  const codes = {};
  const invalid = [];

  cards.forEach(card=>{
    const set = card.set || card.setCode || "Sin set";
    const setCode = card.setCode || String(card.publicCode || card.dotggCode || "").slice(0,3).toUpperCase();
    const code = catalogCardCodeV131(card);
    const nameKey = normalizeCatalogNameV131(card.name);

    bySet[set] = (bySet[set] || 0) + 1;

    if(!names[nameKey]) names[nameKey] = new Set();
    names[nameKey].add(setCode || set);

    if(!codes[code]) codes[code] = [];
    codes[code].push(card);

    if(!card.name || !setCode || !code){
      invalid.push(card);
    }
  });

  const duplicateNameGroups = Object.entries(names)
    .filter(([, setCodes])=>setCodes.size > 1)
    .map(([name, setCodes])=>({ name, sets:Array.from(setCodes).sort() }))
    .sort((a,b)=>a.name.localeCompare(b.name));

  const duplicateCodes = Object.entries(codes)
    .filter(([, entries])=>entries.length > 1)
    .map(([code, entries])=>({ code, entries }));

  return {
    total: cards.length,
    bySet,
    duplicateNameGroups,
    duplicateCodes,
    invalid
  };
}

function renderCatalogIntegrityV131(result){
  const el = document.getElementById("catalogIntegrityResult");
  if(!el) return;

  const duplicateNameExamples = result.duplicateNameGroups.slice(0, 12).map(group=>`
    <div class="catalog-name-group-v131">
      <strong>${group.name}</strong>
      <span>${group.sets.join(" · ")}</span>
    </div>
  `).join("");

  const statusOk = result.duplicateCodes.length === 0 && result.invalid.length === 0;

  el.innerHTML = `
    <div class="catalog-integrity-summary-v131">
      <div>
        <span>Estado</span>
        <strong>${statusOk ? "Catálogo correcto" : "Revisar catálogo"}</strong>
      </div>
      <div>
        <span>Total</span>
        <strong>${Number(result.total).toLocaleString("es-CL")}</strong>
      </div>
      <div>
        <span>Nombres presentes en varios sets</span>
        <strong>${Number(result.duplicateNameGroups.length).toLocaleString("es-CL")}</strong>
      </div>
      <div>
        <span>Códigos duplicados reales</span>
        <strong>${Number(result.duplicateCodes.length).toLocaleString("es-CL")}</strong>
      </div>
    </div>

    <div class="catalog-set-counts-v131">
      <strong>Conteo por set:</strong>
      <span>Origins: ${Number(result.bySet.Origins || 0).toLocaleString("es-CL")}</span>
      <span>Spiritforged: ${Number(result.bySet.Spiritforged || 0).toLocaleString("es-CL")}</span>
      <span>Unleashed: ${Number(result.bySet.Unleashed || 0).toLocaleString("es-CL")}</span>
    </div>

    <div class="catalog-name-examples-v131">
      <h3>Ejemplos de nombres compartidos entre sets</h3>
      ${duplicateNameExamples || "<p>No se encontraron nombres compartidos entre sets.</p>"}
    </div>
  `;

  localStorage.setItem("lilstore_catalog_integrity_v131", JSON.stringify({
    checkedAt:new Date().toISOString(),
    total:result.total,
    bySet:result.bySet,
    duplicateNameGroupCount:result.duplicateNameGroups.length,
    duplicateCodeCount:result.duplicateCodes.length,
    invalidCount:result.invalid.length
  }));
}

function runCatalogAuditV131(){
  if(!Array.isArray(cards) || !cards.length){
    showMessage("El catálogo aún no está cargado.", true);
    return;
  }

  const result = auditCatalogV131();
  renderCatalogIntegrityV131(result);

  if(result.duplicateCodes.length || result.invalid.length){
    showMessage(`Revisión terminada: ${result.duplicateCodes.length} códigos duplicados y ${result.invalid.length} registros incompletos.`, true);
  }else{
    showMessage(`Catálogo correcto: ${result.total} cartas identificadas por set y código.`);
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("auditCurrentCatalogBtn")?.addEventListener("click", runCatalogAuditV131);
  setTimeout(()=>{
    if(Array.isArray(cards) && cards.length) runCatalogAuditV131();
  }, 1200);
});

priceFilter?.addEventListener("change", render);


// v14 - Professional order management
const deliverOrderBtn = document.getElementById("deliverOrderBtn");
const cancelOrderBtn = document.getElementById("cancelOrderBtn");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
const orderStatusFilter = document.getElementById("orderStatusFilter");
const ordersHistory = document.getElementById("ordersHistory");

function orderStatusLabelV14(status){
  const map = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    completed: "Confirmado",
    delivered: "Entregado",
    cancelled: "Cancelado"
  };
  return map[status] || "Pendiente";
}

function orderStatusClassV14(status){
  const normalized = status === "completed" ? "confirmed" : (status || "pending");
  return `order-status-${normalized}`;
}

function formatOrderDateV14(value){
  if(!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-CL");
}

function renderOrderPreviewV14(order){
  if(!orderPreview) return;

  const itemsHtml = (order.items || []).map(item=>{
    const variant = item.variant === "foil" ? "Foil" : "Normal";
    return `
      <div class="order-preview-item">
        <strong>${item.name}</strong>
        <span>${item.code || item.cardKey} · ${variant} x${item.qty}</span>
        <b>$${Number(item.subtotal || 0).toLocaleString("es-CL")} CLP</b>
      </div>
    `;
  }).join("");

  orderPreview.innerHTML = `
    <div class="order-preview-head">
      <div>
        <strong>Pedido #${order.id}</strong>
        <small>Creado: ${formatOrderDateV14(order.createdAt)}</small>
      </div>
      <span class="order-status-pill ${orderStatusClassV14(order.status)}">
        ${orderStatusLabelV14(order.status)}
      </span>
    </div>

    <div class="order-dates-v14">
      <span>Confirmado: ${formatOrderDateV14(order.confirmedAt || order.completedAt)}</span>
      <span>Entregado: ${formatOrderDateV14(order.deliveredAt)}</span>
      <span>Cancelado: ${formatOrderDateV14(order.cancelledAt)}</span>
    </div>

    <div class="order-preview-list">${itemsHtml}</div>

    <div class="order-preview-total">
      <span>Total</span>
      <strong>$${Number(order.total || 0).toLocaleString("es-CL")} CLP</strong>
    </div>
  `;
}

async function adminOrderRequestV14(action, orderId){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador.", true);
    return null;
  }

  const res = await fetch("/.netlify/functions/orders", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-pin":pin
    },
    body:JSON.stringify({ action, orderId })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showMessage(data.error || "No se pudo actualizar el pedido.", true);
    if(data.order) renderOrderPreviewV14(data.order);
    return null;
  }

  if(data.inventory){
    inventory = data.inventory;
    render();
    updateStats();
  }

  if(data.order) renderOrderPreviewV14(data.order);
  showMessage(data.message || "Pedido actualizado.");
  await loadOrdersHistoryV14();
  return data;
}

async function deliverOrderV14(){
  const id = cleanOrderId(orderIdInput?.value);
  if(!id || id === "00000"){
    showMessage("Ingresa un número de pedido válido.", true);
    return;
  }

  if(!confirm(`¿Marcar el pedido #${id} como entregado?`)) return;
  await adminOrderRequestV14("deliver", id);
}

async function cancelOrderV14(){
  const id = cleanOrderId(orderIdInput?.value);
  if(!id || id === "00000"){
    showMessage("Ingresa un número de pedido válido.", true);
    return;
  }

  if(!confirm(`¿Cancelar el pedido #${id}? Solo se permite si aún no descontó stock.`)) return;
  await adminOrderRequestV14("cancel", id);
}

function renderOrdersHistoryV14(orders){
  if(!ordersHistory) return;

  if(!orders.length){
    ordersHistory.innerHTML = '<div class="orders-empty-v14">No hay pedidos para este filtro.</div>';
    return;
  }

  ordersHistory.innerHTML = orders.map(order=>`
    <button class="order-history-card-v14" type="button" data-order-id="${order.id}">
      <div>
        <strong>#${order.id}</strong>
        <span>${formatOrderDateV14(order.createdAt)}</span>
      </div>
      <div>
        <span>${(order.items || []).reduce((sum,item)=>sum + Number(item.qty || 0), 0)} cartas</span>
        <strong>$${Number(order.total || 0).toLocaleString("es-CL")} CLP</strong>
      </div>
      <span class="order-status-pill ${orderStatusClassV14(order.status)}">
        ${orderStatusLabelV14(order.status)}
      </span>
    </button>
  `).join("");

  ordersHistory.querySelectorAll("[data-order-id]").forEach(button=>{
    button.addEventListener("click", async ()=>{
      const id = button.dataset.orderId;
      if(orderIdInput) orderIdInput.value = id;

      const res = await fetch("/.netlify/functions/orders?id=" + encodeURIComponent(id), {
        cache:"no-store"
      });
      const data = await res.json().catch(()=>({}));

      if(res.ok && data.order){
        renderOrderPreviewV14(data.order);
      }else{
        showMessage(data.error || "No se pudo cargar el pedido.", true);
      }
    });
  });
}

async function loadOrdersHistoryV14(){
  if(!ordersHistory) return;

  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    ordersHistory.textContent = "Ingresa el PIN administrador para ver el historial.";
    return;
  }

  ordersHistory.textContent = "Cargando historial…";
  const status = orderStatusFilter?.value || "";

  const res = await fetch(
    "/.netlify/functions/orders?list=1&status=" + encodeURIComponent(status),
    {
      headers:{ "x-admin-pin":pin },
      cache:"no-store"
    }
  );

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    ordersHistory.textContent = data.error || "No se pudo cargar el historial.";
    return;
  }

  renderOrdersHistoryV14(data.orders || []);
}

// Override previous order preview with richer version.
renderOrderPreview = renderOrderPreviewV14;

deliverOrderBtn?.addEventListener("click", deliverOrderV14);
cancelOrderBtn?.addEventListener("click", cancelOrderV14);
refreshOrdersBtn?.addEventListener("click", loadOrdersHistoryV14);
orderStatusFilter?.addEventListener("change", loadOrdersHistoryV14);

document.addEventListener("DOMContentLoaded", ()=>{
  setTimeout(loadOrdersHistoryV14, 800);
});
