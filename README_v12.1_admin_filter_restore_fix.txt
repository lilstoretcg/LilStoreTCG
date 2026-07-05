LilStore TCG v12.1 - Admin filtros, desplegables y restauración

Cambios:
- Corrige el menú desplegable del Admin.
- Cambia el filtro de stock por filtro de Set:
  - Todos los Sets
  - Origins
  - Spiritforged
  - Unleashed
- Restaurar stock ahora permite subir archivo:
  - Excel .xlsx
  - JSON .json
  - ZIP .zip con Excel o JSON dentro
- Ya no depende de un respaldo fijo incluido en el código.

Actualizar:
git add .
git commit -m "v12.1 - Fix admin collapsibles set filter and backup upload"
git push

Probar:
/admin.html?v=121
