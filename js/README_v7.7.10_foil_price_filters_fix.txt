LilStore TCG v7.7.10 - Precios Foil + filtros restaurados

Base: v7.7.9 con fix de precios Foil DotGG.

Corrige:
- Mantiene el fix de precios Foil.
- Restaura diseño de filtros con labels:
  Buscar carta, Set, Rareza, Stock.
- Usa el ID correcto statusFilter.
- Mantiene soporte Normal/Foil, carrito y paginación.

Actualizar:
git add .
git commit -m "Restore filter layout after foil price fix"
git push

Probar:
/?v=7710
/admin.html
/cart.html
