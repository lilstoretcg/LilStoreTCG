LilStore TCG v6.8.2 - Fix DotGG single object

Corrige:
- DotGG a veces devuelve un objeto único en vez de un array.
- El parser ahora acepta ese formato.
- Búsqueda recursiva de precio en Normal, tcgplayerPrice, marketPrice, price, closePrice, etc.
- Aumenta sample de error a 700 caracteres para depuración.

Actualizar:
git add .
git commit -m "Fix DotGG single object prices"
git push
