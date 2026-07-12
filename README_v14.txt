LilStore TCG v14 - Pedidos profesionales

Incluye:
- Historial de pedidos.
- Filtro por estado.
- Estados:
  - Pendiente
  - Confirmado
  - Entregado
  - Cancelado
- Confirmar pedido descuenta stock una sola vez.
- Protección contra descuento duplicado.
- Cancelación solo antes de descontar stock.
- Registro de fechas:
  - Creación
  - Confirmación
  - Entrega
  - Cancelación
- Vista detallada de cada pedido.
- Se eliminan del Admin:
  - Integridad del catálogo
  - Auditoría de códigos DotGG

Compatibilidad:
- Los pedidos antiguos con estado "completed" se muestran como "Confirmado".

Actualizar:
git add .
git commit -m "v14 - Add professional order management"
git push

Probar:
/admin.html?v=140

Pruebas recomendadas:
1. Crear un pedido nuevo desde la tienda.
2. Actualizar historial.
3. Abrir el pedido.
4. Confirmar y descontar.
5. Intentar confirmar de nuevo: debe bloquearlo.
6. Marcar como entregado.
7. Crear otro pedido y cancelarlo antes de confirmar.
