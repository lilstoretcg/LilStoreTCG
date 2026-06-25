LilStore TCG v10.0 - Sincronización DotGG por lotes

Corrige el timeout de Netlify:
- Error anterior:
  Sandbox.Timedout / Task timed out after 30 seconds

Solución:
- Ya no sincroniza las 938 cartas en una sola Function.
- El Admin divide el proceso en lotes de 25 cartas.
- Cada lote llama a Netlify por separado.
- La función termina antes del límite de 30 segundos.
- Al terminar todos los lotes, recarga inventario.

Incluye:
- Foil fallback: si Normal no tiene precio pero Foil sí, usa Foil como precio principal.
- Manejo básico de 429.
- Pausa entre cartas y entre lotes.

Actualizar:
git add .
git commit -m "v10.0 - Add DotGG batch price sync"
git push

Probar:
/admin.html?v=100

Pasos:
1. Diagnóstico DotGG.
2. Actualizar precios DotGG.
3. Esperar a que avance por lotes.
4. Al finalizar, revisar conteo final.
