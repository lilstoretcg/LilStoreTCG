
Promise.all([fetch('data/cards.json').then(r=>r.json())]).then(([cards])=>{
let cart=JSON.parse(localStorage.getItem('cart')||'[]');
const container=document.getElementById('items');
function render(){
container.innerHTML='';
if(cart.length===0){container.innerHTML='<p>Tu carrito está vacío.</p>';return;}
let total=0; let message='Hola LilStore TCG.%0A%0AQuiero comprar:%0A';
cart.forEach(item=>{
 const card=cards.find(c=>c.id===item.id); if(!card)return;
 total+=(card.storePrice||0)*item.qty;
 message+=`• ${card.name} x${item.qty}%0A`;
 container.innerHTML+=`<div><p>${card.name} x${item.qty}</p><button onclick="removeItem(${item.id})">❌ Eliminar</button></div>`;
});
container.innerHTML+=`<hr><p>Total: $${total} CLP</p><button id="clearCart">🗑️ Vaciar carrito</button>`;
document.getElementById('clearCart').onclick=()=>{if(confirm('¿Vaciar todo el carrito?')){cart=[];localStorage.removeItem('cart');render();}};
document.getElementById('wa').onclick=()=>window.open('https://wa.me/56933823890?text='+message,'_blank');
}
window.removeItem=(id)=>{cart=cart.filter(x=>x.id!==id);localStorage.setItem('cart',JSON.stringify(cart));render();};
render();
});
