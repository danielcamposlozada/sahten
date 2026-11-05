# Promociones y cupones desde Sahten 0.4.50

## Qué se publica y qué sigue siendo un borrador

La actualización instala los controles. No activa automáticamente un programa de primera o segunda compra ni modifica sus participantes. En **Promociones → Cupones**, consultá primero los programas del servidor. «Guardar borrador» guarda la propuesta; «Revisar y publicar» comprueba los datos y la habilita con las condiciones que confirmes. La web conectada consulta los programas publicados sin subir una carpeta nueva.

## Dar de alta primera o segunda compra

1. En **Promociones → Reglas de rentabilidad**, consultá los valores actuales. Podés definir margen mínimo y descuento total máximo generales, o una excepción por producto. Mercado Pago tiene comisión editable: el 10% inicial es provisional, no tu tasa real ni un gasto contable registrado.
2. En **Cupones**, abrí Primera compra o Segunda compra. Definí nombre, porcentaje TOTAL con efectivo/transferencia, mínimo de productos, tope adicional si lo hay y duración de cada cupón.
3. Dejá el fin del programa vacío para mantenerlo sin fecha final. Cada cupón conserva su vencimiento individual; son cosas distintas.
4. Si querés permitirlo con Mercado Pago, encendé **Habilitar este beneficio con Mercado Pago** y completá sus condiciones. Las decisiones del dueño preparadas son 5% total en primera compra y 10% total en segunda desde $40.000 en productos, sin tope. El envío queda afuera.
5. Elegí **Sugerir productos que cumplen el descuento**. La sugerencia utiliza precios/costos actuales y considera ambos medios habilitados. Revisá la selección. **Precio y costos** abre el producto; **Reglas de rentabilidad** permite revisar el piso o tope. Un costo base desconocido no se reemplaza por cero.
6. Pulsá **Revisar y publicar** y comprobá las condiciones antes de confirmar. Si el servidor rechaza un producto, el formulario conserva lo escrito y muestra el producto a revisar. Corregí sus datos y volvé a publicar.
7. Esperá la confirmación del servidor. La home, la carta informativa y la tienda muestran los programas vigentes y sus condiciones. Una promoción pausada, fuera de fecha o sin publicación no se anuncia como activa.

Los costos adicionales de un complemento pueden quedar pendientes solo mediante la excepción explícita y auditada de su revisión. Esto no autoriza a omitir el costo base de un producto ni a declarar un importe inventado.

## Por qué a veces no entra un 20% o 25%

El control compara el precio después del descuento y de la comisión estimada con el costo registrado y el margen mínimo. Un producto de precio $100 y costo $50 admite hasta 16,66% total con margen mínimo de 40%, antes de comisión; no un 20%. Un costo distinto o una comisión reducen ese espacio. El beneficio habitual por pago ya forma parte del total: 10% habitual + 5 puntos extra = 15% total, no 5% total.

Las reglas se ven en la app y se pueden cambiar con revisión. Bajar un margen o ampliar un máximo es una decisión comercial, no una corrección automática de costos. Las cotizaciones nuevas usan las reglas vigentes y las ventas anteriores conservan su instantánea.

## Cuándo se concede la segunda compra

Solo después de confirmar y cobrar la primera compra web. Mercado Pago requiere acreditación comprobada por el servidor. En efectivo/transferencia, un rol autorizado usa **Confirmar cobro** en la tarjeta o en el detalle del pedido, incluso desde Historial. Verificá el dinero recibido; un comprobante o el estado Entregado/Retirado no sustituyen el cobro.

Se actualiza el pedido existente, sin registrar otra venta. Al imprimir el ticket de cliente se consulta el beneficio emitido: aparece antes del QR de reseñas, con condiciones. No se fabrica un código desde la impresora. Un beneficio vencido, canjeado o invalidado por cancelación/reembolso no se vuelve a anunciar como utilizable.

## El cupón es de Sahten, también cuando se paga con Mercado Pago

Sahten verifica teléfono, participantes, mínimo, reglas y uso disponible. Calcula el descuento sobre productos y envía a Mercado Pago el total final, con envío aparte. El porcentaje con Mercado Pago no se suma al habitual de efectivo/transferencia.

El intento de pago reserva el cupón para impedir su uso simultáneo en otro checkout. Solo la acreditación lo consume. Un error de red o una tarjeta rechazada no lo canjean. Reintentá desde la misma compra/navegador para conservar su prueba de sesión y su cotización.

Si venció una compra con cupón, la pantalla de estado permite **Revisar pago y liberar mi cupón**. Antes de liberar, el servidor comprueba la preferencia y los pagos: si hay fondos acreditados o en proceso, no libera la reserva. No ejecuta reembolsos automáticos. Una contradicción tardía del proveedor conserva la venta y queda marcada para revisión técnica.

## Efectivo o transferencia sin confundir acciones

En la tienda, elegí el grupo de pago directo y luego el selector grande de dos posiciones **Efectivo / Transferencia**. Tiene controles nativos para teclado y estado visible. Mostrador mantiene los medios individuales para que también entren QR, tarjetas y otros medios configurados.

## Verificación y límites

0.4.50 pasó 1.032 pruebas en 144 archivos, compilación y revisión de escritorio/celular. La verificación publicada no creó pedidos ni cobros reales. La prueba física de la plantilla nueva en IT01 continúa pendiente. Las mejoras genéricas de reemplazo de producto no se dan por integradas ni se activan cuando les faltan costos o publicación de los SKU necesarios.
