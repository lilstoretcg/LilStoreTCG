LilStore TCG v6 - Flujo para completar Origins

Objetivo:
- Importar Origins desde la galería oficial usando filtro manual.
- Mantener el filtro de rareza simple:
  Todas, Common, Uncommon, Rare, Showcase.

Comandos:
1. Abre CMD dentro de esta carpeta.
2. Ejecuta:
   npm install
   npx playwright install chromium
   npm run import:origins

Uso:
- Se abrirá la galería oficial en Chromium.
- Filtra manualmente por Origins.
- Baja hasta cargar todas las cartas.
- Vuelve a la terminal y presiona ENTER.
- Se generará:
  data/origins-import-review.json

Luego:
- Sube origins-import-review.json al chat.
- Lo limpio, clasifico y lo convierto en un cards-master.json definitivo para Origins.

Regla de rarezas:
- Common
- Uncommon
- Rare
- Showcase

Las versiones especiales como Alternate Art, Signature y Overnumbered se agrupan como Showcase.
No se crea filtro de variante.
