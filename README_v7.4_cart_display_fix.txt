LilStore TCG v7.4 - Fix carrito no muestra cartas

Corrige:
- El carrito ahora siempre tiene contenedor #cartItems.
- Compatible con carritos antiguos por id y nuevos por cardKey.
- Si no encuentra el catálogo remoto, usa data/cards.json.
- WhatsApp queda con href, target y onclick.
- Total y productos visibles nuevamente.

Actualizar:
git add .
git commit -m "Fix cart item display"
git push

Después del deploy:
1. Abre /cart.html?v=74
2. Si quedaron productos viejos raros, pulsa Vaciar carrito.
3. Agrega una carta nueva desde la tienda.
4. Revisa que aparezca y que WhatsApp abra.
