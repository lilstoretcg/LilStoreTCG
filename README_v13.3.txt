LilStore TCG v13.3 - Cartas sin precio

Cambios:
- Conserva el precio anterior cuando DotGG no entrega precio.
- Nunca reemplaza un precio existente por 0.
- Añade filtro Admin:
  - Todas
  - Con precio
  - Sin precio
- Las cartas sin precio ya no se cuentan como fallos técnicos.
- El resumen separa:
  - Sin precio
  - Errores técnicos

Importante:
El filtro Sin precio usa el valor de mercado USD, no el precio base.
Por eso permite localizar runas u otras cartas que DotGG aún no valoriza,
aunque tengan un precio base para la venta.

Actualizar:
git add .
git commit -m "v13.3 - Preserve prices and separate no-price cards"
git push

Probar:
/admin.html?v=133
