let cards = [];
let inventory = {};

const rowsEl = document.getElementById("stockRows");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");
const saveBtn = document.getElementById("saveBtn");
const message = document.getElementById("message");

function keyFor(card){
  return card.publicCode || `${card.setCode || card.set}-${card.name}`;
}

function normalizeEntry(card){
  const key = keyFor(card);
  const entry = inventory[key];

  // Compatibility with previous version where stored value was only a number.
  if(typeof entry === "number"){
    return {
      stock: entry,
      marketPrice: Number(card.marketPrice || 0),
      storePrice: Number(card.storePrice || 0)
    };
  }

  return {
    stock: Number(entry?.stock ?? card.stock ?? 0),
    marketPrice: Number(entry?.marketPrice ?? card.marketPrice ?? 0),
    storePrice: Number(entry?.storePrice ?? card.storePrice ?? 0)
  };
}

function showMessage(text, isError=false){
  message.textContent = text;
  message.style.color = isError ? "#fecaca" : "#a7f3d0";
}

function currentStockFor(card){
  return normalizeEntry(card).stock;
}

function updateStats(){
  const totalUnits = cards.reduce((sum, card)=>sum + currentStockFor(card), 0);
  const availableCards = cards.filter(card=>currentStockFor(card)>0).length;
  document.getElementById("totalCards").textContent = cards.length;
  document.getElementById("availableCards").textContent = availableCards;
  document.getElementById("totalUnits").textContent = totalUnits;
}

function render(){
  const q = searchInput.value.toLowerCase();
  const filter = stockFilter.value;

  const filtered = cards.filter(card=>{
    const stock = currentStockFor(card);
    const matchesText =
      card.name.toLowerCase().includes(q) ||
      String(card.publicCode || "").toLowerCase().includes(q);

    const matchesStock =
      !filter ||
      (filter === "available" && stock > 0) ||
      (filter === "soldout" && stock <= 0);

    return matchesText && matchesStock;
  });

  rowsEl.innerHTML = filtered.map(card=>{
    const key = keyFor(card);
    const entry = normalizeEntry(card);

    return `
      <tr>
        <td>
          <div class="card-name">${card.name}</div>
          <div class="card-code">${card.cardType || ""}</div>
        </td>
        <td>${card.set}</td>
        <td>${card.rarity}</td>
        <td>${card.publicCode || "-"}</td>
        <td><input type="number" min="0" value="${entry.stock}" data-field="stock" data-card-key="${key}"></td>
        <td><input type="number" min="0" step="0.01" value="${entry.marketPrice}" data-field="marketPrice" data-card-key="${key}"></td>
        <td><input type="number" min="0" step="1" value="${entry.storePrice}" data-field="storePrice" data-card-key="${key}"></td>
      </tr>
    `;
  }).join("");

  updateStats();
}

async function load(){
  const cardsRes = await fetch("data/cards.json");
  cards = await cardsRes.json();

  try{
    const invRes = await fetch("/.netlify/functions/stock");
    if(invRes.ok){
      inventory = await invRes.json();
    }
  }catch(e){
    inventory = {};
    showMessage("Modo local: no se pudo leer inventario remoto. En Netlify funcionará con Functions.", true);
  }

  render();
}

async function save(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador.", true);
    return;
  }

  document.querySelectorAll("[data-card-key]").forEach(input=>{
    const key = input.dataset.cardKey;
    const field = input.dataset.field;
    const value = Number(input.value || 0);

    if(typeof inventory[key] === "number"){
      inventory[key] = { stock: inventory[key] };
    }

    inventory[key] = inventory[key] || {};
    inventory[key][field] = field === "marketPrice" ? Math.max(0, Number(value.toFixed(2))) : Math.max(0, Math.round(value));
  });

  // Remove fully empty entries to keep Blobs clean.
  Object.keys(inventory).forEach(key=>{
    const e = inventory[key];
    if(!e || (Number(e.stock || 0) <= 0 && Number(e.marketPrice || 0) <= 0 && Number(e.storePrice || 0) <= 0)){
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

searchInput.addEventListener("input", render);
stockFilter.addEventListener("change", render);
saveBtn.addEventListener("click", save);

load();
