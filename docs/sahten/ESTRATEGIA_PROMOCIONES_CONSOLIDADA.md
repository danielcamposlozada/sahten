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

## 4. Postre y venta cruzada

| Acción | Disparo | Beneficio | Validación |
| --- | --- | --- | --- |
| Sumá una Baklava | Carrito con producto principal elegible, máximo 1; no duplicar Tabla para Celebrar | +10 pp sobre Baklava (hasta 20% total con efectivo/transferencia) | **En pausa**: $7.350 lista, $5.880 con 20%, costo registrado $3.536,19, margen ~39,86% **antes de comisiones**; hoy no cumple 40% objetivo |
| Sumá hummus | Platos/sándwiches elegibles | **Sin extra**; solo beneficio habitual del método de pago | Solo sugerencia, no promoción de precio |
| Mamul de nuez o dátil | Después de elegir plato | **Sin extra**; solo beneficio habitual | Solo sugerencia, no promoción de precio |
| Avance al envío bonificado | Delivery con zona válida | Barra sobre subtotal **NETO** tras descuentos, con umbral real de la zona | No regalar flete fuera de política |
| Aristilos/Torta | — | Sin descuento dentro del piloto | Reservados para evaluar después |

El 20% de Baklava sigue **como concepto acordado**, pero no debe activarse sin ajustar costo/precio, tope o aprobación de excepción financiera. No ofrecer descuentos falsos ni en productos sin costo completo.

## 5. Cupones web, todavía sin emisión
- **Ticket de cliente / primera compra web:** incentivo de +5 pp, compra elegible desde **$30.000**, **14 días**, una vez por identidad. El QR de ticket y la bienvenida web representan **el mismo beneficio**, nunca dos códigos acumulables. Solo se emite de acuerdo con una compra/orden de origen confirmada. El cupón no existe operativamente hasta terminar backend.
- **Segunda compra web:** +10 pp hasta extra **$4.000**, mínimo elegible **$40.000**, **14 días**, una vez, después de la primera orden web **pagada/completada**; no contar órdenes pendientes/canceladas ni compras presenciales como primera web. Sin acumulación con otra campaña sobre el mismo producto.
- Códigos aleatorios no predecibles, identidad y expiración en servidor Buenos Aires (23:59); reservar, capturar, revertir y reintentar de forma atómica; reimpresión no duplica cupón.

## 6. Fuera del alcance de descuentos actuales
- Fatay **individual** a 15%: $5.850 de lista, costo registrado ~$3.580,54, ingreso $4.972,50, margen ~28% previo a comisiones, inferior al piso de 35%: **excluida**.
- `Shawarma Mixto` 20% de forma masiva, `Shawarma SUPERMIX` con costo incompleto, productos ocultos: **excluidos**.
- Regalo de Fatay para compra futura, premio por azar del 25%, 25% + envío libre y esquema de puntos/fidelidad: **no lanzados**, requieren nueva evaluación legal/financiera y/o fase posterior.
- No habilitar una página `/promociones` inventada ni Terra.

## 7. Regla de publicación y control individual
- Distinguir **configuración local/borrador** del **estado real de servidor**, con acciones por oferta confirmadas (pausar/reactivar una por una, nunca un falso estado confirmado sin internet).
- Una publicación del menú antiguo no debe reactivar ofertas pausadas. Todos los carritos abiertos deben recotizar si cambia elegibilidad; servidor rechaza totales obsoletos antes de confirmar.
- **Próximos bloqueos técnicos:** PR #49: costos verificados + comisiones MP, SQL y funciones de promociones, actualización independiente de campañas/upsells, checkout/facturación/impresión y seguridad de cupones; pruebas E2E y despliegue conservando 28 SKU/fotos. Hasta entonces, `enabled:false` en todos los nuevos beneficios.
