LilStore TCG v6.5 - Panel profesional de stock

Qué agrega:
- admin.html: panel privado para actualizar stock desde la web.
- Netlify Function: /.netlify/functions/stock
- Netlify Blobs para guardar stock en la nube.
- La tienda lee el stock remoto automáticamente.

Cómo configurarlo en Netlify:
1. Sube este ZIP a Netlify.
2. En Netlify entra a:
   Project configuration > Environment variables
3. Agrega:
   ADMIN_PIN = el PIN privado que quieras usar
4. Haz Deploy.

Cómo usar el panel:
1. Abre:
   https://TU-SITIO.netlify.app/admin.html
2. Ingresa tu PIN.
3. Busca una carta.
4. Cambia el stock.
5. Presiona Guardar stock.

Importante:
- No compartas el PIN.
- No necesitas volver a subir ZIP cada vez que cambias stock.
- El catálogo base sigue en data/cards.json.
- Solo el stock se guarda dinámicamente en Netlify Blobs.
