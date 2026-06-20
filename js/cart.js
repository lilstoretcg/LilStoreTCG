(function(){
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");

  function keyFor(card){
    return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
  }

  function peso(n){
    return Number(n || 0).toLocaleString("es-CL");
  }

  function saveCart(){
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCount();
  }

  function updateCartCount(){
    const count = cart.reduce((sum,item)=>sum + Number(item.qty || 0), 0);
    document.querySelectorAll("#cartCount, #cartLabelCount").forEach(el => el.textContent = count);
  }

  function normalizeCartItem(item){
    return {
      cardKey: item.cardKey || item.publicCode || item.dotggCode || null,
      legacyId: item.id ?? null,
      variant: item.variant || "normal",
      qty: Number(item.qty || 1)
    };
  }

  function ensureLayout(){
    let container = document.getElementById("cartItems");

    if(!container){
      container = document.createElement("div");
      container.id = "cartItems";
      const h1 = [...document.querySelectorAll("h1")].find(x => x.textContent.toLowerCase().includes("carrito"));
      if(h1) h1.insertAdjacentElement("afterend", container);
      else document.body.appendChild(container);
    }

    let totalEl = document.getElementById("cartTotal");
    if(!totalEl){
      const totalLine = document.createElement("p");
      totalLine.className = "cart-total-line";
      totalLine.innerHTML = `Total: <strong id="cartTotal">$0 CLP</strong>`;
      container.insertAdjacentElement("afterend", totalLine);
      totalEl = document.getElementById("cartTotal");
    }

    let whatsappBtn = document.getElementById("whatsappBtn");
    if(!whatsappBtn){
      whatsappBtn = document.createElement("a");
      whatsappBtn.id = "whatsappBtn";
      whatsappBtn.className = "whatsapp-btn";
      whatsappBtn.href = "#";
      whatsappBtn.textContent = "Finalizar por WhatsApp";
      totalEl.parentElement.insertAdjacentElement("afterend", whatsappBtn);
    }

    return {container, totalEl, whatsappBtn};
  }

  async function safeJson(url){
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) throw new Error(url);
    return await res.json();
  }

  async function loadCatalogs(){
    let remoteCards = [];
    let localCards = [];

    try{
      const remote = await safeJson("/.netlify/functions/catalog?v=" + Date.now());
      if(Array.isArray(remote)) remoteCards = remote;
    }catch(e){}

    try{
      const local = await safeJson("data/cards.json?v=" + Date.now());
      if(Array.isArray(local)) localCards = local;
    }catch(e){}

    if(!remoteCards.length) remoteCards = localCards;
    return {remoteCards, localCards};
  }

  async function loadInventory(){
    try{
      const data = await safeJson("/.netlify/functions/stock?v=" + Date.now());
      return data && typeof data === "object" ? data : {};
    }catch(e){
      return {};
    }
  }

  function applyInventory(cards, inventory){
    return cards.map(card=>{
      const key = keyFor(card);
      const entry = inventory[key];

      if(entry === undefined) return card;

      if(typeof entry === "number"){
        const stockValue = Number(entry || 0);
        return {...card, stock: stockValue, foilStock:0, status: stockValue > 0 ? "available" : "soldout"};
      }

      const stockValue = Number(entry.stock ?? card.stock ?? 0);
      const foilStock = Number(entry.foilStock ?? card.foilStock ?? 0);
      return {
        ...card,
        stock: stockValue,
        status: (stockValue > 0 || foilStock > 0) ? "available" : "soldout",
        marketPrice: Number(entry.marketPrice ?? card.marketPrice ?? 0),
        storePrice: Number(entry.storePrice ?? card.storePrice ?? 0),
        foilStock,
        foilMarketPrice: Number(entry.foilMarketPrice ?? card.foilMarketPrice ?? 0),
        foilStorePrice: Number(entry.foilStorePrice ?? card.foilStorePrice ?? 0)
      };
    });
  }

  function findCard(catalogCards, localCards, item){
    const normalized = normalizeCartItem(item);

    if(normalized.cardKey){
      const found = catalogCards.find(card =>
        keyFor(card) === normalized.cardKey ||
        card.publicCode === normalized.cardKey ||
        card.dotggCode === normalized.cardKey
      );
      if(found) return found;
    }

    if(normalized.legacyId !== null && normalized.legacyId !== undefined){
      const local = localCards.find(card => Number(card.id) === Number(normalized.legacyId));
      if(local){
        const stable = keyFor(local);
        return catalogCards.find(card =>
          keyFor(card) === stable ||
          card.publicCode === local.publicCode ||
          card.dotggCode === local.dotggCode
        ) || local;
      }

      return catalogCards.find(card => Number(card.id) === Number(normalized.legacyId)) || null;
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
        return {cardKey: stableKey, variant: normalized.variant, qty};
      }

      return item;
    });

    if(changed) localStorage.setItem("cart", JSON.stringify(cart));
  }

  async function renderCart(){
    cart = JSON.parse(localStorage.getItem("cart") || "[]");
    updateCartCount();

    const {container, totalEl, whatsappBtn} = ensureLayout();

    if(!cart.length){
      container.innerHTML = `<div class="cart-empty">Tu carrito está vacío.</div>`;
      totalEl.textContent = "$0 CLP";
      whatsappBtn.href = "#";
      whatsappBtn.onclick = (e)=>{ e.preventDefault(); alert("Tu carrito está vacío."); };
      return;
    }

    const {remoteCards, localCards} = await loadCatalogs();
    const inventory = await loadInventory();

    const catalogCards = applyInventory(remoteCards, inventory);
    const localCardsWithInventory = applyInventory(localCards, inventory);

    migrateCart(catalogCards, localCardsWithInventory);

    let total = 0;
    const lines = [];

    container.innerHTML = cart.map(item=>{
      const normalized = normalizeCartItem(item);
      const card = findCard(catalogCards, localCardsWithInventory, item);
      const qty = Number(normalized.qty || 1);

      if(!card){
        return `
          <div class="cart-item missing">
            <div class="cart-info">
              <strong>Carta no encontrada</strong>
              <p>Clave: ${normalized.cardKey || normalized.legacyId || "sin clave"}</p>
            </div>
            <button onclick="removeCartItem('${normalized.cardKey || normalized.legacyId || ""}')">❌ Eliminar</button>
          </div>
        `;
      }

      const cardKey = keyFor(card);
      const isFoil = normalized.variant === "foil";
      const variantLabel = isFoil ? "Foil" : "Normal";
      const unitPrice = Number(isFoil ? (card.foilStorePrice || card.storePrice) : card.storePrice || 0);
      const subtotal = unitPrice * qty;
      total += subtotal;

      lines.push(`• ${card.name} (${variantLabel}) x${qty}\n  ${card.publicCode || card.dotggCode || ""}\n  $${peso(subtotal)} CLP`);

      return `
        <div class="cart-item">
          <img src="${card.image || "assets/logo.png"}" alt="${card.name}" onerror="this.src='assets/logo.png'">
          <div class="cart-info">
            <strong>${card.name} (${variantLabel}) x${qty}</strong>
            <p>${card.set || ""} · ${card.rarity || ""} · ${card.publicCode || card.dotggCode || ""}</p>
            <p>Precio unidad: $${peso(unitPrice)} CLP</p>
            <p>Subtotal: $${peso(subtotal)} CLP</p>
          </div>
          <button onclick="removeCartItem('${cardKey}', '${normalized.variant}')">❌ Eliminar</button>
        </div>
      `;
    }).join("");

    totalEl.textContent = `$${peso(total)} CLP`;

    const message = [
      "Hola LilStore TCG 👋",
      "",
      "Quiero comprar:",
      "",
      ...lines,
      "",
      `Total: $${peso(total)} CLP`
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

  window.removeCartItem = function(key, variant="normal"){
    cart = cart.filter(item => {
      const normalized = normalizeCartItem(item);
      return !((normalized.cardKey === key || String(normalized.legacyId) === String(key)) && normalized.variant === variant);
    });
    saveCart();
    renderCart();
  };

  window.removeItem = window.removeCartItem;

  window.clearCart = function(){
    cart = [];
    saveCart();
    renderCart();
  };

  window.renderCart = renderCart;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", renderCart);
  }else{
    renderCart();
  }
})();
