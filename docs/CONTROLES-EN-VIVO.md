# Controles en vivo y publicación

Revisión del código al 28/10/2026. No presupone que un cambio preparado ya esté desplegado.

## Decisión operativa

El dueño pidió quitar la autorización de Zona 1 y enviar automáticamente los cambios de estado sin publicar el catálogo completo. Se preparan **Zona habilitada** y **Requiere autorización** como controles inmediatos, solo para dueño/admin y por negocio. No publican importes, geometrías, horarios ni el borrador completo.

Se cambia el interruptor, se guarda en el proyecto y se envía solo su booleano a la tienda conectada. El estado indica pendiente, enviando, confirmado o error y ofrece reintento. La cola se conserva al cerrar; está separada por proyecto/servidor/tienda y se retoma al iniciar sesión o recuperar conexión. Sin tienda conectada el cambio es local. Una zona nueva necesita una primera publicación antes de usar estos controles.

La web abierta consulta cada 10 segundos y al volver a la pestaña. Actualiza solo los estados de la misma revisión y conserva los precios, las tarifas y los datos del carrito; el servidor vuelve a comprobar al confirmar. Los demás equipos leen los estados cada 30 segundos y al recuperar el foco. Una publicación desde una copia vieja no revierte los estados operativos. No cambia ventas anteriores ni cancela o reembolsa pedidos/pagos existentes.

En Ajustes → Negocio → Delivery, los controles están agrupados como **Controles en vivo**. Se aplican al cambiarlos; **Cancelar cambios** solo descarta el borrador de tarifas/geometrías/horarios, no una operación ya realizada. Quitar autorización de una zona no desactiva horarios, mínimos, cobertura ni la autorización por recorrido excepcional.

## Auditoría de interruptores de la aplicación

| Control / sección | Comportamiento actual o preparado | Decisión recomendada |
|---|---|---|
| Productos: pausa de ventas y reactivación (hoy, fecha o manual) | Ya en vivo: web y Mostrador; servidor valida; cola persistente | Mantener |
| Tienda online: visibilidad individual / mostrar u ocultar todos | Ya en vivo, solo inclusión de productos publicados, sin arrastrar precios | Mantener; recetas internas no son productos publicables |
| Delivery: apertura general | Ya en vivo, sin modificar horarios ni tarifas | Mantener |
| Delivery: zona habilitada | **Disponible en 0.4.30**: envío aislado, web/Mostrador y validación existente del servidor | En vivo |
| Delivery: requiere autorización por zona | **Disponible en 0.4.30**: envío aislado y persistente | En vivo |
| Tienda: Menú activo / recepción de compras | Hoy local hasta publicar catálogo | Próximo control prioritario en vivo: separar pausa de compras de visibilidad del menú; retirar/entregar son operaciones distintas |
| Tienda: categoría visible | Hoy local hasta publicar catálogo | Próxima operación en vivo por categoría; debe preservar la visibilidad individual de cada producto al reactivar, no convertirla en Mostrar todos |
| Pagos: disponibilidad de efectivo, transferencia, tarjeta | Hoy local hasta publicar catálogo | Próximo control en vivo, con recotización del total cuando cambia la elegibilidad del descuento y aviso al comprador; no basta ocultar un botón |
| Mercado Pago: Deshabilitar nuevos cobros | Ya llama al servidor directamente | Mantener, conservar cobros iniciados; la página abierta puede requerir refrescar su configuración para ocultar el acceso |
| Mercado Pago: credenciales / pruebas-producción | Guardado seguro explícito contra servidor, distinto del catálogo | Mantener verificación y confirmación; no convertir en un interruptor sin explicación |
| Delivery: activar motor geográfico, horarios, beneficios y acumulación con descuento por pago | Local hasta guardar/publicar catálogo | Guardado y publicación confirmados por impacto en precios o cobertura. Puede evolucionar a publicación específica con vista previa; nunca publicar al modificar a medias |
| Pagos: descuento, porcentaje y canales alcanzados | Local hasta guardar/publicar catálogo; nuevas ventas con historial | Publicación explícita y recotización, preservando historial. No automatizar silenciosamente un cambio económico |
| Productos: habilitar venta de una receta / receta interna / borrador | Cambia catálogo, recetas y referencias; requiere publicar producto nuevo | Mantener la confirmación de alta. Luego usar pausa/visibilidad en vivo |
| Canales de venta, costos, precios fijados y ofertas | Cambian cálculos internos; publicación comercial separada | Mantener cálculo/guardado e historial; confirmar publicación de precios |
| Tienda: mostrar precios / fotos | Local hasta publicar catálogo | Presentación, no urgencia operativa; indicar acción requerida. Ocultar precios hoy bloquea compras: no usar como pausa general |
| Sitio: portada, historia, reseñas, catering, FAQ, footer, sitio completo, página independiente | La tienda independiente mantiene diseño de la carpeta; requiere exportar/subir archivos | Mantener publicación de diseño; actualizar también HTML estático/SEO al cambiar visibilidad pública |
| Stock / inventario | Los movimientos modifican existencias; no equivalen a la pausa comercial del producto | No inferir pausa por un cero sin reglas de reserva, producción y combos. Usar pausa de ventas explícita |
| Impresión automática, papel, calibración; sonido/notificaciones; escala, tema, vistas y columnas | Preferencias locales aplicadas directamente | Mantener en cada equipo; no deben publicar la tienda |
| Usuarios, roles y accesos | Administración autenticada del servidor | Mantener guardado explícito y permisos; nunca tratar como disponibilidad comercial |
| Nube: actualización de proyecto, publicación de catálogo y fotos automáticas | Flujos distintos; fotos automáticas actualmente pueden publicar catálogo completo | Mantener explicación; futuro envío aislado de fotos para no publicar precios pendientes accidentalmente |

## Alcance de esta entrega

Se implementan únicamente los dos controles de zona y la información sobre qué necesita publicación. Las demás recomendaciones de la tabla **no están implementadas por esta entrega**. No se activan beneficios, medios de pago, zonas pausadas ni horarios nuevos. El cambio real solicitado para Sahten es únicamente **Zona 1 → Requiere autorización: desactivado**, aplicado y verificado el 28/10/2026.

## Despliegue necesario una sola vez

1. Aplicar la migración `20261028233706_delivery_zone_operations.sql`: tabla privada, dos RPC autenticados y protección contra copias viejas. No edita datos comerciales al instalarse.
2. Publicar app y plantilla de la web. Las funciones de envíos/pagos existentes ya leen los flags del catálogo en cada validación: no requieren nuevas claves ni habilitar cobros.
3. Desde la app actualizada con sesión dueña, desmarcar Requiere autorización de Zona 1. Esperar confirmación y comprobar una lectura independiente. No hace falta publicar catálogo ni repetir build por cada cambio posterior.
4. Conservar los precios, mínimos, horarios, descuentos, credenciales y demás zonas; comprobar que solo cambió ese estado. Las consultas de verificación no crean pedidos o pagos.

Mientras no se complete este despliegue, 0.4.29 conserva el comportamiento anterior.

## Verificación de la preparación

674 pruebas / 73 archivos aprobados. Compilación, scripts clásicos, versiones y diferencias correctos. PostgreSQL local comprueba autorización por rol/tienda, protección de la tabla privada, allowlist de campos y conservación del resto del catálogo. La prueba de checkout abierto recibe pausa/autorización sin cambiar precios ni perder foco. Chrome a 1024 × 640, sin desborde de documento: se quitó autorización únicamente en el archivo ficticio, sin conectar a Supabase. Captura: `entregables/controles-en-vivo-2026-10-28/controles-zona-1024.png` del espacio de trabajo.

No se aplicó todavía la migración en producción, no se publicó la app/plantilla y no se cambió Zona 1 real. La publicación conjunta también contendría los cambios previos preparados de Mercadería, inventarios y tabla avanzada; requiere revisar/confirmar ese alcance antes de distribuir instaladores.


## Publicación completada — 28/10/2026

App 0.4.30 para Windows/Mac, web y migración publicadas con éxito. Desde la app instalada y sesión dueña se quitó únicamente la autorización de Zona 1; confirmación visible y lectura independiente correctas. El hash del catálogo con ese único booleano restituido en la consulta coincide con el anterior: ningún otro dato comercial cambió. Las descripciones de preparación anteriores son históricas; ya no falta desplegar ni aprobar esta entrega. No se crearon órdenes ni pagos.


## Ampliación del 30/10/2026 — preparada, sin desplegar

Horarios de apertura/retiro y delivery ya se guardan en vivo desde 0.4.32. Esta entrega agrega **Guardar y aplicar en la web** para configuración comercial de delivery: mínimos, tarifas, cobertura, beneficios, activación del motor y combinación del incentivo de envío con descuento por pago. Se envía una instantánea aislada después de validar, nunca cada campo a medio editar. No publica productos, precios del catálogo, medios de pago ni credenciales.

La cola está separada por proyecto/servidor/tienda; conserva cambios sin conexión y usa revisión esperada e identificador de solicitud para evitar duplicados o sobrescrituras entre equipos. Tabla actual e historial privados con RLS, sin lectura directa por clientes; RPC de escritura solo para dueño/admin, con control de pertenencia. Una copia vieja del catálogo conserva las condiciones vivas. Los protectores de horarios y estados de zona siguen independientes.

La plantilla recibe la configuración completa en hasta 10 segundos o al recuperar foco. Invalida ruta/cotización/autorización previa, consulta de nuevo y preserva carrito, precios y formulario; el servidor conserva la última validación al confirmar. Mostrador acepta la revisión comercial del servidor aunque la copia general del proyecto aún no se haya publicado. Una respuesta de ruta anterior no reemplaza la más reciente. Pedidos históricos intactos.

Verificación local: **726 pruebas / 80 archivos**, compilación, scripts clásicos, versiones y diferencias correctos. Incluye PostgreSQL local: permisos de dueño/admin, denegación a cajero/ajeno/anónimo, historial, reintentos, conflicto, validación de importes y protección ante publicación vieja. App real en pruebas: el botón guarda mediante su RPC y no publica catálogo. Checkout abierto: recibe mínimo/tarifa/beneficios nuevos y conserva foco, formulario y precios. No se escribieron datos productivos.

Para activar: aplicar `20261030232047_delivery_configuration_live.sql`, desplegar `sahten-delivery` con el código revisado y publicar app/plantilla una sola vez, con confirmación del dueño. La migración no precarga ni cambia importes existentes. Las notas de comportamiento anteriores de este documento son históricas y se mantienen como registro.
