# Vistas demostrativas del motor real de tickets

Generadas con `buildReceipt` sobre datos sintéticos y el código de esta rama.

- `58mm-campaign-demo.html`: anuncio neutral de novedades, sin fecha ni descuento futuro prometido, ancho imprimible 48 mm.
- `80mm-coupon-demo.html`: cupón **no canjeable** ilustrativo, ancho imprimible 72 mm.

El pedido **SIMULADO** demuestra beneficio habitual del 10 % por pago y Fatay individual al **25 % TOTAL** (no +25 puntos): subtotal $60.600, beneficio habitual $6.060, extra Fatay $877,50 y total $53.662,50. Los platos disparadores netos suman $49.275, por lo que **NO** corresponde el tramo del 30 %. Todos los ejemplos dicen MUESTRA - NO VÁLIDO. **Estos ejemplos no representan una compra real, una promoción activa, ni autorizan lanzamiento**. No hay QR de canje porque no existe cupón emitido de verdad.

El HTML se abre localmente en el navegador y puede imprimirse sobre papel térmico configurando escala 100 % y fondos gráficos. La visual no sustituye una prueba con la impresora real.

## Regla final de comunicación (02/11/2026)

1. **Beneficio aplicado ≠ publicidad**: todo descuento ya cobrado figura como línea normal del desglose contable, sin borde lateral, sin bloque negro ni título grande. No se promociona por segunda vez en el ticket.
2. **Solo futuro o diferente**: el bloque destacado puede contener una campaña distinta (`campaignId` no utilizado en `promotionSnapshot.appliedPromotionIds`) o un cupón nuevo (ID único y código emitido por backend; nunca el cupón canjeado en esta compra).
3. **Doble control**: `selectTicketAdvertisement` excluye lo utilizado cuando recibe el pedido; `newTicketAdvertisement` lo bloquea en el render aun si el selector no recibió contexto.
4. **Nuevo tamaño**: formato de alto contraste, borde fino, tipografía compacta, aproximadamente 40-50 % menos superficie vertical que la primera propuesta. No afecta tamaño ni legibilidad del subtotal, descuentos, total o identificación de compra.
5. **Pruebas**: validación automatizada del comportamiento en 58/80 mm; falta el chequeo físico del papel/corte de cada impresora.

Las vistas son maquetas y no suponen la existencia de campañas ni cupones habilitados en producción.
