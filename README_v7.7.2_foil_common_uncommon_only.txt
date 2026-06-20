LilStore TCG v7.7.2 - Foil solo Common/Uncommon

Corrige:
- Stock Foil y precios Foil solo aparecen en tienda para Common y Uncommon.
- Rare/Epic/Showcase muestran stock/precio normal únicamente.
- En Admin, campos Foil quedan deshabilitados para Rare/Epic/Showcase.
- Sincronización DotGG solo guarda foil para Common/Uncommon.

Actualizar:
git add .
git commit -m "Limit foil stock to common uncommon"
git push

Probar:
/?v=772
/admin.html?v=772
/cart.html?v=772
