# Mostrador y pedidos — cambios preparados el 23/10/2026

Estado: Sahten 0.4.16 publicada el 23/10/2026 para Windows y Mac, con autorización del dueño. PR #16 integrado mediante merge normal. Instaladores y canal de actualización verificados; queda la prueba física de IT01 después de instalar. Publicación: https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.16.

## Espacio de trabajo

En escritorio, el pedido ocupa toda la altura disponible debajo de la barra de la aplicación. Comienza a la misma altura que el aviso de prueba. Las pestañas se limitan al ancho del catálogo en Nuevo pedido; catálogo y pedido tienen desplazamiento independiente y el botón de cobro queda fijo abajo.

El aviso se oculta con la X durante la visita. Vuelve al salir y regresar a Mostrador o al abrir la aplicación. Los niveles de precio ya no se muestran como filtros; se conservan los tiers y las categorías reales de productos.

## Cola operativa

«Pedidos» reúne pedidos locales y de la web. Crear un pedido en mostrador abre esa cola, sin sacar el registro de Historial.

- Retiro en local / Mostrador: Pendiente → En preparación → Listo para retirar → Retirado.
- Delivery: Pendiente → En preparación → Listo para enviar → En camino → Entregado.
- Cancelados, retirados y entregados dejan la cola activa. Los finalizados recientemente se muestran durante 30 minutos; todos siguen en Historial.

La tarjeta plegada muestra número, origen, estado, cliente, cantidad, antigüedad y total. El detalle despliega productos, hora, dirección, zona, contacto, indicaciones, medio y estado de pago, envío y acceso a la impresión/pedido completo. El detalle funciona con teclado y conserva su apertura al actualizar la vista. Las alertas de pago importantes permanecen visibles aun plegada.

Borde, etiqueta y botón identifican el estado; el fondo de la tarjeta se mantiene neutro. La siguiente acción siempre se ve. «Actualizar vista» relee los pedidos de esta sesión; la conexión existente mantiene la recepción de pedidos de la web.

No se inventan dirección, teléfono, zona ni tiempos prometidos. Si faltan datos de entrega se indica en el detalle. La antigüedad es tiempo desde la creación, no un plazo comprometido. No se agrega asignación de repartidores ni ETA porque aún no existen en el modelo operativo.

Elegir Efectivo, Transferencia u otro medio no acredita un pago. Se muestra «Cobro sin confirmar» salvo estado de pago verificado; no se activan cobros reales ni se modifica la integración de Mercado Pago.

## Conservación de clientes y medios de pago

Los módulos de Mostrador escribían en el almacén temporal del proyecto sin notificar siempre al guardado automático. Si la persona esperaba después de escribir y recién entonces pulsaba Agregar, el guardado anterior podía contener la lista vacía. Se corrigió la notificación central: altas, ediciones y eliminaciones activan el guardado, aunque no haya otro cambio pendiente.

Además, el actualizador ignoraba los errores del guardado previo a reiniciar. Ahora detiene la instalación si guardar falla o se cancela. Esto evita perder cambios por una actualización que continúe después de un error.

El autoguardado requiere un archivo .sahten con ubicación elegida y un adaptador compatible (la app de escritorio o File System Access). Un proyecto sin archivo muestra «Sin guardar» y necesita Guardar. La nube es una copia aparte: se sincroniza después del guardado local con la conexión y permisos existentes. No se hicieron escrituras en Supabase para esta revisión ni se recuperaron automáticamente datos ya perdidos.

## Verificación

- Pruebas de altas, cambios y bajas de clientes/medios de pago, con espera de autoguardado y apertura en otra sesión.
- Pruebas de actualización: guardado exitoso antes de instalar; error o cancelación impiden instalar/reiniciar.
- Pruebas de pedido local completo, mezcla con web, estados de entrega, tarjetas desplegables, aviso por visita y categorías.
- Chrome: 1366 × 768, 1366 × 720, 1280 × 720 y 1024 × 600; catálogo y pestañas del mismo ancho, carrito desde arriba, cobro visible y sin desborde horizontal. En 390 × 844, selección Retiro/Delivery y cobro en diálogo con foco controlado.
- Resultado final: `npx vitest run`, 480 pruebas en 48 archivos; compilación y revisión de scripts clásicos correctas.
- Solo datos ficticios. Sin pedidos reales, cambios en Supabase ni despliegue web. La prueba física de la IT01 sigue pendiente para la futura versión instalada.
