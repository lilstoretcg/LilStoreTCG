let cart = JSON.parse(localStorage.getItem("cart") || "[]");

function keyFor(card){
  return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
}

function peso(n){
  return Number(n || 0).toLocaleString("es-CL");
}

function normalizeCartItem(item){
  return {
    cardKey: item.cardKey || item.publicCode || item.dotggCode || null,
    legacyId: item.id ?? null,
    qty: Number(item.qty || 1)
  };
}

function saveCart(){
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount(){
  const count = cart.reduce((sum,item)=>sum + Number(item.qty || 0), 0);
  const el = document.getElementById("cartCount");
  if(el) el.textContent = count;
}

function ensureCartLayout(){
  let container = document.getElementById("cartItems") || document.getElementById("cart") || document.getElementById("cartList");
  let totalEl = document.getElementById("cartTotal") || document.getElementById("total");
  let whatsappBtn = document.getElementById("whatsappBtn");

  const h1 = [...document.querySelectorAll("h1")].find(x => x.textContent.toLowerCase().includes("carrito"));

  if(!container){
    container = document.createElement("div");
    container.id = "cartItems";
    if(h1) h1.insertAdjacentElement("afterend", container);
    else document.body.appendChild(container);
  }

  if(!totalEl){
    const p = document.createElement("p");
    p.className = "cart-total-line";
    p.innerHTML = `Total: <strong id="cartTotal">$0 CLP</strong>`;
    container.insertAdjacentElement("afterend", p);
    totalEl = document.getElementById("cartTotal");
  }

  if(!whatsappBtn){
    whatsappBtn = document.createElement("a");
    whatsappBtn.id = "whatsappBtn";
    whatsappBtn.className = "whatsapp-btn";
    whatsappBtn.href = "#";
    whatsappBtn.textContent = "Finalizar por WhatsApp";
    totalEl.parentElement.insertAdjacentElement("afterend", whatsappBtn);
  }

  return { container, totalEl, whatsappBtn };
}

async function loadJson(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`No se pudo cargar ${url}`);
  return await res.json();
}

async function loadRemoteCatalog(){
  try{
    const data = await loadJson("/.netlify/functions/catalog?v=" + Date.now());
    if(Array.isArray(data) && data.length) return data;
  }catch(e){}
  return [];
}

async function loadLocalCatalog(){
  try{
    const data = await loadJson("data/cards.json?v=" + Date.now());
    if(Array.isArray(data) && data.length) return data;
  }catch(e){}
  return [];
}

async function loadInventory(){
  try{
    const data = await loadJson("/.netlify/functions/stock?v=" + Date.now());
    return data && typeof data === "object" ? data : {};
  }catch(e){
    return {};
  }
}

function applyInventory(cards, inventory){
  return cards.map(card=>{
    const key = keyFor(card);
    const entry = inventory[key];

    if(entry === undefined){
      return card;
    }

    if(typeof entry === "number"){
      const stockValue = Number(entry || 0);
      return {
        ...card,
        stock: stockValue,
        status: stockValue > 0 ? "available" : "soldout"
      };
    }

    const stockValue = Number(entry.stock ?? card.stock ?? 0);
    return {
      ...card,
      stock: stockValue,
      status: stockValue > 0 ? "available" : "soldout",
      marketPrice: Number(entry.marketPrice ?? card.marketPrice ?? 0),
      storePrice: Number(entry.storePrice ?? card.storePrice ?? 0)
    };
  });
}

function findCard(catalogCards, localCards, item){
  const normalized = normalizeCartItem(item);

  if(normalized.cardKey){
    const byKey = catalogCards.find(card =>
      keyFor(card) === normalized.cardKey ||
      card.publicCode === normalized.cardKey ||
      card.dotggCode === normalized.cardKey
    );
    if(byKey) return byKey;
  }

  // Legacy carts saved before DotGG catalog used numeric ids.
  if(normalized.legacyId !== null && normalized.legacyId !== undefined){
    const localById = localCards.find(card => Number(card.id) === Number(normalized.legacyId));
    if(localById){
      const stableKey = keyFor(localById);
      return catalogCards.find(card =>
        keyFor(card) === stableKey ||
        card.publicCode === localById.publicCode ||
        card.dotggCode === localById.dotggCode
      ) || localById;
    }

    const remoteById = catalogCards.find(card => Number(card.id) === Number(normalized.legacyId));
    if(remoteById) return remoteById;
  }

  return null;
}

function migrateCart(catalogCards, localCards){
  let changed = false;

  cart = cart.map(item=>{
    const card = findCard(catalogCards, localCards, item);
    const qty = Number(item.qty || 1);

    if(card){
      const stableKey = keyFor(card);
      if(item.cardKey !== stableKey || item.id !== undefined){
        changed = true;
      }
      return { cardKey: stableKey, qty };
    }

    return item;
  });

  if(changed){
    localStorage.setItem("cart", JSON.stringify(cart));
  }
}

function removeItem(cardKey){
  cart = cart.filter(item => normalizeCartItem(item).cardKey !== cardKey);
  saveCart();
  renderCart();
}

function clearCart(){
  cart = [];
  saveCart();
  renderCart();
}

async function renderCart(){
  updateCartCount();

  const { container, totalEl, whatsappBtn } = ensureCartLayout();

  let remoteCards = await loadRemoteCatalog();
  const localCards = await loadLocalCatalog();

  // Fallback for first deploy or if Blobs catalog is empty.
  if(!remoteCards.length) remoteCards = localCards;

  const inventory = await loadInventory();
  const cards = applyInventory(remoteCards, inventory);
  const localWithInventory = applyInventory(localCards, inventory);

  migrateCart(cards, localWithInventory);

  if(!cart.length){
    container.innerHTML = `<div class="cart-empty">Tu carrito está vacío.</div>`;
    if(totalEl) totalEl.textContent = "$0 CLP";
    if(whatsappBtn){
      whatsappBtn.href = "#";
      whatsappBtn.onclick = (event) => {
        event.preventDefault();
        alert("Tu carrito está vacío.");
      };
    }
    return;
  }

  let total = 0;
  const lines = [];

  container.innerHTML = cart.map(item=>{
    const normalized = normalizeCartItem(item);
    const card = findCard(cards, localWithInventory, item);
    const qty = Number(normalized.qty || 1);

    if(!card){
      return `
        <div class="cart-item missing">
          <div class="cart-info">
            <strong>Carta no encontrada</strong>
            <p>Este producto quedó guardado desde una versión anterior.</p>
            <p>Clave: ${normalized.cardKey || normalized.legacyId || "sin clave"}</p>
          </div>
          <button onclick="removeItem('${normalized.cardKey || ""}')">❌ Eliminar</button>
        </div>
      `;
    }

    const cardKey = keyFor(card);
    const unitPrice = Number(card.storePrice || 0);
    const subtotal = unitPrice * qty;
    total += subtotal;

    lines.push(`${card.name} x${qty} - ${peso(subtotal)} CLP`);

    return `
      <div class="cart-item">
        <img src="${card.image || "assets/logo.png"}" alt="${card.name}" onerror="this.src='assets/logo.png'">
        <div class="cart-info">
          <strong>${card.name} x${qty}</strong>
          <p>${card.set || ""} · ${card.rarity || ""} · ${card.publicCode || card.dotggCode || ""}</p>
          <p>Precio unidad: $${peso(unitPrice)} CLP</p>
          <p>Subtotal: $${peso(subtotal)} CLP</p>
        </div>
        <button onclick="removeItem('${cardKey}')">❌ Eliminar</button>
      </div>
    `;
  }).join("");

  if(totalEl) totalEl.textContent = `$${peso(total)} CLP`;

  if(whatsappBtn){
    const message = [
      "Hola, quiero hacer este pedido en LilStore TCG:",
      ...lines,
      `Total: ${peso(total)} CLP`
    ].join("\n");

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;

    whatsappBtn.href = url;
    whatsappBtn.target = "_blank";
    whatsappBtn.rel = "noopener noreferrer";
    whatsappBtn.onclick = (event) => {
      event.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    };
  }
}

window.removeItem = removeItem;
window.clearCart = clearCart;
window.renderCart = renderCart;

document.addEventListener("DOMContentLoaded", renderCart);
