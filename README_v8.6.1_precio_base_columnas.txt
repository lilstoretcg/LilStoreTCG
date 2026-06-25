LilStore TCG v8.6.1 - Precio Base columnas y layout

Corrige:
- El panel Precio base por rareza vuelve a verse en formato compacto de 3 columnas.
- Evita que ocupe demasiado espacio vertical.

Agrega en la tabla Admin:
- Mercado Normal CLP
- Precio base Normal
- Precio final Normal
- Mercado Foil CLP
- Precio base Foil
- Precio final Foil

Notas:
- Mercado CLP se calcula con Dólar CLP y Multiplicador LilStore del panel.
- Precio base viene de la configuración por rareza.
- Precio final es el valor editable que se guarda como precio LilStore.

Actualizar:
git add .
git commit -m "v8.6.1 - Add base price columns and fix layout"
git push

Probar:
/admin.html?v=861
