LilStore TCG v8.6.3 - Fix parser DotGG

Corrige:
- Actualizar precios DotGG solo actualizaba ~40 cartas.
- Muchas cartas quedaban como NO_PRICE porque DotGG puede devolver precios como texto o en estructuras anidadas.
- Ahora el parser usa toNumber() y fallback profundo.

Actualizar:
git add .
git commit -m "v8.6.3 - Fix DotGG price parser"
git push

Probar:
/admin.html?v=863

Luego presiona:
Actualizar precios DotGG

Resultado esperado:
- Precios actualizados: cercano a 931
- Sin precio encontrado: cercano a 7
