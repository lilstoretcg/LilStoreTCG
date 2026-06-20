LilStore TCG v6.5.1 - Fix Netlify Blobs

Corrección:
- Se agregó connectLambda(event) en netlify/functions/stock.js.
- Esto corrige MissingBlobsEnvironmentError en Netlify Functions con sintaxis Lambda.

Para actualizar GitHub:
git add .
git commit -m "Fix Netlify Blobs stock function"
git push

Luego Netlify desplegará automáticamente.
