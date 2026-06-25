LilStore TCG v8.2 - Mini carrito como carrito principal

Cambios:
- El botón Carrito abre el mini carrito lateral/inferior.
- Se elimina el botón "Ver carrito completo" del mini carrito.
- El flujo queda directo con:
  - Finalizar por WhatsApp
  - Vaciar carrito
- La página cart.html queda como respaldo, pero ya no es necesaria para el flujo principal.

Actualizar:
git add .
git commit -m "Make mini cart main cart"
git push

Probar:
/?v=82

Pruebas recomendadas:
1. Agregar carta normal.
2. Agregar carta foil.
3. Presionar botón Carrito del header.
4. Cambiar cantidades dentro del mini carrito.
5. Finalizar por WhatsApp.
