# Precio y costos por producto y canal (preparado, sin publicar)

Desde el detalle «?» del precio se abre el cálculo y el botón **Ajustar precio y bloquear costos por canal**. La etiqueta **Precio fijado** abre directamente el editor. Seleccioná el canal antes de editar; los cambios de varios canales se guardan juntos.

Cada concepto tiene importe/campo numérico, slider y botón **Automático / Bloqueado**:

- Precio: importe final exacto, sin redondeo extra, recargos ni descuentos automáticos del producto/canal. Los descuentos que se agreguen explícitamente al pedido siguen siendo un concepto separado.
- Costo variable: importe por unidad; incluye receta, envases y subrecetas. No modifica los precios de los ingredientes ni el rendimiento real de la receta.
- GF asignado: importe por unidad, independiente del total de gastos mensuales registrados.
- Comisión: porcentaje estimado del canal. No cambia las comisiones efectivas que cobre un proveedor ni acredita un pago.

En automático, cada canal usa su cálculo con los costos actuales. Fijar el precio de Mostrador no fija los otros canales. Desbloquear conserva la revisión anterior y vuelve a la fórmula automática. Guardar registra canal, fecha UTC, rol, motivo opcional, valores previos y nuevos. No ofrece retroactividad.

## Consistencia e historial

El núcleo común calcula precios, costos por canal, ingresos netos, proyecciones y estrategia. Los escenarios respetan los bloqueos. La proyección pondera los costos variables y aportes asignados a GF por canal; para el resultado operativo resta el GF mensual una sola vez.

Las órdenes locales nuevas guardan su desglose en `costs.saleCosts`, privado. No se adjuntan costos al pedido operativo compartido. Cada versión de catálogo/caja recibe solo `priceRevision` / `quoteIds`, identificadores opacos; sus importes viven en `costs.pricingQuotes`. Así, un pedido que llega después puede referir a la versión que usó al comprar. La revisión debe corresponder al mismo producto, canal y precio; no se inventa un registro si falta o no coincide. Los archivos `.sahten`, copias y sincronización completa conservan ambos registros privados. No se descartan al cambiar el precio ni al cancelar un pedido.

Las cajas sin costos reciben precio calculado, indicadores de precio fijado e identificadores de revisión. No reciben políticas, historial, desglose ni archivo privado de versiones. El catálogo web no muestra etiquetas ni costos.

Reportes → Sahten agrega **Costos históricos**, con cobertura de órdenes, costos variables, comisión estimada, aporte antes de GF y resto después del GF asignado. Se excluyen cancelados y registros sin desglose. No incluye costos del envío ni datos de Fudo. La exportación de órdenes agrega costos/revisión para roles con acceso.

Los costos asignados históricos no representan facturas de compra, comisiones liquidadas ni gastos mensuales reales. No se usan para reemplazar esos registros. Seleccionar un medio de pago no verifica el cobro.

## Instalación y límites

Requiere una nueva versión de la app en dueño y cajas. Para pedidos web, regenerar/subir la tienda con el nuevo campo de revisión y sincronizar el catálogo; para Checkout Pro, actualizar también la función `sahten-payments` que valida el catálogo. **Nada de eso se desplegó en este cambio.**

Guardar y sincronizar el proyecto privado conserva el archivo de versiones entre equipos. Hasta recibirlo, otro equipo del dueño puede mostrar una orden sin desglose; no debe reconstruirla con costos actuales. Un catálogo antiguo sin revisión sigue recibiendo pedidos pero no permite recuperar costos históricos confiables. Las ventas anteriores sin registro se identifican como **Sin desglose histórico**.

No es un libro contable certificado ni un registro inmutable ante edición manual del archivo del dueño. Es historial operativo de valores aplicados, conservado por la aplicación.

El detalle interno de cada orden también permite desplegar **Costos guardados de esta orden**, con la revisión y valores aplicados. La comisión sigue identificada como estimada. Un precio manual no atribuye ganancia al factor de tier; los márgenes generales se calculan desde el precio efectivo.

## Lectura del editor
El precio final ocupa la primera tarjeta y usa un importe grande. El candado abierto con «Automático» usa las reglas vigentes; «Fijar precio para editar» conserva un importe manual. «Volver a automático» vuelve al cálculo. Los costos aparecen en tarjetas secundarias con el mismo patrón.

El pie muestra en todo momento el precio y el resto por unidad. Con precio automático, cambiar costos actualiza el precio; con precio fijado, cambia el resto, no el precio. La comisión estimada reduce el ingreso recibido, no aumenta por sí sola el precio. El desglose muestra cada resta y los valores se aplican después de guardar.
