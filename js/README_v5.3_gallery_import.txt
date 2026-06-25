LilStore TCG v5.3 - Importador de galería oficial Riftbound

Qué agrega:
- scripts/import-riftbound-gallery.js
- Comando npm run import:gallery
- Playwright para leer la galería oficial de Riftbound desde navegador.

Importante:
Este importador está preparado como primer paso automatizado.
Debe ejecutarse localmente, no en Netlify.

Pasos:
1. Descomprime el proyecto.
2. Abre terminal dentro de la carpeta.
3. Ejecuta:
   npm install
   npx playwright install chromium
   npm run import:gallery

Resultado:
- data/cards-master.json actualizado
- data/cards.json actualizado
- Las cartas importadas sin stock quedan como agotadas.

Luego:
- Revisa los nombres importados.
- Sube nuevamente el proyecto a Netlify.

Nota:
La galería oficial puede cambiar su estructura visual.
Si eso ocurre, ajustaremos los selectores del script.
