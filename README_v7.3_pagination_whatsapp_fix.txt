LilStore TCG v7.3 - Paginación + WhatsApp

Corrige:
- Botón Finalizar por WhatsApp abre WhatsApp Web con pedido y total.
- La tienda ahora pagina el catálogo.
- Muestra 48 cartas por página.
- Imágenes con loading="lazy" para mejorar carga.
- Controles Anterior / Siguiente.

Actualizar:
git add .
git commit -m "Add pagination and fix WhatsApp checkout"
git push

Después del deploy:
1. Abre la tienda con ?v=73 para evitar caché.
2. Prueba páginas siguientes.
3. Agrega una carta al carrito.
4. Finalizar por WhatsApp debe abrir WhatsApp Web con mensaje.
