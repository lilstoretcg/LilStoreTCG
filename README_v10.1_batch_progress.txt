LilStore TCG v10.1 - Progreso real DotGG por lotes

Corrige:
- Mensaje "Códigos consultados: undefined".
- El Admin ahora continúa automáticamente lote por lote hasta completar todo el catálogo.
- Agrega barra de progreso.
- Agrega contador acumulado.
- Agrega botón para cancelar sincronización.

Cómo funciona:
- Lotes de 25 cartas.
- Cada lote usa una ejecución distinta de Netlify Function.
- Evita el timeout de 30 segundos.
- Al finalizar, recarga inventario.

Actualizar:
git add .
git commit -m "v10.1 - Add DotGG batch progress"
git push

Probar:
/admin.html?v=101

Pasos:
1. Diagnóstico DotGG.
2. Actualizar precios DotGG.
3. Esperar avance de la barra.
4. Al finalizar revisar el mensaje final.
