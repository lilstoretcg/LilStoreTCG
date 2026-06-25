LilStore TCG v8.5.5 - Solución DotGG lines

Corrige la sincronización de precios DotGG:

- Prioriza payload.lines, donde DotGG está devolviendo los precios.
- Lee closePrice/openPrice/highPrice/lowPrice correctamente.
- Usa toNumber() para valores como texto.
- Baja concurrencia a 3 para evitar respuestas inestables.
- Mantiene minPriceRules declarado.
- Agrega debugFailed en la respuesta para diagnosticar casos restantes.

Actualizar:
git add .
git commit -m "v8.5.5 - Fix DotGG lines price sync"
git push

Probar:
/admin.html?v=855

Luego:
1. Diagnóstico DotGG
2. Actualizar precios DotGG

Resultado esperado:
Precios actualizados cercano a 931.
