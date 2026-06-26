let cards = [];
let inventory = {};

const rowsEl = document.getElementById("stockRows");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");
const saveBtn = document.getElementById("saveBtn");
const syncPricesBtn = document.getElementById("syncPricesBtn");
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
      action:"complete",
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
  showMessage(data.message || `Pedido #${id} descontado correctamente.`);
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
      `Lote ${lote} de ${totalLotes} · Cartas ${loteDesde}-${loteHasta} · Actualizadas: ${totalUpdated} · Sin precio: ${totalNotFound} · Fallidas: ${totalFailed}`
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
      `Actualizadas: ${totalUpdated} · Sin precio: ${totalNotFound} · Fallidas: ${totalFailed}`
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
