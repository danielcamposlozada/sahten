# Integración de complementos · contrato del segundo lote

## Estado

Implementación local del coordinador `src/promotions/upsell-checkout.js` y conexión por dependencia explícita a `createDeliveryService()`. Reutiliza la firma HMAC, el control de aceptación y el motor económico existentes. El adaptador de producción **todavía no lo instancia**: no se habilitan promociones por añadir este archivo ni por cambiar un flag del catálogo.

Primer recorrido cubierto: retiro online, efectivo/transferencia, una oferta aceptada, sin cupón adicional. El beneficio habitual conserva su cálculo existente. Delivery, Mostrador, mejoras y cupones requieren sus contratos específicos; Mercado Pago sigue separado.

## Recorrido probado

1. `POST /upsell-offer` recibe `storeId`, `upsellSessionId` (UUID aleatorio del carrito), `upsellOfferId` e identificadores/cantidades del carrito original en `order`.
2. El servidor obtiene la oferta del menú publicado y los costos mediante un repositorio privado. Comprueba márgenes del complemento y de la cesta completa. No lee supuestas aprobaciones económicas de `order`.
3. Si corresponde, firma una oferta de cinco minutos vinculada a negocio, sesión, medio de pago, cesta original y huella de precios/reglas/costos. Devuelve token, vencimiento e importes; no costos privados.
4. Tras aceptación expresa del cliente se añade una única unidad. `POST /order` incluye `upsellToken`, `upsellOfferId`, `upsellSessionId`, `requestId` UUID y la orden final.
5. El servidor verifica firma, vigencia, cambio exacto del carrito, condiciones y margen. Consume el nonce atómicamente para ese intento y recotiza; un total anterior/inventado no se guarda.
6. El pedido conserva su snapshot contable y una huella de aceptación. No se guarda el token completo. Un reintento idéntico recupera la orden; cambiar/quitar aceptación o reutilizar el token para otra compra se rechaza.

La sesión identifica un carrito, no una persona. No usarla como identidad de cliente para cupones de primera/segunda compra.

## Dependencias privadas necesarias antes de activar

`createUpsellCheckout({ secret, readEconomics, consumeNonce, now })`:

- `secret`: clave HMAC del servidor, al menos 32 bytes, con propósito propio; nunca incluir en bundles/menú ni logs.
- `consumeNonce(claims)`: adaptador de `sahten_consume_upsell_nonce`, ya existente. Debe realizar consumo atómico e idempotente por tienda/nonce/sesión/requestId.
- `readEconomics({storeId, channel, productIds, source})`: lectura privada y actual de costos revisados. Resultado obligatorio:

```json
{
  "revision": "identificador de revisión privada",
  "products": {
    "ID": {
      "verified": true,
      "directCost": 0,
      "fixedCost": 0,
      "incrementalVerified": true,
      "additionalIncrementalCost": 0
    }
  },
  "orderCosts": {
    "verified": true,
    "additionalOrderCost": 0,
    "shippingSubsidy": 0
  }
}
```

**Los ceros del ejemplo son estructura, no valores aprobados para Sahten.** No usarlos para completar datos faltantes. `incrementalVerified` y `additionalIncrementalCost` son obligatorios en el complemento; costos directos/fijos verificados son obligatorios en todos los productos de la cesta. El subsidio cero solo corresponde a este recorrido de retiro. No conectarlo a delivery suponiendo que no hay costo de reparto.

El 40% de margen incremental y de cesta es un piso del servidor en este lote; un flag del menú no lo rebaja. Una excepción de porcentaje tampoco autoriza rebajar ese margen.

Para la escala especial de Fatay (>20%, máximo 30%) se exige además evidencia privada de aceptación comercial, vinculada a la huella de la definición exacta sin el flag de habilitación:

```json
{
  "exceptionApproval": {
    "verified": true,
    "auditId": "UUID del registro auditable",
    "definitionDigest": "SHA-256 de la definición canónica",
    "maxTotalPercent": 30
  }
}
```

Ese contrato **no crea** el registro ni reemplaza la validación de quién puede autorizarlo. El esquema/RPC de revisión, permisos, registro histórico y su editor siguen pendientes. No aceptar estos campos del navegador ni interpretar los flags históricos `ownerDelegatedApproval` como esta evidencia.

## Puertas de activación pendientes

- Modelo privado de revisiones económicas y excepciones con autor, fecha, configuración y fuente de costos; cambios de catálogo invalidan la revisión cuando corresponda.
- Publicación pausada por tipo y activación con revisión optimista; permiso dueño/admin por tienda.
- Adaptadores reales `readEconomics` y `consumeNonce`; instancia explícita del coordinador en el backend.
- Interfaz de aceptar oferta y conservar sesión/requestId/token durante el carrito, con recotización y mensajes claros al cambiar el pedido.
- Prueba transaccional con Postgres de consumo + reintentos/caídas entre consumo y guardado. El nonce existente es idempotente por requestId, pero todavía no se certificó este nuevo recorrido completo contra Postgres.
- Prueba de despliegue y recorrido entre equipos. Ninguna compra real ni cambio de precio fue realizado.

No publicar ni activar este lote como si esas puertas ya estuvieran resueltas.

## Validación local del segundo lote · 4/11/2026

- Suite completa `npx vitest run`: **965 pruebas aprobadas en 129 archivos**.
- Trece pruebas nuevas del coordinador y su integración HTTP con el servicio de pedidos: precios manipulados, cantidades, expiración, cambios de regla/costo/precio, margen, excepción Fatay, idempotencia y persistencia sin token completo.
- Compilación web, scripts clásicos y versiones correctos; versión conservada 0.4.48.
- Sin cambios de Supabase, credenciales, precios, ofertas publicadas ni despliegues. Las pruebas de repositorio de este nuevo recorrido usan datos ficticios en memoria; no certifican el adaptador/ledger de producción.

## Tercer lote: alta y costos pendientes · 4/11/2026

Este apartado actualiza los pendientes de los lotes anteriores. La migración local `20261104131316_upsell_review_publication.sql` implementa revisiones privadas inmutables, estado por negocio, auditoría, RPC de revisión/publicación pausada/activación y guardado transaccional condicionado a revisión y nonce. No carga ni activa ofertas automáticamente.

La app incorpora el flujo en **Centro de Promociones → Complementos**. La vista general consulta esas publicaciones y conserva formularios y conflictos de versión. El adaptador de delivery instancia el coordinador sólo cuando existe `SAHTEN_UPSELL_SIGNING_KEY` en el servidor: lee costos mediante la RPC privada, compara el menú, consume el nonce y confirma mediante `confirm_reviewed_upsell_order`. El guardado bloquea menú/proyecto mientras verifica costos/aceptación y usa el mecanismo de órdenes existente. No entrega claves al cliente ni guarda tokens completos.

El cliente web generado consulta y acepta ofertas, sin simular el descuento incremental. Cambiar carrito/medio o vencer la oferta obliga a revisar el total; permite continuar a precio habitual de manera explícita.

### Decisión del dueño: diferir adicionales

Se agrega **Dejar costos adicionales pendientes y registrar una excepción comercial**. La confirmación informa que se asumirán $0 adicionales exclusivamente para estimar y que el margen puede quedar sobreestimado. No duplicar los envases ya presentes en la receta.

La revisión guarda `additional_deferred=true` y `costException` con autor/fecha/nota e ID auditable; `incrementalVerified` y `orderCosts.verified` siguen false. La excepción privada permite estimar los adicionales, pero no evita costos base conocidos, firma, aceptación, una unidad ni el guardado válido. No se acepta desde el JSON del pedido.

Cada venta conserva `promotionSnapshot.costReview.status=provisional`, ID y componentes pendientes; reportes de promociones y rentabilidad mensual señalan esa condición. **Completar costos pendientes** crea otra revisión y vuelve a publicar pausada: no altera ventas ni revisiones anteriores.

Falafel permanece pendiente por instrucción del dueño: falta costo variable fijado; la receta local calcula $361,55 por porción con rendimiento 25, pero no está confirmado que esa porción sea una ración vendida de seis. No se cargó ese importe como costo de la ración.

### Antes de uso público

1. Aplicar migración y desplegar `sahten-delivery` conservando autenticación.
2. Configurar la clave HMAC exclusivamente en servidor.
3. Publicar app y actualizar una vez el cliente web, preservando diseño/contenido.
4. Dar de alta con cuenta dueña/admin y confirmar valores; se publica pausado y se activa por separado.
5. Verificar compras de prueba y sincronización desplegadas antes de activar.

No se desplegó este lote ni se modificaron precios, pedidos o promociones en producción. El flujo de ofertas en delivery/Mostrador, reemplazo 4U y los dos programas automáticos de cupones aún requieren su integración específica; este lote no los presenta como habilitados.

## QA final y aprobación pendiente

Suite completa: **981 pruebas aprobadas, 133 archivos**. Build, scripts clásicos, versiones (0.4.48 conservada) y `git diff --check` correctos. Se verificaron app → alta pausada → revisión/versiones; aceptación en HTML generado → servicio de pedidos → importes persistidos; guardado SQL condicionado a revisión/nonce; costos diferidos, reportes e histórico.

La revisión automática **rechazó** `apply_migration(upsell_review_publication)` en `dtnbokdrxojdcvguuidk`: requiere aprobación explícita del dueño por tablas privadas, funciones SECURITY DEFINER, permisos y trigger sobre `public.menus`. No se aplicó la migración ni se intentó otra vía. No están instaladas las tablas de revisión en producción.

Preflight de funciones: `sahten-delivery` v17 y `sahten-payments` v11 activas, ambas con `verify_jwt=false` y autenticación propia. Se preservará esa configuración de delivery; no se desplegará payments para este lote. Respaldo de fuente v17 (sin valores de variables de entorno) guardado fuera del repo en `entregables/backend-promociones-2026-11-04/sahten-delivery-v17.json`.

Alcance solicitado para aprobación de backend: aplicar esta migración; desplegar `sahten-delivery` con sus dependencias revisadas; generar y guardar `SAHTEN_UPSELL_SIGNING_KEY` exclusivamente como secreto de servidor. No activa ofertas ni altera precios, pedidos existentes o credenciales de Mercado Pago. El alta comercial se hará pausada mediante RPC autenticado de dueño/admin; Falafel queda pendiente. App/web necesitan publicación del cliente preparado para operar el flujo nuevo.


## Backend desplegado y verificado · 4/11/2026

El dueño autorizó expresamente la migración, `sahten-delivery` y la clave privada de firma. Después de la interrupción se comprobó que seguían ausentes las tablas antes de aplicar cambios.

- Migración `upsell_review_publication` aplicada y registrada en producción como **20261104182807** (archivo local `20261104131316_upsell_review_publication.sql`).
- `SAHTEN_UPSELL_SIGNING_KEY` creada como secreto exclusivo del servidor; no se incorpora su valor al repositorio, al cliente ni a esta documentación.
- `sahten-delivery` **v19 ACTIVE**, SHA-256 `7da3ba0b3f36cde4a838f6785e7f116a8916d015ae4a626725e4ddc050ed62f8`, con sus dependencias y autenticación propia conservadas (`verify_jwt=false`, como antes). `sahten-payments` continúa v11, sin cambios.
- Tablas privadas con RLS y sin acceso directo de `anon` o `authenticated`. Los RPC administrativos requieren autenticación y validan dueño/admin por negocio; costos y confirmación quedan restringidos al servidor.
- Comprobación HTTPS: cotización ordinaria de retiro responde **200** sin guardar pedido; oferta aún no publicada responde **409 / upsell_unavailable**; administración y costos privados rechazan acceso anónimo con **401 / 42501**.
- Conteo de revisiones y reglas nuevas: **0**. No se registró ni activó ninguna oferta, ni se crearon compras para estas pruebas. Falafel sigue pendiente.
- Asesores: nuevos avisos informativos por tablas privadas cerradas con RLS sin políticas y avisos de los cuatro RPC autenticados SECURITY DEFINER intencionales. Sus permisos y control de negocio fueron revisados; no se amplió acceso anónimo. No se modificaron advertencias preexistentes de otros módulos.

Este estado reemplaza únicamente los avisos históricos de despliegue pendiente/rechazado anteriores. **La app pública y el cliente web todavía no incluyen este lote**: falta su publicación, altas pausadas desde sesión dueña/admin y QA de compras/sincronización desplegadas. Las pruebas locales no certifican esos pasos. Los programas de cupones, mejora 4U y complementos en delivery/Mostrador siguen pendientes de integración específica.

QA posterior al despliegue: `npx vitest run`, **981 pruebas / 133 archivos**; build y revisión de diferencias correctos. Sin pruebas de compra productivas ni hardware físico.


### Cliente 0.4.49 preparado · 4/11/2026

PR #113: se prepara la publicación de app y checkout, conservando portada/mapa/fotos del despliegue de producción `91563746-1f00-4bba-8d58-16dbc96856d0`. El workflow histórico sin promociones exigía 54 productos y falló después de aprobar tests/build; se retira su ejecución automática y queda manual. El empaquetador vigente ya no obliga a habilitar las seis campañas ni fija un número histórico de productos: compara una huella íntegra de productos, precios, fotos, configuración, pagos, delivery, promociones y recomendaciones con el catálogo público actual. Consulta de nuevo al finalizar y antes de desplegar; cualquier edición concurrente detiene la publicación.

Primer paquete revisado: 40 productos, 40 fotos remotas, 11 bebidas, seis campañas (dos habilitadas y cuatro pausadas), beneficio habitual del 10 %. Son una lectura puntual, no valores que el despliegue fuerce sobre futuras ediciones. Se preservan los 16 archivos de marca/páginas/fotos y el layout original de portada. No se crean/activan ofertas ni se publica una descripción nueva. Instaladores y hosting aún pendientes de publicación al escribir este apartado.

QA de preparación 0.4.49: **989 pruebas / 134 archivos**, build online y offline, versiones y scripts clásicos correctos. Empaquetado real y validación del manifiesto correctos; el antiguo fallo de cantidad fija no debe eludirse reactivando campañas.


## Publicación web 0.4.49 verificada · 4/11/2026

PR #113 integrado con merge normal `064fc36ee94ee1de358bbe36011a83e3fe007354`. Los tres checks de PR terminaron correctamente: CI, paquete de promociones y pruebas nativas de impresión Windows/Mac. La suite local completa pasó **989 pruebas en 134 archivos**, con build online/offline, versiones y scripts clásicos correctos.

Cloudflare Production **eedac5fc-a89a-4c4e-bf42-3147370bfb30**, éxito, workflow **41932214863**. HTTPS confirma el cliente `upsell-offer` / `data-upsell-consult` en `/pedir/`; los 16 recursos preservados coinciden por SHA-256 con el despliegue de origen `91563746-1f00-4bba-8d58-16dbc96856d0`. No se reemplazó el diseño aprobado del mapa, portada, fotos ni páginas informativas.

El paquete conserva el catálogo vivo de la consulta: 40 productos, 40 fotos remotas, 11 bebidas, dos campañas habilitadas (`central-tables`, `weekly-meals`) y cuatro pausadas. Los recuentos anteriores de 46/47/54 son fotografías de otras consultas; no se fuerzan sobre el catálogo actual. No se registró ni activó ninguna oferta nueva: revisión posterior del backend confirma cero revisiones y cero reglas nuevas habilitadas. Falafel continúa pendiente.

Se retiró la ejecución automática del workflow histórico que exigía 54 productos y apagaba promociones. El workflow vigente verifica la huella completa del catálogo, sin cambiar estados, y detiene la publicación ante cambios concurrentes. El cron keepalive sin configuración dejó de ejecutarse automáticamente; el diagnóstico nuevo devuelve **HTTP 200** usando clave pública y `limit=0`, sin recuperar registros. Esta prueba local no afirma que los secretos opcionales de GitHub estén configurados ni que se haya ejecutado manualmente ese workflow.

Guía del flujo: [Complementos 0.4.49](GUIA-COMPLEMENTOS-049.md). Altas pausadas con dueño/admin, compras de prueba completas, sincronización entre equipos instalados y tickets físicos siguen pendientes. Los programas automáticos de cupones, mejora 4U y complementos en delivery/Mostrador no se presentan como operativos.


**Instaladores 0.4.49 publicados y comprobados:** workflow `41932214779` completó Windows, Mac universal y publicación correctamente. Release público: https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.49 . El manifiesto `latest.json` debe anunciar 0.4.49 y las tres plataformas firmadas antes de dar por completada su verificación. Esta publicación no acredita una compra productiva, una impresora física ni sincronización entre dos equipos del dueño.
