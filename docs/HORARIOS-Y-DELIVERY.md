# Horarios y delivery

1. Actualizá Sahten a 0.4.32 y abrí el proyecto correcto con la tienda conectada.
2. Entrá a Ajustes → Negocio → Horarios y delivery.
3. En Apertura y retiro en local, cargá los turnos en que se aceptan retiros desde la web. En Horario de delivery, cargá solamente las entregas. Un día sin turnos está cerrado.
4. Agregá fechas especiales para feriados; una fecha sin turnos cierra ese día. Un turno que termina antes de empezar continúa al día siguiente.
5. Pulsá Guardar horario y aplicar en web en el calendario editado. Esperá Horario confirmado en la web. No hace falta publicar catálogo ni subir archivos.

Si falta conexión, queda pendiente y se reintenta. Si otro equipo guardó antes, revisá y usá el horario de la web antes de editarlo otra vez. Pausar delivery es un control separado y no cambia turnos ni retiro. No se aceptan pedidos programados para más tarde. Mostrador advierte fuera de apertura, pero permite cobrar; las entregas siguen respetando el calendario de delivery.

Los clientes con la página abierta reciben los cambios en hasta 10 segundos o al volver a la pestaña; el servidor valida al confirmar. Un pago de Mercado Pago ya iniciado puede completarse después del cierre. No se cancelan ni reembolsan pedidos existentes.

## Horario confirmado de Sahten

- Lunes a jueves: apertura/retiro 12:00–15:30 y 18:00–22:00; delivery 18:00–22:00.
- Viernes y sábado: apertura/retiro 12:00–15:30 y 18:00–23:00; delivery 18:00–22:00.
- Domingo: cerrado. Zona horaria de Argentina.

El dueño corrigió expresamente a las 12:00 la apertura de las 11:00 que aparecía en Google Maps. No se editó la ficha de Google.


## Mínimos, tarifas y beneficios al guardar — preparado, sin publicar

La siguiente actualización amplía el guardado en vivo a las condiciones comerciales de delivery. Después de actualizar app, plantilla y servidor una sola vez:

1. Abrí **Ajustes → Negocio → Horarios y delivery** con tu cuenta dueña o administradora y el proyecto de la tienda correcto.
2. En **Delivery geográfico e incentivos**, elegí la zona y ajustá mínimo de compra, tarifa, beneficios o cobertura. Podés previsualizar antes de guardar. Editar un campo todavía no cambia la web.
3. Pulsá **Guardar y aplicar en la web** y esperá **Configuración confirmada en la web**. No hace falta Publicar catálogo, exportar ni subir una carpeta a Cloudflare. El modo clásico también dispone de este botón.
4. Si queda pendiente, revisá la conexión o pulsá Reintentar. Si otro equipo guardó una versión distinta, usá **Usar configuración de la web**, revisá y repetí el ajuste. No se sobrescribe silenciosamente la otra versión.

Los calendarios de apertura/retiro y delivery conservan sus botones propios de guardado; habilitar/pausar delivery y los estados de zona siguen aplicándose con sus interruptores. La conexión de rutas guarda su clave por el mecanismo seguro existente. El descuento por medio de pago se configura en Pagos y conserva su publicación separada; «Combinar beneficio de envío» solo define la combinación de ese descuento con el envío.

La página alojada en Cloudflare consulta la configuración de Supabase; no se reconstruye ni se sube un archivo por cada ajuste. Los clientes con un checkout abierto reciben el aviso **Condiciones de envío actualizadas** y una nueva validación, conservando los productos, sus precios y los datos escritos. El servidor verifica las condiciones vigentes al confirmar. Los pedidos ya confirmados y pagos iniciados mantienen sus registros; no hay cancelaciones ni reembolsos automáticos. El HTML estático de respaldo/SEO continúa renovándose al exportar: este cambio resuelve las condiciones operativas del pedido.

**Estado:** código y migración preparados, 726 pruebas aprobadas; todavía no desplegado. No se cambió ningún mínimo, tarifa, beneficio ni horario real durante esta preparación.


Corrección confirmada por el dueño el 30/10/2026: delivery cierra a las **22:00 todos los días habilitados** (lunes a sábado); domingo permanece cerrado. Apertura/retiro conserva 23:00 viernes y sábado. También confirmó mínimos de **$15.000 en Zona 1 y Zona 2**, manteniendo tarifas, beneficios y demás zonas. Elegida tipografía 3 tanto en home como en carta; su implementación visual sigue separada de esta actualización operativa. Publicación 0.4.33 en curso.
