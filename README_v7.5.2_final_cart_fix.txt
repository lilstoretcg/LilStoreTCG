LilStore TCG v7.5.2 - Fix definitivo carrito

Corrige:
- El carrito vuelve a mostrar productos.
- Cache bust en cart.html: js/cart.js?v=752.
- Render robusto aunque el DOM cargue antes/después.
- Compatible con items por cardKey y antiguos por id.
- Logo del carrito más visible.
- WhatsApp profesional funcionando.

Actualizar:
git add .
git commit -m "Final cart display fix"
git push

Probar:
- /cart.html?v=752
- Si usas /cart, recarga con Ctrl+F5.
