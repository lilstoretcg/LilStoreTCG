LilStore TCG v10.3 - Restaurar respaldo + Precio Base

Incluye:
- Respaldo convertido desde LilStoreTCG_Backup(2).xlsx.
- Botón en Admin: Restaurar stock desde respaldo.
- Precio base por rareza reimplementado.
- Precio base se aplica durante la sincronización DotGG por lotes.
- Catálogo limitado a Origins, Spiritforged y Unleashed.

Respaldo incluido:
- Registros restaurables: 901
- Unidades en respaldo: 1820

Orden recomendado en cuenta nueva Netlify:
1. Subir esta versión.
2. Entrar a /admin.html?v=103
3. Ingresar PIN.
4. Actualizar catálogo DotGG.
5. Restaurar stock desde respaldo.
6. Guardar precios base si quieres ajustar valores.
7. Actualizar precios DotGG.

Actualizar:
git add .
git commit -m "v10.3 - Restore backup and add base prices"
git push
