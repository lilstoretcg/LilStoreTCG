LilStore TCG v9.0 - Nuevo sincronizador DotGG

Objetivo:
Resolver la sincronización de precios reemplazando la función anterior por una versión nueva y limpia.

Base:
- v8.3 orders_only_stable.
- Mantiene carrito lateral.
- Mantiene pedidos #00001.
- Mantiene descuento de stock desde Admin.
- No incluye precio mínimo/precio base.

Nuevo sync:
- Lee payload.lines.
- Extrae closePrice/openPrice/highPrice/lowPrice.
- Acepta precios string.
- Usa baja concurrencia para evitar bloqueos.
- Devuelve debugFailed con muestra de fallos.
- Diagnóstico:
  /.netlify/functions/sync-riftboundgg-prices?debug=1&cardid=OGN-001

Actualizar:
git add .
git commit -m "v9.0 - Rebuild DotGG price sync"
git push

Probar:
Admin:
/admin.html?v=90

Pasos:
1. Diagnóstico DotGG.
2. Actualizar precios DotGG.
3. Si hay fallos, abrir Network > sync-riftboundgg-prices > Response y revisar debugFailed.
