let cart = JSON.parse(localStorage.getItem('cart') || '[]');

const PAGE_SIZE = 48;
let currentPage = 1;

function updateCartCount(){
  const count = cart.reduce((a,b)=>a + Number(b.qty || 0), 0);
  document.querySelectorAll('#cartCount, #cartLabelCount').forEach(el => el.textContent = count);
  if(window.__miniCartReady && typeof renderMiniCart === 'function') renderMiniCart();
}
updateCartCount();

function keyFor(card){
  return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
}

function formatPesoGlobal(n){
  return Number(n || 0).toLocaleString('es-CL');
}

function supportsFoil(card){
  return ["common", "uncommon"].includes(String(card.rarity || "").toLowerCase());
}

async function loadCatalog(){
  try{
    const remote = await fetch('/.netlify/functions/catalog?v=' + Date.now(), { cache:'no-store' });
    if(remote.ok){
      const remoteCards = await remote.json();
      if(Array.isArray(remoteCards) && remoteCards.length){
        return remoteCards;
      }
    }
  }catch(e){}

  const cardsRes = await fetch('data/cards.json?v=' + Date.now(), { cache:'no-store' });
  return await cardsRes.json();
}

async function loadInventory(){
  try{
    const res = await fetch('/.netlify/functions/stock?v=' + Date.now(), { cache:'no-store' });
    if(!res.ok) return {};
    return await res.json();
  }catch(e){
    return {};
  }
}

async function loadCards(){
  const cards = await loadCatalog();
  const inventory = await loadInventory();

  return cards.map(card=>{
    const key = keyFor(card);
    const entry = inventory[key];

    if(entry === undefined){
      return {
        ...card,
        foilStock: Number(card.foilStock || 0),
        foilMarketPrice: Number(card.foilMarketPrice || 0),
        foilStorePrice: Number(card.foilStorePrice || 0)
      };
    }

    if(typeof entry === "number"){
      const stockValue = Number(entry || 0);
      return {
        ...card,
        stock: stockValue,
        foilStock: 0,
        status: stockValue > 0 ? 'available' : 'soldout'
      };
    }

    const stockValue = Number(entry.stock ?? card.stock ?? 0);
    const foilStock = Number(entry.foilStock ?? card.foilStock ?? 0);

    return {
      ...card,
      stock: stockValue,
      foilStock,
      status: (stockValue > 0 || (supportsFoil(card) && foilStock > 0)) ? 'available' : 'soldout',
      marketPrice: Number(entry.marketPrice ?? card.marketPrice ?? 0),
      storePrice: Number(entry.storePrice ?? card.storePrice ?? 0),
      foilMarketPrice: Number(entry.foilMarketPrice ?? card.foilMarketPrice ?? 0),
      foilStorePrice: Number(entry.foilStorePrice ?? card.foilStorePrice ?? 0)
    };
  });
}

function ensurePaginationControls(){
  const catalog = document.getElementById('catalog');
  if(!catalog) return null;

  let controls = document.getElementById('paginationControls');
  if(!controls){
    controls = document.createElement('div');
    controls.id = 'paginationControls';
    controls.className = 'pagination-controls';
    catalog.insertAdjacentElement('afterend', controls);
  }

  return controls;
}

function pageNumbers(current, total){
  const pages = [];
  const add = (value) => {
    if(value >= 1 && value <= total && !pages.includes(value)) pages.push(value);
  };

  add(1);
  add(2);
  for(let i = current - 1; i <= current + 1; i++) add(i);
  add(total - 1);
  add(total);

  const sorted = pages.sort((a,b)=>a-b);
  const result = [];
  for(let i = 0; i < sorted.length; i++){
    if(i > 0 && sorted[i] - sorted[i-1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}


function miniCartElements(){
  return {
    drawer: document.getElementById('miniCartDrawer'),
    overlay: document.getElementById('miniCartOverlay'),
    closeBtn: document.getElementById('miniCartClose'),
    items: document.getElementById('miniCartItems'),
    summary: document.getElementById('miniCartSummary'),
    total: document.getElementById('miniCartTotal'),
    whatsapp: document.getElementById('miniCartWhatsappBtn'),
    clearBtn: document.getElementById('miniCartClearBtn')
  };
}

function openMiniCart(){
  const {drawer, overlay} = miniCartElements();
  if(!drawer || !overlay) return;
  try { renderMiniCart(); } catch(e) { console.error('Mini cart render error', e); }
  drawer.classList.add('open');
  overlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('mini-cart-open');
}

function closeMiniCart(){
  const {drawer, overlay} = miniCartElements();
  if(!drawer || !overlay) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('mini-cart-open');
}

function miniCartCardForKey(cardKey){
  return (window.__lilstoreCards || []).find(c => keyFor(c) === cardKey);
}

function miniCartItemCard(card, item){
  const variant = item.variant || 'normal';
  const isFoil = variant === 'foil';
  const qty = Number(item.qty || 1);
  const price = Number(isFoil ? (card.foilStorePrice || card.storePrice || 0) : (card.storePrice || 0));
  const subtotal = price * qty;

  return `
    <div class="mini-cart-item ${isFoil ? 'foil' : 'normal'}">
      <img src="${card.image || 'assets/logo.png'}" alt="${card.name}" onerror="this.src='assets/logo.png'">
      <div class="mini-cart-info">
        <strong>${card.name}</strong>
        <span>${card.publicCode || card.dotggCode || ''}</span>
        <em class="${isFoil ? 'foil' : 'normal'}">${isFoil ? 'Foil' : 'Normal'}</em>
        <div class="mini-cart-qty">
          <button type="button" onclick="miniCartChangeQty('${item.cardKey}', '${variant}', -1)">−</button>
          <span>${qty}</span>
          <button type="button" onclick="miniCartChangeQty('${item.cardKey}', '${variant}', 1)">+</button>
        </div>
      </div>
      <div class="mini-cart-price">
        <button type="button" onclick="miniCartRemoveItem('${item.cardKey}', '${variant}')">×</button>
        <strong>$${formatPesoGlobal(subtotal)} CLP</strong>
      </div>
    </div>
  `;
}


function cartOrderItems(){
  const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');

  return currentCart.map(item=>{
    const card = (window.__lilstoreCards || []).find(c => keyFor(c) === (item.cardKey || item.publicCode || item.dotggCode || item.id));
    if(!card) return null;

    const variant = item.variant || 'normal';
    const isFoil = variant === 'foil';
    const qty = Number(item.qty || 1);
    const unitPrice = Number(isFoil ? (card.foilStorePrice || card.storePrice || 0) : (card.storePrice || 0));

    return {
      cardKey: keyFor(card),
      name: card.name,
      code: card.publicCode || card.dotggCode || keyFor(card),
      variant,
      qty,
      unitPrice,
      subtotal: unitPrice * qty
    };
  }).filter(Boolean);
}

async function createLilStoreOrder(){
  const items = cartOrderItems();
  if(!items.length){
    alert('Tu carrito está vacío.');
    return null;
  }

  const res = await fetch('/.netlify/functions/orders', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action:'create', items })
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    alert(data.error || 'No se pudo generar el número de pedido.');
    return null;
  }

  return data.order;
}

function whatsappMessageForOrder(order){
  const lines = (order.items || []).map(item => {
    const variantLabel = item.variant === 'foil' ? 'Foil' : 'Normal';
    return `• ${item.name} (${variantLabel}) x${item.qty}\n  ${item.code || item.cardKey}\n  $${formatPesoGlobal(item.subtotal)} CLP`;
  });

  return [
    'Pedido LilStore TCG',
    `Pedido #${order.id}`,
    '',
    ...lines,
    '',
    `Total: $${formatPesoGlobal(order.total)} CLP`
  ].join('\n');
}

function renderMiniCart(){
  const {items, summary, total, whatsapp} = miniCartElements();
  if(!items) return;

  cart = JSON.parse(localStorage.getItem('cart') || '[]');

  const totalQty = cart.reduce((sum, item)=>sum + Number(item.qty || 0), 0);
  let totalValue = 0;
  const whatsappLines = [];

  if(summary){
    summary.textContent = `${totalQty} ${totalQty === 1 ? 'producto' : 'productos'} en tu carrito`;
  }

  if(!cart.length){
    items.innerHTML = '<p class="mini-cart-empty">Tu carrito está vacío.</p>';
    if(total) total.textContent = '$0 CLP';
    if(whatsapp) {
      whatsapp.href = '#';
      whatsapp.onclick = (event)=>{ event.preventDefault(); alert('Tu carrito está vacío.'); };
    }
    return;
  }

  const html = cart.map(item=>{
    const card = miniCartCardForKey(item.cardKey || item.publicCode || item.dotggCode || item.id);
    if(!card) return '';
    const variant = item.variant || 'normal';
    const qty = Number(item.qty || 1);
    const isFoil = variant === 'foil';
    const price = Number(isFoil ? (card.foilStorePrice || card.storePrice || 0) : (card.storePrice || 0));
    const subtotal = price * qty;

    totalValue += subtotal;
    whatsappLines.push(`• ${card.name} (${isFoil ? 'Foil' : 'Normal'}) x${qty}\n  ${card.publicCode || card.dotggCode || ''}\n  $${formatPesoGlobal(subtotal)} CLP`);

    return miniCartItemCard(card, {
      ...item,
      cardKey: keyFor(card),
      variant
    });
  }).join('');

  items.innerHTML = html || '<p class="mini-cart-empty">Tu carrito está vacío.</p>';
  if(total) total.textContent = `$${formatPesoGlobal(totalValue)} CLP`;

  if(whatsapp){
    whatsapp.href = '#';
    whatsapp.onclick = async (event)=>{
      event.preventDefault();
      whatsapp.textContent = 'Generando pedido...';
      const order = await createLilStoreOrder();
      whatsapp.textContent = 'Finalizar por WhatsApp';
      if(!order) return;

      const message = whatsappMessageForOrder(order);
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    };
  }
}


function bindCartOpenersV82(){
  const selectors = [
    'a[href="cart.html"]',
    'a[href="/cart.html"]',
    'a[href="./cart.html"]',
    '.cart-button',
    '.cart-link',
    '#cartButton',
    '#cartLink',
    '[data-open-cart]'
  ];

  document.querySelectorAll(selectors.join(',')).forEach(el=>{
    if(el.dataset.miniCartBound === '1') return;
    el.dataset.miniCartBound = '1';
    el.addEventListener('click', (event)=>{
      event.preventDefault();
      openMiniCart();
    });
  });
}

function bindMiniCartButtons(){
  const {overlay, closeBtn, clearBtn} = miniCartElements();
  overlay?.addEventListener('click', closeMiniCart);
  closeBtn?.addEventListener('click', closeMiniCart);

  clearBtn?.addEventListener('click', ()=>{
    if(!cart.length) return;
    if(!confirm('¿Vaciar carrito?')) return;
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderMiniCart();
  });

  document.addEventListener('keydown', (event)=>{
    if(event.key === 'Escape') closeMiniCart();
  });

  bindCartOpenersV82();

  document.querySelectorAll('a[href="cart.html"], a[href="/cart.html"], .cart-button, #cartButton, #cartLink').forEach(el=>{
    el.addEventListener('click', (event)=>{
      event.preventDefault();
      openMiniCart();
    });
  });
}

window.miniCartRemoveItem = function(cardKey, variant='normal'){
  cart = cart.filter(item => !(item.cardKey === cardKey && (item.variant || 'normal') === variant));
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderMiniCart();
}

window.miniCartChangeQty = function(cardKey, variant='normal', delta=0){
  const card = miniCartCardForKey(cardKey);
  const item = cart.find(x => x.cardKey === cardKey && (x.variant || 'normal') === variant);
  if(!card || !item) return;

  const maxStock = Number(variant === 'foil' ? card.foilStock : card.stock || 0);
  const nextQty = Math.max(1, Math.min(maxStock, Number(item.qty || 1) + Number(delta || 0)));
  item.qty = nextQty;

  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderMiniCart();
}


loadCards().then(cards=>{
  window.__lilstoreCards = cards;
  window.__miniCartReady = true;
  const catalog=document.getElementById('catalog');
  const search=document.getElementById('search');
  const setFilter=document.getElementById('setFilter');
  const rarity=document.getElementById('rarityFilter');
  const statusFilter=document.getElementById('statusFilter');
  const paginationControls = ensurePaginationControls();

  if(setFilter){
    const current = setFilter.value;
    setFilter.innerHTML = '<option value="">Todos los Sets</option>';
    [...new Set(cards.map(c=>c.set).filter(Boolean))]
      .sort((a,b)=>{
        const order = {"Origins":0,"Spiritforged":1,"Unleashed":2,"Proving Grounds":3,"ARC":4};
        return (order[a] ?? 99) - (order[b] ?? 99) || a.localeCompare(b);
      })
      .forEach(s=>setFilter.innerHTML += `<option value="${s}">${s}</option>`);
    setFilter.value = current;
  }

  function peso(n){ return Number(n||0).toLocaleString('es-CL'); }

  function filteredCards(){
    const q = search ? search.value.toLowerCase() : '';
    return cards.filter(card =>
      (!setFilter || !setFilter.value || card.set===setFilter.value) &&
      (!rarity || !rarity.value || card.rarity===rarity.value) &&
      (!statusFilter || !statusFilter.value || card.status===statusFilter.value) &&
      (
        String(card.name || '').toLowerCase().includes(q) ||
        String(card.publicCode || '').toLowerCase().includes(q) ||
        String(card.dotggCode || '').toLowerCase().includes(q)
      )
    );
  }

  function renderPagination(totalItems){
    if(!paginationControls) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    if(totalPages <= 1){
      paginationControls.innerHTML = '';
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, totalItems);

    const numberButtons = pageNumbers(currentPage, totalPages).map(page => {
      if(page === '...') return `<span class="page-dots">...</span>`;
      return `<button class="page-number ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
    }).join('');

    paginationControls.innerHTML = `
      <div class="pagination-main">
        <button id="prevPageBtn" class="page-nav" ${currentPage === 1 ? 'disabled' : ''}>← Anterior</button>
        <div class="pagination-numbers">${numberButtons}</div>
        <button id="nextPageBtn" class="page-nav" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>
      <div class="pagination-info">Página ${currentPage} de ${totalPages} · Mostrando ${start}-${end} de ${totalItems}</div>
    `;

    document.getElementById('prevPageBtn')?.addEventListener('click', ()=>{
      if(currentPage <= 1) return;
      currentPage--;
      render();
      window.scrollTo({top:0, behavior:'smooth'});
    });

    document.getElementById('nextPageBtn')?.addEventListener('click', ()=>{
      if(currentPage >= totalPages) return;
      currentPage++;
      render();
      window.scrollTo({top:0, behavior:'smooth'});
    });

    paginationControls.querySelectorAll('.page-number').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const page = Number(btn.dataset.page);
        if(!page || page === currentPage) return;
        currentPage = page;
        render();
        window.scrollTo({top:0, behavior:'smooth'});
      });
    });
  }

  function normalButton(card){
    const stock = Number(card.stock || 0);
    if(stock <= 0) return `<button class="soldout-btn" disabled>Normal agotado</button>`;
    return `<button onclick="addToCart(${card.id}, 'normal')">Agregar Normal · $${peso(card.storePrice)}</button>`;
  }

  function foilButton(card){
    const stock = Number(card.foilStock || 0);
    const price = Number(card.foilStorePrice || card.storePrice || 0);
    if(stock <= 0) return `<button class="soldout-btn" disabled>Foil agotado</button>`;
    return `<button onclick="addToCart(${card.id}, 'foil')">Agregar Foil · $${peso(price)}</button>`;
  }

  function render(){
    const filtered = filteredCards();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageCards = filtered.slice(startIndex, startIndex + PAGE_SIZE);

    if(!catalog) return;
    catalog.innerHTML='';

    if(!pageCards.length){
      catalog.innerHTML = `<p class="empty-results">No hay cartas para mostrar.</p>`;
      renderPagination(filtered.length);
      return;
    }

    pageCards.forEach(card=>{
      const normalStock = Number(card.stock || 0);
      const hasFoil = supportsFoil(card);
      const foilStock = hasFoil ? Number(card.foilStock || 0) : 0;
      const soldout = normalStock <= 0 && (!hasFoil || foilStock <= 0);
      const statusLabel = soldout ? '<span class="soldout-badge">AGOTADO</span>' : '<span class="available-badge">DISPONIBLE</span>';

      catalog.innerHTML += `
      <div class="card ${soldout ? 'soldout-card' : ''}">
        <img src="${card.image || 'assets/logo.png'}" alt="${card.name}" loading="lazy" onerror="this.src='assets/logo.png'">
        <h3>${card.name}</h3>
        <p><strong>Set:</strong> ${card.set}</p>
        <p><strong>Rareza:</strong> ${card.rarity}</p>
        <p><strong>N°:</strong> ${card.publicCode || card.dotggCode || '-'}</p>
        ${hasFoil ? `
          <p><strong>Stock Normal:</strong> ${normalStock}</p>
          <p><strong>Stock Foil:</strong> ${foilStock}</p>
        ` : `
          <p><strong>Stock:</strong> ${normalStock}</p>
        `}
        ${statusLabel}
        <p>Mercado: $${card.marketPrice || 0} USD</p>
        <p>LilStore: $${peso(card.storePrice)} CLP</p>
        ${hasFoil ? `
          <p>Mercado Foil: $${card.foilMarketPrice || 0} USD</p>
          <p>LilStore Foil: $${peso(card.foilStorePrice || card.storePrice)} CLP</p>
        ` : ``}
        <div class="variant-buttons">
          ${normalButton(card)}
          ${hasFoil ? foilButton(card) : ''}
        </div>
      </div>`;
    });

    renderPagination(filtered.length);
  }

  window.addToCart=function(id, variant='normal'){
    const card = cards.find(c=>Number(c.id)===Number(id));
    if(variant === 'foil' && !supportsFoil(card)){
      alert('Esta carta no tiene versión foil.');
      return;
    }

    const stock = Number(variant === 'foil' ? card?.foilStock : card?.stock || 0);

    if(!card || stock<=0){
      alert(`Esta versión ${variant === 'foil' ? 'foil' : 'normal'} está agotada.`);
      return;
    }

    const cardKey = keyFor(card);
    const existing=cart.find(x=>(x.cardKey || x.publicCode || x.dotggCode || x.id)===cardKey && (x.variant || 'normal')===variant);
    const currentQty = existing ? Number(existing.qty || 0) : 0;

    if(currentQty >= stock){
      alert('No puedes agregar más unidades que el stock disponible.');
      return;
    }

    if(existing){
      existing.cardKey = cardKey;
      delete existing.id;
      existing.variant = variant;
      existing.qty = currentQty + 1;
    } else {
      cart.push({cardKey:cardKey, variant, qty:1});
    }

    localStorage.setItem('cart',JSON.stringify(cart));
    updateCartCount();
    try { renderMiniCart(); openMiniCart(); } catch(e) { console.error('Mini cart open error', e); }
  }

  function resetAndRender(){
    currentPage = 1;
    render();
  }

  if(search) search.oninput=resetAndRender;
  if(setFilter) setFilter.onchange=resetAndRender;
  if(rarity) rarity.onchange=resetAndRender;
  if(statusFilter) statusFilter.onchange=resetAndRender;
  bindMiniCartButtons();
  render();
  try { renderMiniCart(); } catch(e) { console.error('Mini cart initial render error', e); }
}).catch(err=>{
  const catalog=document.getElementById('catalog');
  if(catalog){
    catalog.innerHTML = `<p class="empty-results">Error cargando catálogo. Recarga la página.</p>`;
  }
  console.error(err);
});
