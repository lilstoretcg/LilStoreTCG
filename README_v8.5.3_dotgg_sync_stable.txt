LilStore TCG v8.5.3 - DotGG sync estable

Objetivo:
- Mantener la base v8.5.
- Corregir sincronización DotGG sin tocar carrito, pedidos ni stock.

Cambios:
- Prioriza payload.lines, que es donde DotGG está devolviendo los precios.
- priceFromCandidates usa toNumber().
- Baja concurrencia de 8 a 3 para evitar respuestas vacías/rate limit.
- Agrega retry automático hasta 3 intentos si DotGG responde vacío.
- Diagnóstico acepta:
  /.netlify/functions/sync-riftboundgg-prices?debug=1&cardid=OGN-001

Actualizar:
git add .
git commit -m "v8.5.3 - Stabilize DotGG price sync"
git push

Probar:
1. /admin.html?v=853
2. Diagnóstico DotGG
3. Actualizar precios DotGG

Resultado esperado:
- Precios actualizados cercano a 931
- Sin precio cercano a 7
