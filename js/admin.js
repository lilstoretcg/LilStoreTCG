let cards = [];
let remoteStock = {};

const rowsEl = document.getElementById("stockRows");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");
const saveBtn = document.getElementById("saveBtn");
const message = document.getElementById("message");

function keyFor(card){
  return card.publicCode || `${card.setCode || card.set}-${card.name}`;
}

function showMessage(text, isError=false){
  message.textContent = text;
  message.style.color = isError ? "#fecaca" : "#a7f3d0";
}

function currentStockFor(card){
  const key = keyFor(card);
  return Number(remoteStock[key] ?? card.stock ?? 0);
}

function updateStats(filtered){
  const all = filtered || cards;
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
    const stock = currentStockFor(card);

    return `
      <tr>
        <td>
          <div class="card-name">${card.name}</div>
          <div class="card-code">${card.cardType || ""}</div>
        </td>
        <td>${card.set}</td>
        <td>${card.rarity}</td>
        <td>${card.publicCode || "-"}</td>
        <td>
          <input type="number" min="0" value="${stock}" data-stock-key="${key}">
        </td>
      </tr>
    `;
  }).join("");

  updateStats(filtered);
}

async function load(){
  const cardsRes = await fetch("data/cards.json");
  cards = await cardsRes.json();

  try{
    const stockRes = await fetch("/.netlify/functions/stock");
    if(stockRes.ok){
      remoteStock = await stockRes.json();
    }
  }catch(e){
    remoteStock = {};
    showMessage("Modo local: no se pudo leer stock remoto. En Netlify funcionará con Functions.", true);
  }

  render();
}

async function save(){
  const pin = document.getElementById("adminPin").value.trim();
  if(!pin){
    showMessage("Ingresa el PIN administrador.", true);
    return;
  }

  document.querySelectorAll("[data-stock-key]").forEach(input=>{
    const key = input.dataset.stockKey;
    const value = Math.max(0, Number(input.value || 0));
    if(value > 0) remoteStock[key] = value;
    else delete remoteStock[key];
  });

  const res = await fetch("/.netlify/functions/stock", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-admin-pin": pin
    },
    body: JSON.stringify({ stock: remoteStock })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showMessage(data.error || "No se pudo guardar.", true);
    return;
  }

  showMessage(`Stock guardado correctamente. Cartas con stock: ${data.updated}`);
  render();
}

searchInput.addEventListener("input", render);
stockFilter.addEventListener("change", render);
saveBtn.addEventListener("click", save);

load();
