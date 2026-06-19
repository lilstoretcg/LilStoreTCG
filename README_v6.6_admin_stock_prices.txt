LilStore TCG v6.6 - Panel Admin con stock y precios

Cambios:
- El panel admin ahora permite editar:
  - Stock
  - Mercado USD
  - Precio LilStore CLP
- La tienda principal lee stock y precios desde Netlify Blobs.
- Compatible con el stock guardado anteriormente.

Para actualizar GitHub:
1. Copia estos archivos a tu carpeta local del proyecto.
2. Ejecuta:
   git add .
   git commit -m "Add editable prices to admin panel"
   git push

Luego Netlify desplegará automáticamente.
