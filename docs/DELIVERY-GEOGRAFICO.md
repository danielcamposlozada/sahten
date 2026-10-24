# Delivery geográfico, beneficios y horarios

Estado: preparado en `codex/delivery-geografico`, sin fusionar, desplegar funciones, aplicar SQL ni modificar la tienda real. La auditoría general de UX continúa pausada. No se encontró un módulo de Zoho en `src/`, `supabase/` o `docs/`; no se añadió una integración externa.

## 1. Módulos modificados

- `src/core/delivery.js`: motor compartido, ruta real, piso tarifario, mínimos, pausas, autorizaciones, horarios e históricos.
- `src/delivery/`: preset exclusivo de Sahten; geometría; editor Leaflet; conexión segura del proveedor; servicio, repositorio y cliente; tarjeta compartida web/POS.
- `src/project/schema.js`: preparación idempotente del preset al abrir/guardar el proyecto, conservando zonas y ventas anteriores. No cambia la versión del formato.
- Tienda online y Mostrador: búsqueda explícita de direcciones, barras de avance, invalidación de cotizaciones, validación del servidor antes de confirmar, autorizaciones y separación de retiro/delivery.
- Mercado Pago: valida la misma ruta y horario antes de reservar Checkout Pro. Sus notificaciones siguen procesando compras ya aceptadas aunque el local haya cerrado.
- Pedidos, historial, WhatsApp, comanda, reportes y CSV: conservan y muestran tarifa normal, tarifa cobrada, ahorro comercial, zonas, recorrido y revisión. El ahorro de envío no se duplica como gasto de repartidor.
- `supabase/migrations/20261024_delivery.sql` y función nueva `sahten-delivery`: preparados, **no aplicados**. También se necesita actualizar `sahten-payments`.

## 2. Configuración preparada

El centro coincide con la dirección publicada y con [OSM way 369183696](https://www.openstreetmap.org/way/369183696): **−34.5264314, −58.4818959**, General Julio Argentino Roca 1489, Vicente López. Consulta de geocodificación y verificación del 24/10/2026.

| Zona | Radio comercial | Tarifa | Beneficios de envío | Pedido mínimo neto |
|---|---|---:|---|---:|
| 1 | 0–2 km | $2.190 | Gratis desde $25.000 | $15.000 |
| 2 | >2–3,5 km | $2.990 | Gratis desde $35.000 | $15.000 |
| 3 | >3,5–5 km | $3.990 | $1.990 desde $35.000; gratis desde $50.000 | $15.000 |
| 4 | >5–6,5 km | $5.490 | $2.750 desde $55.000; gratis desde $80.000 | $30.000 |
| 5 | >6,5–8 km | $6.990 | $3.500 desde $80.000; sin envío gratis | $40.000 |
| Excepcional | >8–8,5 km | $9.000 | Autorización administrativa, sin beneficio automático | $15.000 |
| Fuera | >8,5 km | No disponible | No se puede autorizar superando el máximo | — |

Las zonas nuevas y sus promociones quedan **desactivadas inicialmente**. No se modifica el régimen publicado hasta su aprobación y activación. Los mínimos sugeridos de zonas 4/5 están cargados, editables; los demás conservan el mínimo conocido de $15.000.

La consulta de solo lectura del `menu.json` real el 24/10/2026 encontró zonas anteriores con tarifas $1.500/$2.500/$6.000 y umbral global gratuito $60.000. No se presenta $1.990 como tarifa anterior comprobada: esa referencia venía de la propuesta. Tampoco se anuncia públicamente la nueva tabla mientras siga preparada.

El preset solo se incorpora al proyecto identificado como Sahten por su slug o dirección coincidente. Otros negocios conservan su configuración y la app sigue arrancando vacía. El preset contiene datos públicos de ubicación, sin catálogo, clientes, contactos ni credenciales del negocio.

## 3. Dónde editar

**Ajustes → Negocio → Tienda online y delivery → Delivery geográfico e incentivos.** Solo dueño/admin puede modificarlo; el servidor verifica ese rol para claves y autorizaciones.

Se puede seleccionar cualquiera de los seis anillos en el mapa o por nombre; cambiar nombre/color, límites, tarifa, mínimo y beneficios; pausar una zona; exigir autorización; convertir un anillo en un polígono con hueco interior; mover, agregar o quitar vértices; dibujar un contorno nuevo; previsualizar; cancelar; revertir una zona o restablecer geometrías radiales. Las coordenadas también son editables con teclado. Convertir o editar una zona conserva sus tarifas y no cambia las demás.

Las superposiciones y polígonos inválidos bloquean el guardado. Los huecos requieren confirmación y quedan realmente sin cobertura. Restablecer geometrías conserva precios. Cambiar la ubicación exige volver a verificarla. Cada guardado genera una revisión nueva; la configuración viaja en el archivo y en la sincronización/publicación normales, sin claves privadas.

## 4. Cuenta única y controles operativos

1. Identificar una sola zona por su anillo o polígono; una zona pausada o ambigua no se confirma.
2. Consultar una ruta por calles en el servidor, vinculada al origen y destino exactos. El radio nunca se usa como recorrido de respaldo.
3. Aplicar el mayor piso tarifario que exija la ruta respecto de la zona geográfica. Se muestran ambas zonas cuando difieren.
4. Hasta 8 km reales: regular. Más de 8 hasta 8,5: autorización del dueño/admin, con responsable y motivo. Más de 8,5: rechazo incluso con autorización o polígono ampliado. Los máximos se pueden reducir.
5. Una excepción al piso tarifario requiere autorización explícita y registrada; no elimina mínimos, pausas, horario ni máximo operativo.
6. Calcular umbrales sobre **productos después del descuento comercial**, antes de sumar envío. El beneficio de pago del 10 % conserva su regla: solo productos y el mayor descuento de la orden, sin acumulación entre descuentos de productos.
7. Elegir el mejor beneficio de envío alcanzado. La combinación con el descuento por pago es una opción administrativa independiente. Queda preparada en “combinar”, conservando la posibilidad anterior; las promociones nuevas siguen apagadas hasta aprobación.
8. El backend recalcula productos, precios, cantidades, descuentos y envío. El catálogo público sincronizado del proyecto permite validar también productos internos de Mostrador que no se publican en la tienda. Cambios sin sincronizar deben sincronizarse antes de confirmar un delivery; no se acepta un importe local sin comprobar.

No se inventa disponibilidad de la moto, tiempo de entrega ni repartidor asignado. No se agregan horarios de corte anticipado ni pedidos programados.

### Horarios

Se preparó el horario confirmado y publicado, en **America/Argentina/Buenos_Aires**:

- Lunes a jueves: 18:00–22:00.
- Viernes y sábado: 18:00–23:00.
- Domingo: cerrado.

El inicio se incluye y el cierre se excluye: a las 22:00 de un jueves ya no se reciben nuevos deliveries. Web y app muestran el cierre y próxima apertura conocida; el servidor usa su propio reloj antes de aceptar efectivo, transferencia o reservar Mercado Pago. No confía en la hora suministrada por el comprador. La pantalla abierta se actualiza al cruzar el horario; retiro conserva su flujo.

El editor permite hasta cuatro turnos diarios y excepciones por fecha para feriados/cierres. Un turno que cruza medianoche continúa al día siguiente; una fecha especial cerrada interrumpe también esa continuación. Datos de horario inválidos bloquean el delivery. No se completaron feriados desconocidos. El horario de delivery estructurado se usa al publicar la sección de entregas; no reemplaza silenciosamente los horarios generales de atención/SEO del negocio.

### Autorizaciones y cambios de dirección

El cliente puede solicitar revisión de una entrega excepcional con nombre y teléfono. El dueño/admin la ve en **Mostrador → Pedidos**, con recorrido, dirección y motivo. La consulta y autorización vencen a los 15 minutos. El cliente debe volver a consultar el envío; se vuelve a comprobar ruta, revisión, horario y mínimo antes de confirmar.

Al cambiar la dirección se borran ubicación, tarifa, ruta y autorización anteriores. Una respuesta tardía de geocodificación o rutas no repone la dirección anterior. Las búsquedas se realizan mediante botón, no autocompletado contra el geocodificador público.

## 5. Tarjeta web y POS

Componente y fórmula compartidos. La **tarjeta de descuento tiene fondo verde claro, texto oscuro y barra verde**, en web y Mostrador. Los mensajes de restricción/cierre no se presentan como beneficios desbloqueados.

Para zona efectiva 3, subtotal neto $20.000: envío $3.990, faltan $15.000 para pagar $1.990, avance 57 %. A $40.000: envío $1.990, ahorro $2.000, faltan $10.000 para gratis, avance 80 %. A $50.000: gratis y barra completa, sin inventar un próximo objetivo. Zona 5 nunca anuncia envío gratis.

Se recalcula al agregar/quitar productos, elegir pago o cambiar destino. El POS adapta el texto al vendedor. No aparece en retiro. El cobro mantiene su lugar y la columna desplaza los detalles cuando la pantalla es baja. El componente respeta movimiento reducido; las etiquetas y el progreso son accesibles.

## 6. Evidencia y pruebas

Pruebas nuevas de motor, geometría, horarios, servidor, base de datos local, app real en jsdom y plantilla web generada. Incluyen toda la tabla comercial, mínimos, pausas, 8/8,5 km, autorización y roles, precio manipulado, reintentos, catálogo interno, 10 %, cambiar dirección, fallos del proveedor, persistencia de polígonos/horarios e históricos.

`tests/fixtures/delivery/routes-verified-2026-10-24.json` registra nueve destinos públicos, coordenadas, identificadores OSM, URL de consulta, distancia y fecha. Cubre las cinco zonas efectivas, una ruta excepcional de 8,4027 km y otra fuera de cobertura. Plaza Vicente López y Planes y Estación Olivos tienen radio menor de 2 km pero recorrido de 2,34/2,67 km: corresponde la tarifa efectiva 2. La búsqueda que devolvió “Estacion de Bombeo Los Álamos” se conserva con su etiqueta real; no se afirma que sea la estación ferroviaria Acassuso.

Las rutas de verificación son muestras puntuales del demo de OSRM, no una dependencia de producción ni garantía para motos. Los casos de frontera usan fixtures deterministas claramente identificados. Las pruebas PostgreSQL usan PGlite y Vault ficticio, sin conectarse a Supabase real.

Validación final: **582 pruebas en 61 archivos, todas aprobadas** (`npx vitest run`); compilación Vite/PWA, verificación de scripts clásicos y versiones 0.4.21, revisión de diferencias y comprobación Deno de ambas funciones correctas. `npm audit --omit=dev`: cero vulnerabilidades de producción. Deno avisa que ignora la opción heredada `allowJs` en pagos; no es un error de compilación. No se generaron instaladores ni se ejecutó una impresión física en esta tarea.

Chrome real: web a 320 × 640; Mostrador a 1366 × 768 y 1024 × 600, sin desbordamiento horizontal en esas vistas y con total/cobro visibles. Tarjeta con fondo calculado `rgb(237,247,238)` y texto `rgb(24,61,36)`, también en tema oscuro. Las capturas usan una demo local con productos/contacto ficticios y rutas registradas; los escenarios de beneficio desactivan el horario únicamente en esa demo para poder revisarlos de día. La captura de cierre simula todos los días cerrados; el preset real conserva el horario confirmado.

![Beneficio en Mostrador, 1024 × 600](delivery/mostrador-beneficio-verde-1024.png)

![Beneficio en tienda móvil, 320 × 640](delivery/web-beneficio-verde-320.png)

Las otras evidencias locales (1366, oscuro y cierre) están en `entregables/delivery-2026-10-24/` del espacio de trabajo del chat. No se probó una ruta real con openrouteservice ni un checkout productivo: falta la clave y el despliegue autorizado.

## 7. Proveedores, límites y privacidad

- **Leaflet + OpenStreetMap:** mapas y atribución visible. Se conserva el proveedor existente; no se contrata un mapa pago.
- **Nominatim público**, búsqueda explícita mediante servidor: [política oficial](https://operations.osmfoundation.org/policies/nominatim/), límite global de una consulta por segundo, caché breve, identificación de la app y país Argentina. No autocompletado. No usarlo para búsquedas masivas. Una instalación a mayor escala debe cambiar a un proveedor adecuado; el límite se coordina en la base, no solo por instancia.
- **openrouteservice Standard gratuito:** se necesita una clave de la cuenta del negocio, guardada en Vault desde la app. [Cuotas y limitaciones oficiales](https://giscience.github.io/openrouteservice/frequently-asked-questions), referencia Standard Directions de 2.000/día y 40/min; confirmar cuota vigente al crear la cuenta. [Uso comercial explicado por el proveedor](https://ask.openrouteservice.org/t/free-plan-in-an-app-with-a-paid-tier-license-cc-by-sa-4-0-personal-data-and-attribution-questions/8079). No se contrató un plan ni se creó una cuenta. El sitio del proveedor indicó mantenimiento al revisarlo; su documentación y portal de cuenta siguen siendo las referencias.
- Directions usa perfil `driving-car`, evita ferries, limita el punto de ajuste a 100 m y verifica extremos de la ruta. Es una estimación por calles sin tráfico, no un perfil específico de moto ni verificación de accesos privados. Los cambios de OSM pueden tardar en incorporarse.
- La clave solo la consulta el servidor; nunca aparece en `menu.json`, HTML, archivo del proyecto ni respuesta pública. La geocodificación y rutas transmiten la dirección/coordenadas necesarias a esos proveedores. Cachés limitadas; rate limits por tienda y origen. Las solicitudes de autorización pendientes son privadas; vencen a los 15 minutos y se depuran después de 30 días.
- [OSRM demo](https://project-osrm.org/docs/v26.4.0/http/) se consultó solo para muestras de desarrollo. No existe fallback automático al demo ni a una distancia inventada.

## 8. Pendiente antes de activar/publicar

1. Revisar y aprobar la rama/PR, tarifas, mínimos, combinación de beneficios y configuración horaria. Las promociones pueden seguir apagadas.
2. Actualizar/sincronizar primero el historial existente del proyecto, antes de activar la política nueva. Así queda la base histórica que las protecciones preservan.
3. Con autorización: aplicar la migración SQL; desplegar `sahten-delivery` y la actualización de `sahten-payments` **con verificación JWT desactivada en el gateway, como la función pública de pagos**. Ambas validan en el código las acciones que requieren sesión. Probar en un proyecto de ensayo antes del productivo.
4. Crear/consultar la clave Standard de openrouteservice desde su portal; el titular acepta términos/verificaciones. Guardarla desde **Servicio de rutas por calles**. No pegarla en el chat.
5. Verificar rutas reales con esa cuenta y cuotas, expiración de autorizaciones, pagos de prueba, sincronización de ventas POS, importación de órdenes y un cierre real de horario. Ninguna compra de prueba debe cobrar fondos reales.
6. Preparar instaladores actualizados y republicar la carpeta web nueva. Los clientes antiguos no conocen el nuevo protocolo: no activar la política antes de actualizar la tienda y los equipos que operan delivery.
7. Tras esa verificación y autorización, activar la configuración por el dueño/admin, guardar, sincronizar el proyecto y publicar/sincronizar menú. Comprobar que web y app usan la misma revisión. Si también se aprueban promociones, activar su casilla.
8. Verificar la tienda publicada y los reportes con una operación autorizada. No activar producción, cambiar tarifas o publicar desde esta revisión sin aprobación.

Los pedidos históricos conservan los importes originales. Cada nuevo delivery guarda revisión, zonas geográfica/efectiva, radio, recorrido, proveedor, tarifa base/cobrada/ahorro, validación horaria y autorización. Los reportes suman descuentos comerciales de envío por separado de gastos reales de reparto.


## Ruta lista para el repartidor — ampliación del 24/10/2026

En **Mostrador → Pedidos**, cada tarjeta de delivery aceptado ofrece, sin abrir detalles:

- **Copiar ruta** (icono de mapa): copia un enlace universal de Google Maps para pegarlo al repartidor.
- **Abrir en Maps**: abre ese destino directamente, también desde la app de escritorio.
- **Compartir**: abre el selector de aplicaciones del equipo; el usuario elige WhatsApp u otro destino. Si no está disponible, copia el enlace. Si el portapapeles no permite copiar, muestra un campo seleccionado de solo lectura.

En el flujo existente, la aceptación operativa corresponde a **En preparación**; los controles siguen en **Listo para enviar** y **En camino**. No aparecen en pendientes por aceptar, retiro, cancelados o completados. Copiar/compartir no marca enviado ni cambia pagos. La acción vuelve a comprobar el estado actual del pedido.

El enlace usa las coordenadas guardadas como destino y omite un origen fijo para que Maps use el GPS del repartidor. `dir_action=navigate` solicita navegación: según dispositivo, ubicación y permisos, Maps inicia la navegación o muestra su vista previa; puede requerir pulsar “Iniciar”. No se necesita buscar la dirección. Pedidos anteriores sin coordenadas utilizan la dirección escrita, con un aviso para revisar el punto. Si falta todo destino, no se inventa una ubicación ni se ofrece una ruta vacía.

El enlace y el mensaje de compartir no incluyen nombre, teléfono, importes, credenciales ni acceso al pedido. Solo el número identificador y el destino de reparto. La selección del destinatario y el envío los hace el operador; no se envían mensajes automáticamente ni se contrata otro servicio.

[Documentación oficial de Maps URLs](https://developers.google.com/maps/documentation/urls/get-started): enlaces universales sin clave API. Se usa `travelmode=driving`; no se promete un perfil de moto en todos los países. La ruta que elija Google no reemplaza ni recalcula la tarifa/recorrido ya validados para la compra. Este acceso sirve también con delivery anterior y no requiere activar la política v2 ni conectar una API de Google.

Pruebas: coordenadas exactas, dirección antigua codificada, destino ausente, estados permitidos, retiro/cancelación, portapapeles denegado, equipo sin compartir y cancelación voluntaria del selector; prueba con la app real verifica los controles en la tarjeta cerrada y que compartir no cambia el estado. No se envió información de un cliente real ni se contactó a un repartidor.

![Tarjeta de delivery lista para el repartidor, ejemplo ficticio](delivery/tarjeta-ruta-repartidor.png)
