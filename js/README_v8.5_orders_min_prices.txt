LilStore TCG v8.5 - Pedidos + precios mínimos

Incluye ambas ideas:

1) Sistema de pedidos
- Al finalizar por WhatsApp se genera un número de pedido automático: #00001, #00002, etc.
- El mensaje de WhatsApp incluye el número de pedido.
- El stock NO se descuenta automáticamente al enviar WhatsApp.
- En Admin puedes buscar el pedido por número.
- Al confirmar el pedido, se descuenta el stock automáticamente.
- El sistema evita descontar dos veces el mismo pedido.

2) Precios mínimos por rareza
- Nuevo apartado en Admin para definir mínimos:
  Common normal / foil
  Uncommon normal / foil
  Rare
  Epic
  Showcase
- Puedes guardar reglas.
- Puedes aplicar mínimos al inventario.
- El precio final queda como el mayor entre el precio DotGG y el mínimo configurado.

Archivos principales modificados:
- index.html
- js/app.js
- admin.html
- js/admin.js
- css/admin.css
- netlify/functions/orders.js
- netlify/functions/settings.js
- netlify/functions/sync-riftboundgg-prices.js

Actualizar:
git add .
git commit -m "Add order confirmation and minimum rarity prices"
git push

Probar:
Tienda:
/?v=85

Admin:
/admin.html?v=85

Pruebas recomendadas:
1. Agrega una carta normal y una foil al carrito.
2. Presiona Finalizar por WhatsApp.
3. Verifica que el mensaje tenga Pedido #00001.
4. En Admin, ingresa el número de pedido.
5. Presiona Buscar pedido.
6. Si corresponde, presiona Descontar stock.
7. Confirma que no permite descontar el mismo pedido dos veces.
8. Define mínimos por rareza y aplica mínimos al inventario.
