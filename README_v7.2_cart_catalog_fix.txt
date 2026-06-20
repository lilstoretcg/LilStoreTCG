LilStore TCG v7.2 - Fix carrito con catálogo DotGG

Corrige:
- El carrito ahora carga catálogo remoto desde Netlify Blobs.
- El carrito aplica precios y stock desde Netlify Blobs.
- Total CLP ya no queda en $0.
- Los productos se guardan por publicCode/dotggCode estable, no por id.
- Compatible con carritos antiguos guardados por id.

Actualizar:
git add .
git commit -m "Fix cart with DotGG catalog"
git push

Después:
- Vacía el carrito viejo si queda algún item antiguo sin precio.
- Agrega una carta nueva desde la tienda.
- Verifica total y WhatsApp.
