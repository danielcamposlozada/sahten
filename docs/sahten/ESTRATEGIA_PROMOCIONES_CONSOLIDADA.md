# SAHTEN — Programa de promociones y descuentos (consolidado)

**Revisión:** 1 de noviembre de 2026 · **Origen:** estrategia comercial actualizada + decisiones posteriores del usuario  
**Estado real:** borradores del proyecto `SAHTEN Gastronomia Arabe`, motor desactivado, sin deploy público ni cupones canjeables.  
**Fuente editable estructurada:** [plan-promociones-2026.json](./plan-promociones-2026.json). No incrustar este plan de un negocio específico en instaladores genéricos.

## 1. Regla común y contabilidad
- El **10% ordinario** de efectivo/transferencia se mantiene vigente e independiente.
- Campaña elegible `+5 puntos` significa 15% **total** en esos medios, 5% adicional con Mercado Pago, sujeto a comisión real. No multiplicar descuentos.
- Cupón de segunda compra `+10 puntos`: como máximo 20% **teórico** con 10% habitual y sujeto a tope adicional de $4.000; cuando el tope limita, comunicar el porcentaje **real**, no «20%».
- Solo **un descuento promocional extra por SKU**, eligiendo el mayor beneficio admisible, no campaña + cupón sobre el mismo SKU.
- **Margen objetivo 40%, piso absoluto 35%**. Considerar costos por producto, gasto de venta, comisiones reales e impuestos, packaging, regalos y subsidio de reparto. Con costos faltantes o margen insuficiente no habilitar extra, mantener la política habitual.
- El backend recotiza antes de confirmar. No confiar en totales o descuentos calculados por el navegador; snapshots de pedidos confirmados no cambian retrospectivamente.

## 2. Campañas públicas listas como borrador

| Campaña | Ventana | Productos | Beneficio |
| --- | --- | --- | --- |
| Favoritos de la semana | Lunes, martes y miércoles | Promo Fatay (3U), Promo Compartir Clásico, Sándwich Falafel, Árabe Clásico, Shawarma Pollo | +5 pp |
| Tablas centrales | Segundo y tercer viernes y sábado de cada mes (Nov: 13-14, 20-21) | Tabla para Celebrar y Promo Compartir para Dos | +5 pp |

No incluir `fatay` individual ni `shawarma_mixto` en la campaña pública. `Tabla para Compartir` sin SKU web autorizado queda excluida. No anunciar domingos ni horarios cerrados.

## 3. Fatay con la Cuarta — upselling por reemplazo

**Concepto aprobado; activación bloqueada por costo.** Si el cliente tiene `p1779467294622` (Promo Fatay 3U), proponer cambiar **una línea 3U por una línea `p1779570052552` (4U)**. Nunca se agregan ambos productos como consecuencia de un clic. Requiere confirmación expresa del cliente; la cocina debe imprimir **4 unidades**, no 3+1 ni 7.

- Precio lista referencia 4U **$18.500**. Aplica solo el beneficio ordinario por forma de pago; **sin campaña adicional, cupón ni otros descuentos sobre la línea 4U**.
- Mostrar siempre el **precio y diferencia finales** recalculados por servidor después de cambiar el SKU. Ejemplo si pago en efectivo: 3U con 10% = $15.165, 4U con 10% = $16.650 (**diferencia $1.485**). En día de 15% público la 3U sería $14.322,50 y la 4U sigue a $16.650 (**diferencia $2.327,50**): nunca prometer «la cuarta por $1.650» como precio final universal.
- **Falta costo desglosado/validado del SKU 4U.** El motor bloquea la activación. Calcular margen incremental respecto al combo que sustituye y margen total del nuevo combo, sin contar dos veces costos fijos.

## 4. Upselling de Fatay, Baklava, Mamul y Torta: costos incrementales

**Revisión financiera 1/11/2026:** el plan anterior evaluaba cada precio descontado contra el costo directo MÁS todo el gasto fijo asignado por unidad. Sin embargo, la app calcula `gfAssigned` distribuyendo **alquiler, salarios, servicios, impuestos y otros gastos del mes** según las unidades mensuales esperadas y `gfPctOverride`. Esos gastos no se reproducen necesariamente cuando el cliente agrega una porción a una compra ya hecha. El costo variable de `costPerUnit` es distinto y contiene ingredientes, envases y combos calculados.

### Fotografía actual de los cinco productos

| Producto | Lista | Directo unitario | Fijo asignado | Fijo sobre costo completo | Neto con promo propuesta (efectivo/transferencia) | Margen contable con reparto fijo |
|---|---:|---:|---:|---:|---:|---:|
| Fatay individual | $5.850 | $442,12 | $3.138,42 | 87,7% | $4.680 (20% total) | 23,5% |
| Baklava | $7.350 | $1.294,46 | $2.241,73 | 63,4% | $5.880 (20% total) | 39,9% |
| Mamul de Nuez | $7.000 | $518,09 | $3.138,42 | 85,8% | $5.950 (15% total) | 38,5% |
| Mamul de Dátil | $7.000 | $405,59 | $3.362,59 | 89,2% | $5.950 (15% total) | 36,7% |
| Torta de Chocolate | $8.200 | $1.432,01 | $2.510,74 | 63,7% | $6.970 (15% total) | 43,4% |

**Interpretación correcta:** la Fatay a $4.680 genera $4.237,88 de excedente frente al costo variable anotado ($442,12), *antes de mano de obra marginal, packaging no capturado, comisiones y capacidad de cocina*. Su **margen incremental aparente es 90,6%**, pero el **margen completo imputado es 23,5%**: no son conceptos equivalentes. Ninguno por sí solo sustituye el análisis de rentabilidad de la cesta y el volumen incremental real.

**La decisión actual** es ofrecer los siguientes **borradores de upsell condicionado**, nunca un descuento público para la unidad suelta:
- **Fatay individual** (SKU `fatay`): hasta 1 unidad con +10 puntos promocionales (20% total en efectivo/transferencia). Solo sugerir con comida principal y NO si contiene la Promo Fatay 3U, el combo 4U o Combo Fatay. No se aplica a compras de Fatay aisladas.
- **Baklava** (SKU `baklava`): máximo 1 unidad, +10 puntos (20% total), sujeto a margen del pedido; el margen completo propio ~39,9% previo a comisiones no basta para declararla aprobada sin esa validación.
- **Mamul Nuez/Dátil**: cada uno máximo 1, +5 puntos (15% total); evitar descuentos simultáneos en ambos. Calcular margen completo del pedido, no exigir arbitrariamente que cada porción recupere sola alquiler y nómina.
- **Torta de Chocolate**: máximo 1 porción, +5 puntos (15% total); rentabilidad completa propia estimada ~43,4% antes de comisiones. Revisar envase/conservación/frío.
- **Una sola línea de upsell con descuento por pedido y máximo 2 sugerencias visibles**: preferir una opción salada y otra dulce; no saturar el carrito. Ningún descuento se concede mientras falte el guard del servidor.

### Otros productos del catálogo revisados
- **Hummus**: variable $593,57 vs $4.662,80 fijos distribuidos (**88,7%** del costo completo). Buen complemento al precio habitual; **no** lo rebajamos automáticamente.
- **Falafel Mix**: variable $867,48 vs $3.721,27 fijos (**81,1%** del costo completo); buen candidato de venta cruzada sin extra de lanzamiento.
- **Aristilos (porción)**: variable $986,67 vs $2.241,73 fijos (**69,4%**). A un 20% total mantiene ~48,3% de margen completo antes de comisiones, posible candidato futuro, pero inicialmente mostrar como sugerencia sin descuento.
- **Productos sin costo variable completo** (bebidas, Croquetas de Falafel, tahini, Papas Fritas, SUPERMIX, combo 4U): no otorgar descuento nuevo hasta verificar costo de reposición y presentación.

### Control económico que falta implementar
La app debe mostrar **dos análisis complementarios**: (1) contribución incremental del add-on (ingreso realmente adicional − ingredientes/envases − personal adicional/capacidad/medios de pago − beneficios logísticos adicionales) y (2) margen después de costos y gastos del **pedido completo**; objetivo 40%, mínimo absoluto 35% con costos consistentes. Además, comprobar la **rentabilidad mensual y el impacto en ventas que ya se iban a producir**. No reimputar automáticamente el alquiler completo como si naciera un gasto nuevo por cada Fatay, pero tampoco ignorar el alquiler en la evaluación del negocio.

La regla actual `quotePromotions` aplica margen de cada SKU con `trustedCosts` y aún **NO** aplica este guard incremental más cesta. Por eso los cinco upsells permanecen desactivados mientras se implementa y comprueba por backend.

## 4 bis. Venta cruzada y umbrales
- Hummus, Aristilos y Falafel Mix se preparan como sugerencias **sin descuento adicional**.
- La barra de envío gratis refleja el **neto** del carrito después de descuentos y la zona real; nunca subsidia entregas fuera de reglas.
- `Fatay con la Cuarta (4U)` permanece como un **reemplazo** separado del upsell de una Fatay suelta. El costo del combo 4U sigue sin verificarse.

## 5. Cupones web, todavía sin emisión
- **Ticket de cliente / primera compra web:** incentivo de +5 pp, compra elegible desde **$30.000**, **14 días**, una vez por identidad. El QR de ticket y la bienvenida web representan **el mismo beneficio**, nunca dos códigos acumulables. Solo se emite de acuerdo con una compra/orden de origen confirmada. El cupón no existe operativamente hasta terminar backend.
- **Segunda compra web:** +10 pp hasta extra **$4.000**, mínimo elegible **$40.000**, **14 días**, una vez, después de la primera orden web **pagada/completada**; no contar órdenes pendientes/canceladas ni compras presenciales como primera web. Sin acumulación con otra campaña sobre el mismo producto.
- Códigos aleatorios no predecibles, identidad y expiración en servidor Buenos Aires (23:59); reservar, capturar, revertir y reintentar de forma atómica; reimpresión no duplica cupón.

## 6. Fuera del alcance de descuentos actuales
- Fatay **individual como campaña pública general**: excluida; su costo completo imputado deja ~28% a 15% total. **No confundir con la nueva oferta de una Fatay añadida como upsell**, condicionada al guard de contribución incremental + margen del pedido.
- `Shawarma Mixto` 20% de forma masiva, `Shawarma SUPERMIX` con costo incompleto, productos ocultos: **excluidos**.
- Regalo de Fatay para compra futura, premio por azar del 25%, 25% + envío libre y esquema de puntos/fidelidad: **no lanzados**, requieren nueva evaluación legal/financiera y/o fase posterior.
- No habilitar una página `/promociones` inventada ni Terra.

## 7. Regla de publicación y control individual
- Distinguir **configuración local/borrador** del **estado real de servidor**, con acciones por oferta confirmadas (pausar/reactivar una por una, nunca un falso estado confirmado sin internet).
- Una publicación del menú antiguo no debe reactivar ofertas pausadas. Todos los carritos abiertos deben recotizar si cambia elegibilidad; servidor rechaza totales obsoletos antes de confirmar.
- **Próximos bloqueos técnicos:** PR #49: costos verificados + comisiones MP, SQL y funciones de promociones, actualización independiente de campañas/upsells, checkout/facturación/impresión y seguridad de cupones; pruebas E2E y despliegue conservando 28 SKU/fotos. Hasta entonces, `enabled:false` en todos los nuevos beneficios.
