LilStore TCG v8.6.2 - Fix sincronización DotGG

Corrige:
- Error interno al presionar "Actualizar precios DotGG".
- La función sync-riftboundgg-prices.js usaba basePriceRules sin declararlo.
- Mantiene aplicación de Precio Base durante la sincronización.

Actualizar:
git add .
git commit -m "v8.6.2 - Fix DotGG price sync with base prices"
git push

Probar:
/admin.html?v=862

Luego presiona:
Actualizar precios DotGG
