LilStore TCG v13.2 - Corrección de códigos de runas

Problema corregido:
- El catálogo solo reconocía códigos con tres dígitos, por ejemplo OGN-007.
- Las runas de Spiritforged y Unleashed usan códigos alfanuméricos, por ejemplo SFD-R01 y UNL-R01.
- Esas cartas se descartaban durante la importación.

Cambios:
- Catálogo acepta códigos como R01, R01A, R01B y 007A.
- Sincronización de precios acepta los mismos códigos.
- Auditoría y restauración de respaldos reconocen estos códigos.
- No se deduplica por nombre.

Actualizar:
git add .
git commit -m "v13.2 - Fix alphanumeric rune card codes"
git push

Después del deploy:
1. Abrir /admin.html?v=132
2. Presionar Actualizar catálogo DotGG
3. Buscar Fury Rune
4. Deben aparecer OGN, SFD y UNL.
5. Luego actualizar precios.
