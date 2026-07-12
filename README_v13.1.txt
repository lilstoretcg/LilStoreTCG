LilStore TCG v13.1 - Integridad del catálogo

Mantiene intacto:
- Actualizar precios con stock.
- Actualizar todos los precios.
- Precio base.
- Pedidos.
- Respaldos.
- Estadísticas.
- Sincronización por lotes.

Añade:
- Panel Integridad del catálogo.
- Conteo por set.
- Revisión de nombres presentes en varios sets.
- Verificación de códigos duplicados reales.
- Verificación de registros incompletos.
- Ejemplos visibles de cartas con el mismo nombre en distintos sets.

Objetivo:
Confirmar que runas y otras cartas con nombres similares o repetidos aparecen correctamente en Origins, Spiritforged y Unleashed.

Actualizar:
git add .
git commit -m "v13.1 - Add catalog integrity audit"
git push

Probar:
/admin.html?v=131

Orden recomendado:
1. Actualizar catálogo DotGG.
2. Abrir Integridad del catálogo.
3. Presionar Revisar catálogo actual.
4. Confirmar que Códigos duplicados reales sea 0.
