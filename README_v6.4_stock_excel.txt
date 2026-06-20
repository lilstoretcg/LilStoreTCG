LilStore TCG v6.4 - Stock con Excel

Nuevo flujo para actualizar stock:

1. Abre stock.xlsx.
2. En la hoja Stock, edita la columna Stock.
3. Opcional: edita Market USD para ajustar precio de mercado.
4. Guarda el archivo como stock.xlsx en la carpeta principal del proyecto.
5. Abre CMD dentro de la carpeta del proyecto.
6. Ejecuta:
   npm install
   npm run import:stock

El script actualiza automáticamente:
- data/cards.json
- data/cards-master.json

Notas:
- No modifiques Public Code, porque identifica cada carta.
- Precio CLP se calcula con dólar fijo 900 y multiplicador 0.95.
- Status cambia automáticamente a available si Stock > 0, o soldout si Stock = 0.
