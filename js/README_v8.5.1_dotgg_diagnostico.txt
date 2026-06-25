LilStore TCG v8.5.1 - Diagnóstico DotGG

Objetivo:
- No cambia el flujo de la tienda.
- No cambia precios base.
- No cambia carrito ni pedidos.
- Solo mejora el diagnóstico de la función DotGG.

Agrega:
- Botón "Diagnóstico DotGG" en Admin.
- Endpoint GET:
  /.netlify/functions/sync-riftboundgg-prices?debug=1

Uso:
1. Subir cambios.
2. Abrir /admin.html?v=851
3. Presionar "Diagnóstico DotGG".
4. Si "Actualizar precios DotGG" falla, ahora debería mostrar el error real.
5. También puedes abrir la consola del navegador para ver el objeto completo.

Actualizar:
git add .
git commit -m "v8.5.1 - Add DotGG diagnostics"
git push
