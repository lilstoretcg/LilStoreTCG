LilStore TCG v8.5.2 - Fix botón Diagnóstico DotGG

Corrige:
- El botón Diagnóstico DotGG no hacía nada.
- Agrega un script directo en admin.html para ejecutar el diagnóstico.
- Mantiene endpoint:
  /.netlify/functions/sync-riftboundgg-prices?debug=1

Actualizar:
git add .
git commit -m "v8.5.2 - Fix DotGG diagnostic button"
git push

Probar:
/admin.html?v=852

Presionar:
Diagnóstico DotGG

Si aún no responde, abrir directamente:
https://TU-SITIO.netlify.app/.netlify/functions/sync-riftboundgg-prices?debug=1
