let cart = JSON.parse(localStorage.getItem("cart") || "[]");

function keyFor(card){
  return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
}

function normalizeCartItem(item){
  // Compatible with older carts saved as {id, qty}
  if(item.cardKey){
    return { cardKey: item.cardKey, qty: Number(item.qty || 1) };
  }

  if(item.publicCode){
    return { cardKey: item.publicCode, qty: Number(item.qty || 1) };
  }

  if(item.dotggCode){
    return { cardKey: item.dotggCode, qty: Number(item.qty || 1) };
  }

  return { id: item.id, qty: Number(item.qty || 1) };
}

function saveCart(){
  localStorage.setItem("cart", JSON.stringify(cart));
}

async function loadCatalog(){
  try{
    const remote = await fetch("/.netlify/functions/catalog");
    if(remote.ok){
      const remoteCards = await remote.json();
      if(Array.isArray(remoteCards) && remoteCards.length){
        return remoteCards;
      }
    }
  }catch(e){}

  const cardsRes = await fetch("data/cards.json");
  return await cardsRes.json();
}

async function loadInventory(){
  try{
    const res = await fetch("/.netlify/functions/stock");
    if(!res.ok) return {};
    return await res.json();
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

function peso(n){
  return Number(n || 0).toLocaleString("es-CL");
}

function findCard(cards, item){
  const normalized = normalizeCartItem(item);

  if(normalized.cardKey){
    return cards.find(card => keyFor(card) === normalized.cardKey || card.publicCode === normalized.cardKey || card.dotggCode === normalized.cardKey);
  }

  // Legacy fallback by id, only for carts saved before v7.2.
  return cards.find(card => Number(card.id) === Number(normalized.id));
}

function migrateCart(cards){
  let changed = false;

  cart = cart.map(item=>{
    const card = findCard(cards, item);
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

  if(changed) saveCart();
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
  const container = document.getElementById("cartItems") || document.getElementById("cart");
  const totalEl = document.getElementById("cartTotal") || document.getElementById("total");
  const whatsappBtn = document.getElementById("whatsappBtn");

  if(!container) return;

  const rawCards = await loadCatalog();
  const inventory = await loadInventory();
  const cards = applyInventory(rawCards, inventory);

  migrateCart(cards);

  if(!cart.length){
    container.innerHTML = `<div class="cart-empty">Tu carrito está vacío.</div>`;
    if(totalEl) totalEl.textContent = "$0 CLP";
    if(whatsappBtn) whatsappBtn.href = "#";
    return;
  }

  let total = 0;
  const lines = [];

  container.innerHTML = cart.map(item=>{
    const normalized = normalizeCartItem(item);
    const card = findCard(cards, item);
    const qty = Number(normalized.qty || 1);

    if(!card){
      return `
        <div class="cart-item missing">
          <div>
            <strong>Carta no encontrada</strong>
            <p>Esta carta quedó guardada desde una versión anterior del catálogo.</p>
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

    whatsappBtn.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
}

window.removeItem = removeItem;
window.clearCart = clearCart;
window.renderCart = renderCart;

renderCart();
