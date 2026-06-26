LilStore TCG v11.0 - Admin desplegable

Objetivo:
- Mantener los grupos del panel Admin tal como están actualmente.
- Convertir cada grupo/panel en desplegable.
- Evitar que funciones que no se usan a diario ocupen tanto espacio.
- Corregir alineación del bloque Sincronización de precios.

Incluye:
- Secciones desplegables.
- Se mantienen abiertas por defecto:
  - PIN / acceso
  - Buscar / inventario
  - Sincronización de precios
  - Precio base, si existe en la versión base
- Las demás quedan cerradas por defecto.
- Botón Diagnóstico DotGG y Actualizar precios DotGG quedan mejor alineados.
- Mantiene la funcionalidad existente:
  - Precio base
  - Restaurar respaldo si estaba en la base
  - Sincronización por lotes
  - Pedidos
  - Catálogo 3 sets

Actualizar:
git add .
git commit -m "v11.0 - Make admin panels collapsible"
git push

Probar:
/admin.html?v=110
