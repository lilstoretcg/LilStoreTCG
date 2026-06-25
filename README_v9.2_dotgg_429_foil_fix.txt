LilStore TCG v9.2 - DotGG 429 + Foil fallback

Solución enfocada en lo que mostró la auditoría:

1. Si Normal viene vacío/0 pero Foil tiene precio, usa Foil como precio principal.
2. Si DotGG responde 429 Too Many Requests:
   - espera
   - reintenta
   - reduce el riesgo de bloqueo
3. Sincronización lenta y segura:
   - 1 consulta a la vez
   - pausa de 350 ms entre cartas

Importante:
Esta versión puede tardar varios minutos en actualizar los 938 códigos.
Es normal.

Actualizar:
git add .
git commit -m "v9.2 - Add DotGG 429 handling and foil fallback"
git push

Probar:
/admin.html?v=92

Pasos:
1. Diagnóstico DotGG.
2. Actualizar precios DotGG.
3. Esperar. Puede tardar 6 a 10 minutos.
4. Resultado esperado: muchas más cartas actualizadas que v9.0.
