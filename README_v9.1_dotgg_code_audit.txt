LilStore TCG v9.1 - Auditoría de códigos DotGG

Agrega una herramienta para revisar qué códigos reconoce DotGG.

Nuevo panel Admin:
- Auditoría de códigos DotGG
- Inicio
- Cantidad
- Botón Auditar códigos

Qué hace:
- Consulta DotGG para un rango de cartas.
- Muestra cuántas fueron encontradas.
- Muestra primeras fallidas.
- Descarga CSV automático con:
  Carta
  Código local
  DotGG local
  Código enviado
  Encontrada
  Status
  Precio
  Payload cardid
  Muestra

Actualizar:
git add .
git commit -m "v9.1 - Add DotGG code audit"
git push

Probar:
/admin.html?v=91

Recomendación:
1. Auditar Inicio 0, Cantidad 80.
2. Revisar CSV.
3. Luego probar Inicio 80, Cantidad 80.
4. Enviar captura o contenido del CSV si aparecen muchos NO.
