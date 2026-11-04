# Auditoría e implementación de promociones · 4/11/2026

## Alcance y fuentes

Trabajo en el repositorio real `danielcamposlozada/sahten`, rama local `fix/promotions-audit-2026-11-04`, base `96b5989` (0.4.48). Se conserva sin cambios el checkout anterior de trabajo de Codex y sus propuestas visuales. El mapa aprobado queda fuera de esta intervención; pendiente mejorar protagonismo de la fotografía del beneficio en tablet/celular.

Fuentes contrastadas: traspaso del dueño del 4/11, plan comercial versión 6, archivo del dueño `SAHTEN Gastronomia Arabe.sahten` (guardado 3/11 02:48:58 UTC, `appVersion` 0.4.46), proyecto guardado en nube revisión 331 y menú/estados comerciales de Supabase consultados en solo lectura. La versión dentro del archivo no prueba qué ejecutable está instalado actualmente.

No se descargaron pedidos ni clientes para esta auditoría ni se copiaron sesiones o credenciales al repositorio. No se modificó el proyecto del dueño, Supabase, la tienda ni las condiciones comerciales.

## Las nueve propuestas exactas

Los nueve interruptores marcados del problema corresponden a borradores comerciales, no a ofertas publicadas. El archivo tiene además dos recomendaciones sin rebaja marcadas: `hummus-complement` y `falafel-mix-complement`.

| ID | Tipo | Propuesta local | Situación real y siguiente paso |
|---|---|---|---|
| `baklava-up` | Complemento | 20% total en una unidad | No publicado con este ID; requiere costos incrementales y conexión de aceptación/cotización. |
| `fatay-individual-up` | Complemento escalonado | 20/25/30% total desde $20.000/$35.000/$50.000 netos elegibles | La RPC antigua rechaza >20%; la excepción requiere autorización comercial, margen y aceptación verificable. No confundir con Fatay público al 11%. |
| `mamul-nuez-up` | Complemento | 15% total en una unidad | No publicado; mismos requisitos de cotización, margen y aceptación. |
| `mamul-datil-up` | Complemento | 15% total en una unidad | No publicado; mismos requisitos de cotización, margen y aceptación. |
| `torta-chocolate-up` | Complemento | 15% total en una unidad | No publicado; mismos requisitos de cotización, margen y aceptación. |
| `falafel-racion-up` | Complemento escalonado | 20/25/30% total en una porción de seis croquetas | No extender automáticamente la excepción Fatay: confirmar esta propuesta, tahini, envase, trabajo y margen del carrito. |
| `fatay-cuarta` | Reemplazo | Sustituir 3U por SKU 4U `p1779570052552`, beneficio habitual, sin extra | El checkout ya reconoce el SKU oculto/aceptación; faltan publicación del SKU y validación económica. La RPC antigua exige extra >0 incluso para este reemplazo sin extra. |
| `first_online` | Programa de cupón | +5 puntos, mínimo $30.000, 14 días | Existe infraestructura de cupones, pero no basta activar el programa local: falta emisión vinculada a identidad/origen y publicación integral. |
| `second_online` | Programa de cupón | +10 puntos, mínimo $40.000, tope adicional $4.000, 14 días | Igual, con compra de origen confirmada y deduplicación. |

Datos estructurados: [auditoria-nueve-propuestas-2026-11-04.json](auditoria-nueve-propuestas-2026-11-04.json).

El archivo local conserva estas nueve decisiones de planificación; el proyecto guardado en nube no tiene esos flags. Por seguridad no se ha reemplazado ninguna copia por la otra.

## Producción observada

Seis campañas publicadas, dos habilitadas:

- `weekly-meals`: 15% total, lun–mié, habilitada.
- `central-tables`: 15% total, segundo y tercer viernes/sábado, habilitada.
- `falafel-mix-moderado-nov26`: 11% total, pausada.
- `fatay-adicional-moderado-nov26`: 11% total, pausada.
- `postres-extra-online-nov26`: 12% total, pausada.
- `postres-mamul-extra-nov26`: 12% total, pausada.

Habilitada no significa aplicable fuera del calendario, canal, medio de pago y productos elegibles. Los cuatro sustitutos al 11/12% no equivalen a los complementos originales. No se activaron ni borraron.

## Hallazgos técnicos que impiden activar a ciegas

1. `publicationKind()` admite nuevas campañas online y sugerencias sin descuento; bloquea otros tipos. No se debe quitar el bloqueo sin implementar su contrato transaccional.
2. `verify_promotion_draft()` verifica catálogo y costo base, pero fija `additional`, `checkout`, `publication` en falso. Eso no demuestra una prueba de checkout fallida: indica ausencia de comprobación en esa RPC.
3. Existen `issueUpsellChallenge()`, `verifyAcceptedUpsell()`, libro privado de nonces y evaluación incremental/carrito. La búsqueda de referencias en `src/` y `supabase/functions/` muestra que emisión/aceptación no están conectadas al servicio de pago ni a un endpoint público. No es un bloqueo meramente visual obsoleto.
4. El motor recibe costos incrementales, selección validada y costos del pedido como dependencias confiables, pero el servicio de pago actual no las suministra. Nunca tomar esos valores de la petición del navegador.
5. El reemplazo Fatay sin extra no debe pasar por la regla de un descuento adicional >0. La publicación requiere su propio contrato; mantener separada su aprobación de la aceptación del cliente.
6. El guardado periódico protegía la edición de campañas publicadas, pero no los formularios de borradores/cupones. También podía refrescar la revisión base de una campaña mientras se editaba, debilitando el control de conflictos.

## Primer lote corregido localmente

- Evidencia con cinco estados: aprobada, rechazada, pendiente, no aplicable y no comprobada. Separación explícita entre resultado y permiso para publicar/activar.
- Compatibilidad con RPC antigua: sus falsos fijos de integración no se presentan como pruebas ejecutadas y rechazadas. Los fallos reales de catálogo/costo/margen siguen rechazados.
- Escala Fatay >20% clasificada como excepción pendiente, sin conceder autorización ni relajar la cotización.
- Planificación mediante botón con etiqueta local; el switch queda reservado al control comercial en vivo.
- Verificación masiva sin truncar silenciosamente a 40 propuestas y con un máximo de cuatro consultas simultáneas.
- Protección frente a respuestas de verificación fuera de orden y frente a refresh automático que sustituya campos/revisión mientras se escribe.
- Ticket: una campaña aplicada queda solamente en el desglose; se mantienen anuncios de otras campañas, los cuatro formatos y la frecuencia de 90 días. No se cambia el histórico de tickets ya guardados.
- En QA se retiró una restricción demasiado amplia: dos combos originales pueden terminar como uno 3U y otro 4U. Ese caso válido conserva su cálculo existente.
- Prueba de respaldos ajustada a hora local, como el contrato de `hourlyBackup()`. El fallo basal era una expectativa UTC dependiente de la zona horaria, no evidencia de pérdida de datos.

## GitHub Actions / Supabase

Log confirmado del job `126153289289`, ejecución [41703683504](https://github.com/danielcamposlozada/sahten/actions/runs/41703683504): `SUPABASE_URL` y `SUPABASE_ANON_KEY` vacías. Falla antes de red; no demuestra caída de Supabase. Proyecto consultado: activo y saludable, con tráfico operativo abundante en las últimas 24 horas.

Corrección preparada: retirar el cron artificial diario y conservar diagnóstico manual. Verifica configuración, HTTPS y clave pública; rechaza claves administrativas, no sigue redirecciones, consulta `limit=0`, limita tiempos/reintentos y no imprime cabeceras, cuerpos ni errores privados de red. No se crearon ni leyeron secretos administrativos. La disponibilidad/ámbito de los secretos de GitHub no se ha modificado ni verificado desde Settings. La ejecución manual de Actions queda pendiente de integrar el cambio y disponer de configuración pública válida. No afirmar que el job remoto ya está reparado.

## Recuperación editorial

Confirmado: 46/46 descripciones publicadas vacías. Archivo del dueño: ninguna descripción recuperable por ID en los productos publicados. Recuperados 31 borradores cotejados del 30/10, no textos que hubieran estado publicados. Quedan 15 productos sin texto recuperado. No se redactan composiciones por inferencia ni se publican estos textos automáticamente.

Comparación por ID en [recuperacion-descripciones-2026-11-04.json](recuperacion-descripciones-2026-11-04.json), catálogo público mínimo en [auditoria-productos-publicados-2026-11-04.json](auditoria-productos-publicados-2026-11-04.json). Nombres actuales se conservan; el nombre comercial confirmado «Aristelos» sigue siendo una corrección pendiente de aprobación/publicación en el dato real.

## Implementación aún pendiente — no dar por terminada

- Contrato único servidor por tipo, revisión y auditoría de excepciones comerciales; publicación pausada y activación separadas.
- Fuente privada y editable de costos incrementales verificados; comprobación de margen de toda la cesta con costos reales, envío y comisiones.
- Conectar desafío firmado, aceptación, nonce e idempotencia al servicio de compra; interfaz contextual y una sola oferta descontada.
- Publicación/edición real de reemplazos y programas de cupón; identidad, origen y canje transaccional probado.
- Centro agrupado, calendario y vistas previas completos; prueba entre Mac y Windows.
- Propuesta comparada de sustitución de 11/12%, textos de productos y aceptación de valores antes de activarlos en producción.
- QA de compras de prueba, hardware térmico 58/80, instaladores y dos presentaciones finales con estados reales.

No se publicaron app/web, migraciones ni promociones nuevas en este lote. Mantener el backend comercial actual hasta completar sus verificaciones y la confirmación concreta del dueño.

## Validación del primer lote

- `npm ci`: instalación correcta. Cuatro avisos de dependencias informados por npm; no se aplicó `audit fix` ni se cambiaron versiones.
- Suite basal: 939 aprobadas, un fallo en expectativa horaria de respaldo (UTC frente a hora local de Buenos Aires).
- `npx vitest run` después de las correcciones: **952 pruebas aprobadas, 128 archivos**, sin fallos.
- Verificaciones adicionales: lotes de 45 borradores con máximo cuatro consultas simultáneas; respuesta vieja que llega después de otra nueva; conservar un formulario al recuperar foco; rechazo del carrito 3U+4U.
- Respaldos: prueba ejecutada tanto con `TZ=UTC` como con `TZ=America/Argentina/Buenos_Aires`, aprobada.
- `npm run build`, `npm run check:versions` y `npm run check:legacy`: correctos. Versión conservada 0.4.48, sin publicar release.
- `git diff --check`: sin errores de espacios.
- Esto valida código local, no certifica compras reales, impresión física, sincronización entre equipos ni el diagnóstico remoto de Actions. Esas comprobaciones siguen pendientes.

## Segundo lote · coordinador de complementos

Se prepara el recorrido local oferta firmada → aceptación → pedido recotizado para retiro online y efectivo/transferencia. Usa las librerías existentes y se conecta por dependencia al servicio de pedidos. El adaptador real sigue sin instanciarlo; no se activa ninguna oferta por omisión. Contrato, límites y puertas pendientes en [INTEGRACION-COMPLEMENTOS.md](INTEGRACION-COMPLEMENTOS.md). La revisión económica privada y el flujo de publicación/activación desde la app siguen pendientes; no confundir pruebas de integración en memoria con un checkout productivo certificado.

Validación del segundo lote: suite completa **965/965 pruebas, 129 archivos**; build, scripts clásicos y comprobación de versiones correctos. Se mantiene versión 0.4.48 y el coordinador deshabilitado en el adaptador productivo. No se desplegó ningún cambio.

## Tercer lote: alta y cliente web

Preparados RPC/revisiones privadas, adaptador condicionado a clave HMAC, alta/consulta/activación desde la app y aceptación en la web. El dueño autorizó adicionales pendientes con marca provisional auditable, sin presentarlos como comprobados. Falafel sigue pendiente. INTEGRACION-COMPLEMENTOS.md actualiza el estado técnico: aún sin despliegues ni activaciones nuevas.


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
