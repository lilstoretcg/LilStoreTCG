let cart = JSON.parse(localStorage.getItem('cart') || '[]');

function updateCartCount(){
  const el = document.getElementById('cartCount');
  if(el) el.textContent = cart.reduce((a,b)=>a+b.qty,0);
}
updateCartCount();

function keyFor(card){
  return card.publicCode || `${card.setCode || card.set}-${card.name}`;
}

async function loadStock(){
  try{
    const res = await fetch('/.netlify/functions/stock');
    if(!res.ok) return {};
    return await res.json();
  }catch(e){
    return {};
  }
}

async function loadCards(){
  const cardsRes = await fetch('data/cards.json');
  const cards = await cardsRes.json();
  const stock = await loadStock();

  return cards.map(card=>{
    const key = keyFor(card);
    const remote = stock[key];

    if(remote === undefined){
      return card;
    }

    const stockValue = Number(remote || 0);

    return {
      ...card,
      stock: stockValue,
      status: stockValue > 0 ? 'available' : 'soldout'
    };
  });
}

loadCards().then(cards=>{
  const catalog=document.getElementById('catalog');
  const search=document.getElementById('search');
  const setFilter=document.getElementById('setFilter');
  const rarity=document.getElementById('rarityFilter');
  const statusFilter=document.getElementById('statusFilter');

  if(setFilter && setFilter.options.length <= 1){
    ["Origins","Spiritforged","Unleashed"].forEach(s=>setFilter.innerHTML += `<option value="${s}">${s}</option>`);
  }

  function peso(n){ return Number(n||0).toLocaleString('es-CL'); }

  function render(){
    const q = search ? search.value.toLowerCase() : '';
    const filtered = cards.filter(card =>
      (!setFilter || !setFilter.value || card.set===setFilter.value) &&
      (!rarity || !rarity.value || card.rarity===rarity.value) &&
      (!statusFilter || !statusFilter.value || card.status===statusFilter.value) &&
      card.name.toLowerCase().includes(q)
    );

    if(!catalog) return;
    catalog.innerHTML='';

    filtered.forEach(card=>{
      const soldout = Number(card.stock || 0) <= 0;
      const statusLabel = soldout ? '<span class="soldout-badge">AGOTADO</span>' : '<span class="available-badge">DISPONIBLE</span>';
      const button = soldout
        ? `<button class="soldout-btn" disabled>Agotado</button>`
        : `<button onclick="addToCart(${card.id})">Agregar al carrito</button>`;

      catalog.innerHTML += `
      <div class="card ${soldout ? 'soldout-card' : ''}">
        <img src="${card.image || 'assets/logo.png'}" alt="${card.name}" onerror="this.src='assets/logo.png'">
        <h3>${card.name}</h3>
        <p><strong>Set:</strong> ${card.set}</p>
        <p><strong>Rareza:</strong> ${card.rarity}</p>
        <p><strong>N°:</strong> ${card.publicCode || '-'}</p>
        <p><strong>Stock:</strong> ${card.stock || 0}</p>
        ${statusLabel}
        <p>Mercado: $${card.marketPrice || 0} USD</p>
        <p>LilStore: $${peso(card.storePrice)} CLP</p>
        ${button}
      </div>`;
    });
  }

  window.addToCart=function(id){
    const card = cards.find(c=>c.id===id);
    if(!card || Number(card.stock||0)<=0){
      alert('Esta carta está agotada.');
      return;
    }

    const existing=cart.find(x=>x.id===id);
    const currentQty = existing ? existing.qty : 0;

    if(currentQty >= Number(card.stock || 0)){
      alert('No puedes agregar más unidades que el stock disponible.');
      return;
    }

    if(existing) existing.qty++;
    else cart.push({id:id,qty:1});

    localStorage.setItem('cart',JSON.stringify(cart));
    updateCartCount();
    alert('Carta agregada al carrito');
  }

  if(search) search.oninput=render;
  if(setFilter) setFilter.onchange=render;
  if(rarity) rarity.onchange=render;
  if(statusFilter) statusFilter.onchange=render;
  render();
});
