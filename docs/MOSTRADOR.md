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

## Aviso de pedidos publicado en 0.4.17

El dueño eligió darbuka y palmas de 3 segundos, sin campana. La grabación CC0 se incluye dentro del código compilado, sin descargar archivos de otro servidor al llegar un pedido. El primer clic o uso del teclado prepara el audio; si el navegador lo bloquea, el aviso visual sigue funcionando. Los avisos simultáneos comparten la reproducción en curso para evitar superposición o reiniciar el ritmo; las notificaciones visuales conservan su funcionamiento existente.

Se reemplaza la función común de sonido del centro de notificaciones, usada por pedidos y otros avisos existentes. No se agrega una canción ni se cambia el flujo de pedidos. Publicado con autorización del dueño en [Sahten 0.4.17](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.17), para Windows y Mac; canal del actualizador comprobado. Es necesario instalar esta actualización para usar el nuevo aviso.

Verificación: cuatro pruebas específicas de carga, gesto del usuario, avisos simultáneos y recuperación ante errores; suite completa de 484 pruebas en 49 archivos, compilación y scripts clásicos correctos. Chrome reprodujo el archivo incluido completo y decodificó exactamente 3,000 s a 44.100 Hz. No se afirma una prueba física en Windows.

## Verificación de 0.4.16

- Pruebas de altas, cambios y bajas de clientes/medios de pago, con espera de autoguardado y apertura en otra sesión.
- Pruebas de actualización: guardado exitoso antes de instalar; error o cancelación impiden instalar/reiniciar.
- Pruebas de pedido local completo, mezcla con web, estados de entrega, tarjetas desplegables, aviso por visita y categorías.
- Chrome: 1366 × 768, 1366 × 720, 1280 × 720 y 1024 × 600; catálogo y pestañas del mismo ancho, carrito desde arriba, cobro visible y sin desborde horizontal. En 390 × 844, selección Retiro/Delivery y cobro en diálogo con foco controlado.
- Resultado final: `npx vitest run`, 480 pruebas en 48 archivos; compilación y revisión de scripts clásicos correctas.
- Solo datos ficticios. Sin pedidos reales, cambios en Supabase ni despliegue web. La prueba física de la IT01 sigue pendiente para la futura versión instalada.


## Entrega, efectivo e impresión — actualización preparada el 24/10/2026

Web y Mostrador separan dirección, piso, departamento y referencia. Las notas del pedido se conservan aparte. Esos datos se ven al desplegar Pedidos y en el ticket; no se carga más información en la tarjeta plegada. Cambiar la dirección descarta coordenadas/ruta/autorización anteriores y conserva los campos de entrega escritos.

Al elegir Efectivo aparece «Con cuánto paga» opcional y el vuelto. Un importe insuficiente impide confirmar; vacío permite continuar sin inventar el importe entregado. Se calcula después del descuento y del envío. Transferencia/MP no guardan efectivo. Guardar una orden o declarar efectivo no acredita automáticamente el pago. El total comercial y los reportes no suman el monto entregado.

Nueva pestaña **Ajustes → Negocio → Impresión**, con ajustes por equipo y dos opciones para abrir impresión al crear o recibir pedidos nuevos. Desactivadas por defecto; no imprimen el historial al conectar ni cada actualización de estado. Puede aparecer el diálogo del sistema. Ver [IMPRESION.md](IMPRESION.md).

Estas novedades requieren la próxima versión instalada y republicar la plantilla web. Todavía no se publicó ese instalador ni el nuevo formulario de sahten.online. Los pedidos anteriores se conservan; no se agregan retrospectivamente pisos, departamentos o efectivo desconocidos.
