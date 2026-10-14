# Configuración y precios compartidos

La configuración de dólar/multiplicador y el catálogo viven juntos en `lilstore-catalog/pricing-state`. Cada cambio incrementa `version` y `catalogVersion` en la misma escritura; `pricingVersion` solo avanza cuando cambia la configuración. La clave antigua `cards` se conserva como fuente de migración.

Las actualizaciones utilizan `setJSON` con `onlyIfNew` o `onlyIfMatch`, verifican que el SDK devuelva `modified: true` y un ETag no vacío, y conservan los identificadores de operación confirmados para rechazar reintentos antiguos. `@netlify/blobs` está fijado en `10.7.13`; `package-lock.json` es el lockfile de instalación, y Netlify ejecuta `npm ci`.

Configure en Netlify los valores privados `NETLIFY_BLOBS_API_TOKEN` y `NETLIFY_SITE_ID` en el proyecto de staging y luego en producción, con scope de ejecución de Functions y los contextos de deploy necesarios. Cree un Personal Access Token de Netlify con acceso a Blobs para el proyecto correspondiente; el código no lee el secreto desde el navegador ni lo devuelve en las respuestas. `NETLIFY_SITE_ID` debe ser el Project ID del mismo sitio. El ID configurado tiene prioridad sobre `x-nf-site-id`; si ambos existen y difieren, la función falla cerrada. No comparta ni copie el token en el repositorio, tickets, logs o comandos que queden en el historial. Sin `NETLIFY_BLOBS_API_TOKEN`, las lecturas usan el endpoint edge y las escrituras versionadas fallan cerradas con HTTP 503. Las lecturas fuertes no están disponibles mediante el `connectLambda(event)` de esta versión del SDK porque el contexto Lambda carece de `uncachedEdgeURL`; el token permite acceso directo a la API con consistencia fuerte.

La sincronización de precios DotGG no lee ni escribe `lilstore-inventory`; por ello no puede restaurar una captura anterior ni reemplazar stock normal, foil o variantes especiales editados durante las consultas externas. Solo publica los cambios del catálogo mediante el registro versionado. El catálogo público emite el identificador de versión que el administrador y la tienda comparan con el endpoint de configuración.

No hay transacción atómica entre catálogo, inventario y pedidos. Las funciones de confirmación y reintegro de pedidos permanecen sin cambios. El SDK se prueba localmente con transporte controlado, pero ETag/CAS y la propagación de Blobs deben confirmarse en un staging aislado antes de producción. Un Deploy Preview del sitio productivo no sirve para esta prueba: los stores site-wide de Blobs se comparten entre deploys del mismo sitio.

### Aislamiento y configuración

1. En Netlify crea un **proyecto nuevo** conectado al repositorio o a una rama de validación. No uses Deploy Preview del proyecto productivo: los stores site-wide se comparten entre deploys del mismo proyecto. El `NETLIFY_SITE_ID` del staging debe ser distinto al de producción.
2. En **Project configuration > General > Project information**, copia el Project ID de staging y compáralo privadamente con el de producción. En **Project configuration > Environment variables**, crea `NETLIFY_SITE_ID` con el ID de staging, `NETLIFY_BLOBS_API_TOKEN` como secreto y `ADMIN_PIN` con un PIN exclusivo de staging. Limita variables al contexto de Functions y deploy contexts usados. No pongas valores en el repo, comandos, capturas, logs ni en esta guía.
3. Usa un Personal Access Token con acceso a Blobs para el sitio de staging; verifica en Netlify que la identidad/token pueda acceder al sitio correcto. No uses una credencial que permita accidentalmente operar en producción. No compartas el valor del token con quien ejecute las pruebas.
4. Despliega solo a ese proyecto aislado y carga cartas, inventario y pedidos **sintéticos**. Verifica que su Project ID sea staging antes de guardar. La propia función prioriza `NETLIFY_SITE_ID` y rechaza una cabecera de sitio distinta.

### Procedimiento de comprobación real

Haz las pruebas siguientes en la URL del sitio staging, nunca en producción. Antes de empezar, conserva el Project ID de staging de forma privada; no imprimas valores de token/PIN. La consola de DevTools mostrará únicamente estados HTTP y versiones.

1. **Concurrencia de configuración.** En la consola de DevTools de staging pega este fragmento. Pide el PIN mediante un diálogo; no imprime ni guarda el valor. Cambia solo el estado sintético de staging:

```js
(async()=>{
  const pin=prompt('PIN exclusivo de staging');
  const read=async()=>{
    const r=await fetch('/.netlify/functions/settings?v='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('settings HTTP '+r.status);
    return r.json();
  };
  const initial=await read(), version=Number(initial.pricingVersion||0);
  const send=(margin,operationId)=>fetch('/.netlify/functions/settings',{
    method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':pin},
    body:JSON.stringify({pricing:{dollar:initial.pricing.dollar,margin},expectedVersion:version,operationId})
  });
  const [a,b]=await Promise.all([
    send(Math.min(100,Number(initial.pricing.margin)+0.01),crypto.randomUUID()),
    send(Math.min(100,Number(initial.pricing.margin)+0.02),crypto.randomUUID())
  ]);
  console.log('Concurrent HTTP statuses:',a.status,b.status);
  const [s,c]=await Promise.all([read(),fetch('/.netlify/functions/catalog?v='+Date.now(),{cache:'no-store'})]);
  console.log('State/catalog versions:',s.stateVersion,c.headers.get('X-LilStore-State-Version'));
})();
```

   **Aprueba:** un `200`, un `409`, y las versiones de settings y catálogo iguales; el segundo cambio no debe sobrescribir al primero. **Rechaza:** dos respuestas `200`, dos commits o versiones distintas.
2. **Escritura y lectura fuerte inmediata.** Guarda una nueva configuración sintética desde el modal público con el PIN de staging. En cuanto responda, vuelve a leer settings y catálogo desde dos pestañas; confirma el mismo `stateVersion`, `catalogVersion` y `pricingVersion`, el valor recién guardado y el precio recalculado. Como la función exige acceso directo con el token y crea el store con consistencia `strong`, esta comprobación ejercita el backend real.
3. **Interrupción y recuperación.** En DevTools Network, envía un POST válido a settings con `operationId` único y desconecta la pestaña/conexión antes de ver la respuesta. Reenvía exactamente cuerpo, `expectedVersion` y `operationId`. Lee el estado: debe quedar aplicada como máximo una vez (versión inicial + 1); no infieras que cortar la conexión cancela una escritura aceptada. Si después de leer otra operación distinta, reenvía el ID antiguo y confirma HTTP 409, sin incremento de versión.
4. **Reintentos idempotentes.** Envía dos veces seguidas el mismo POST y el mismo ID antes de cualquier otro cambio. La repetición puede responder `200`, pero no debe aumentar la versión otra vez. Después guarda una operación nueva y reintenta el ID antiguo: debe recibir `409`, sin modificar el estado.
5. **Catálogo, inventario y precios.** Carga cartas sintéticas con código conocido, stock normal, `foilStock`, variantes especiales, una carta `priceSource: "manual"` con precios normal/foil diferenciados y otra automática con precios base por rareza. Revisa catálogo antes/después de cambiar dólar/multiplicador y de sincronizar DotGG. Stock y variantes deben mantener los valores más recientes; los precios manuales no cambian; los automáticos reflejan precio USD × dólar × multiplicador con el piso de rareza aplicado una vez. Fuerza un conflicto de versión: debe fallar sin mensaje de éxito ni escritura parcial.
6. **Falta de autorización/secreto.** Envía el mismo cambio con PIN incorrecto: debe responder 401 y no cambiar versión. En staging únicamente, retira temporalmente `NETLIFY_BLOBS_API_TOKEN`, intenta guardar y confirma 503 y estado intacto; restablece la variable y espera el nuevo deploy. Nunca imprimas las variables para comprobarlas.
7. **XLSX del administrador.** En staging importa un XLSX recién creado con códigos ficticios, nombres y cantidades pequeñas; verifica las filas/códigos y exporta un respaldo XLSX. Abre el archivo exportado y confirma las hojas/celdas. La página debe cargar el script oficial SheetJS 0.20.3. No importes el respaldo o inventario de producción.
8. **Regresión de pedidos y WhatsApp.** Con solo inventario y cartas sintéticas, crea un pedido con cantidades pequeñas normal/foil. Guarda los importes mostrados en el texto de WhatsApp y consulta el pedido por su ID; los `unitPrice`, `subtotal` y `total` deben coincidir. Confirma el pedido: stock baja una vez; reintegra: stock vuelve una vez; intenta reintegrar de nuevo: debe responder conflicto. Cambia la configuración de precios y vuelve a consultar el pedido; sus importes históricos y el mensaje inicial deben conservarse. No uses pedidos reales.

### Pruebas locales y clasificación

Desde la raíz del repositorio ejecuta:

```text
npm ci
npm audit
npm run test:pricing-state
npm run test:card-codes
npm run test:sync-concurrency
npm run test:blobs-api
npm run build
node --check netlify/functions/pricing-state.js
node --check netlify/functions/settings.js
node --check netlify/functions/catalog.js
node --check netlify/functions/manual-prices.js
node --check netlify/functions/sync-dotgg-catalog.js
node --check netlify/functions/sync-riftboundgg-prices.js
node --check js/app.js
node --check js/admin.js
git diff --check
```

`test:pricing-state` y `test:sync-concurrency` simulan Blobs con stores en memoria. `test:blobs-api` utiliza `@netlify/blobs` 10.7.13 real con `fetch` controlado: comprueba el formato de ETags, `onlyIfMatch`, `onlyIfNew`, 412/503 y el endpoint de lectura fuerte, pero no se conecta al servicio Netlify. `test:card-codes`, `node --check`, el round-trip XLSX local y `git diff --check` tampoco prueban staging. `npm run build` actualmente solo muestra “Build listo”; no es un empaquetado. Solo los ocho pasos del procedimiento anterior contra el proyecto aislado validan el backend real y las interfaces reales.

**Criterio general:** aprobar solo con todos los pasos de staging aprobados, sin cambios en datos de producción, sin secretos en salidas y con inventario/pedidos sintéticos restaurados a su estado inicial al finalizar. Rechazar y detener el paso a producción ante cualquier doble éxito, pérdida de datos, discrepancia de versión/precio, actualización de precio manual, respuesta de éxito tras error o movimiento de stock duplicado.
