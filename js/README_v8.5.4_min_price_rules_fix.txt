LilStore TCG v8.5.4 - Fix minPriceRules

Corrige:
- Error interno al sincronizar precios DotGG:
  minPriceRules is not defined

Causa:
- La función sync-riftboundgg-prices.js intentaba aplicar precios mínimos/base,
  pero la variable minPriceRules no estaba declarada dentro del handler.

Actualizar:
git add .
git commit -m "v8.5.4 - Fix minPriceRules in DotGG sync"
git push

Probar:
/admin.html?v=854

Luego:
1. Diagnóstico DotGG
2. Actualizar precios DotGG
