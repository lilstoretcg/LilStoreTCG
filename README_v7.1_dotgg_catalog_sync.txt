LilStore TCG v7.1 - DotGG Catalog Sync

Agrega:
- Function /.netlify/functions/sync-dotgg-catalog
- Function /.netlify/functions/catalog
- Botón Admin: Actualizar catálogo DotGG
- La tienda y el admin cargan primero el catálogo remoto desde Netlify Blobs.
- Mantiene stock y precios en lilstore-inventory.

Uso:
1. Sube a GitHub:
   git add .
   git commit -m "Add DotGG catalog sync"
   git push

2. Espera deploy de Netlify.
3. Entra a /admin.html.
4. Ingresa PIN.
5. Clic en "Actualizar catálogo DotGG".
6. Después clic en "Actualizar precios DotGG".

Nota:
- El catálogo queda guardado en Netlify Blobs.
- data/cards.json queda como respaldo local.
