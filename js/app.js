let cart = JSON.parse(localStorage.getItem('cart') || '[]');

const PAGE_SIZE = 48;
let currentPage = 1;

function updateCartCount(){
  const el = document.getElementById('cartCount');
  if(el) el.textContent = cart.reduce((a,b)=>a+Number(b.qty || 0),0);
}
updateCartCount();

function keyFor(card){
  return card.publicCode || card.dotggCode || `${card.setCode || card.set}-${card.name}`;
}

async function loadCatalog(){
  try{
    const remote = await fetch('/.netlify/functions/catalog');
    if(remote.ok){
      const remoteCards = await remote.json();
      if(Array.isArray(remoteCards) && remoteCards.length){
        return remoteCards;
      }
    }
  }catch(e){}

  const cardsRes = await fetch('data/cards.json');
  return await cardsRes.json();
}

async function loadInventory(){
  try{
    const res = await fetch('/.netlify/functions/stock');
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
      return card;
    }

    if(typeof entry === "number"){
      const stockValue = Number(entry || 0);
      return {...card, stock: stockValue, status: stockValue > 0 ? 'available' : 'soldout'};
    }

    const stockValue = Number(entry.stock ?? card.stock ?? 0);
    return {
      ...card,
      stock: stockValue,
      status: stockValue > 0 ? 'available' : 'soldout',
      marketPrice: Number(entry.marketPrice ?? card.marketPrice ?? 0),
      storePrice: Number(entry.storePrice ?? card.storePrice ?? 0)
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

loadCards().then(cards=>{
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
        card.name.toLowerCase().includes(q) ||
        String(card.publicCode || '').toLowerCase().includes(q) ||
        String(card.dotggCode || '').toLowerCase().includes(q)
      )
    );
  }

  function pageNumbers(current, total){
    const pages = [];

    const add = (value) => {
      if(!pages.includes(value)) pages.push(value);
    };

    add(1);
    add(2);

    for(let i = current - 1; i <= current + 1; i++){
      if(i >= 1 && i <= total) add(i);
    }

    add(total - 1);
    add(total);

    const sorted = pages
      .filter(p => p >= 1 && p <= total)
      .sort((a,b)=>a-b);

    const result = [];
    for(let i = 0; i < sorted.length; i++){
      if(i > 0 && sorted[i] - sorted[i-1] > 1){
        result.push("...");
      }
      result.push(sorted[i]);
    }

    return result;
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
      if(page === "..."){
        return `<span class="page-dots">...</span>`;
      }

      return `<button class="page-number ${page === currentPage ? "active" : ""}" data-page="${page}">${page}</button>`;
    }).join("");

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

    paginationControls.querySelectorAll(".page-number").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const page = Number(btn.dataset.page);
        if(!page || page === currentPage) return;
        currentPage = page;
        render();
        window.scrollTo({top:0, behavior:"smooth"});
      });
    });
  }

  function render(){
    const filtered = filteredCards();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageCards = filtered.slice(startIndex, startIndex + PAGE_SIZE);

    if(!catalog) return;
    catalog.innerHTML='';

    pageCards.forEach(card=>{
      const soldout = Number(card.stock || 0) <= 0;
      const statusLabel = soldout ? '<span class="soldout-badge">AGOTADO</span>' : '<span class="available-badge">DISPONIBLE</span>';
      const button = soldout
        ? `<button class="soldout-btn" disabled>Agotado</button>`
        : `<button onclick="addToCart(${card.id})">Agregar al carrito</button>`;

      catalog.innerHTML += `
      <div class="card ${soldout ? 'soldout-card' : ''}">
        <img src="${card.image || 'assets/logo.png'}" alt="${card.name}" loading="lazy" onerror="this.src='assets/logo.png'">
        <h3>${card.name}</h3>
        <p><strong>Set:</strong> ${card.set}</p>
        <p><strong>Rareza:</strong> ${card.rarity}</p>
        <p><strong>N°:</strong> ${card.publicCode || card.dotggCode || '-'}</p>
        <p><strong>Stock:</strong> ${card.stock || 0}</p>
        ${statusLabel}
        <p>Mercado: $${card.marketPrice || 0} USD</p>
        <p>LilStore: $${peso(card.storePrice)} CLP</p>
        ${button}
      </div>`;
    });

    renderPagination(filtered.length);
  }

  window.addToCart=function(id){
    const card = cards.find(c=>c.id===id);
    if(!card || Number(card.stock||0)<=0){
      alert('Esta carta está agotada.');
      return;
    }

    const cardKey = keyFor(card);
    const existing=cart.find(x=>(x.cardKey || x.publicCode || x.dotggCode || x.id)===cardKey || x.id===id);
    const currentQty = existing ? Number(existing.qty || 0) : 0;

    if(currentQty >= Number(card.stock || 0)){
      alert('No puedes agregar más unidades que el stock disponible.');
      return;
    }

    if(existing){
      existing.cardKey = cardKey;
      delete existing.id;
      existing.qty = currentQty + 1;
    } else {
      cart.push({cardKey:cardKey,qty:1});
    }

    localStorage.setItem('cart',JSON.stringify(cart));
    updateCartCount();
    alert('Carta agregada al carrito');
  }

  function resetAndRender(){
    currentPage = 1;
    render();
  }

  if(search) search.oninput=resetAndRender;
  if(setFilter) setFilter.onchange=resetAndRender;
  if(rarity) rarity.onchange=resetAndRender;
  if(statusFilter) statusFilter.onchange=resetAndRender;
  render();
});
