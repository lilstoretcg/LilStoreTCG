LilStore TCG v10.2 - Catálogo limitado a 3 sets

Cambio principal:
- El catálogo DotGG ahora solo carga:
  - Origins
  - Spiritforged
  - Unleashed

Se excluyen:
- Proving Grounds
- ARC
- Otros sets/promos que son imposibles o muy difíciles de conseguir.

Archivos modificados:
- netlify/functions/sync-dotgg-catalog.js
- netlify/functions/catalog.js
- data/cards.json si existía como respaldo local
- admin.html cache/version

Importante:
Después de subir esta versión, entra a Admin y presiona:
Actualizar catálogo DotGG

Luego:
Actualizar precios DotGG

Actualizar:
git add .
git commit -m "v10.2 - Limit catalog to main three sets"
git push

Probar:
/admin.html?v=102
/?v=102

Resultado esperado aproximado:
- Catálogo cercano a 908 cartas:
  Origins 360
  Spiritforged 278
  Unleashed 270
