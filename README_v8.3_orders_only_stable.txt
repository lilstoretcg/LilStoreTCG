LilStore TCG v8.3 - Pedidos solamente, base estable

Base:
- v8.2, donde DotGG funcionaba correctamente.

Incluye:
- Sistema de pedidos #00001, #00002...
- WhatsApp con número de pedido.
- Admin para buscar pedido.
- Admin para descontar stock al confirmar pedido.
- Protección para no descontar dos veces el mismo pedido.

No incluye:
- Precios mínimos.
- Precio base.
- Columnas nuevas de precio.
- Cambios en la sincronización DotGG.

Objetivo:
Volver a una versión estable y conservar solo la mejora de pedidos.

Actualizar:
git add .
git commit -m "v8.3 - Add orders only on stable base"
git push

Probar:
Tienda:
/?v=83o

Admin:
/admin.html?v=83o

Pruebas:
1. Agregar cartas al carrito.
2. Finalizar por WhatsApp.
3. Verificar Pedido #00001.
4. Buscar pedido en Admin.
5. Descontar stock.
6. Probar Actualizar precios DotGG.
