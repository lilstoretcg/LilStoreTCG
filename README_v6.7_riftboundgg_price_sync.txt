LilStore TCG v6.7 - Sincronización de precios Riftbound.gg

Qué agrega:
- Botón en admin.html: "Actualizar precios Riftbound.gg".
- Netlify Function: netlify/functions/sync-riftboundgg-prices.js
- Toma el precio visible de Riftbound.gg / Buy on TCGplayer.
- Actualiza Market USD y LilStore CLP en Netlify Blobs.
- Mantiene el stock actual.

Uso:
1. Publica esta versión en GitHub:
   git add .
   git commit -m "Add Riftbound.gg price sync"
   git push

2. Espera deploy de Netlify.
3. Abre /admin.html.
4. Ingresa PIN.
5. Configura:
   Dólar CLP = 900
   Multiplicador = 1 o 0.95
6. Presiona "Actualizar precios Riftbound.gg".

Notas:
- No usa API oficial de TCGplayer.
- No requiere claves privadas de TCGplayer.
- Si Riftbound.gg cambia su página, puede requerir ajuste.
