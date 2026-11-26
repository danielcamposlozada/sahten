# Upselling visual en Mostrador — análisis y plan

## Qué existía
| Sistema | Dónde | Qué hace | ¿Mueve dinero? |
|---|---|---|---|
| **Recomendaciones del carrito** (`src/core/cart-recommendations.js`) | Web | Hasta 1 bebida + 1 acompañamiento según lo que hay en el carrito. Reglas editables, pausables y auditadas en vivo desde Promociones › Recomendaciones (`set_store_cart_recommendations`). | No: precio normal. |
| **Complementos con descuento** (`src/online/storefront-upsells.js`, `src/promotions/upsell-checkout.js`) | Web, solo retiro + efectivo/transferencia | Oferta de un solo uso firmada por el servidor (HMAC + nonce), con revisión de costos. | Sí: descuento validado en Edge. |

Mostrador no mostraba ninguna de las dos.

## Fase 1 — implementada (esta rama)
- El carrito del Mostrador muestra **tarjetas con foto** del producto sugerido, el titular de la regla («¿Sumás una bebida?») y el contexto («Va bien con Shawarma»).
- Botón grande **Agregar · $precio** (≥44 px) y **No, gracias** (oculta esa sugerencia solo en este pedido).
- **Mismas reglas que la web**: con tienda conectada se leen las publicadas (`menus.json → cartRecommendations`, lectura pública, sin sesión de dueño, así funciona también con Vendedor/Caja). Se guarda la última copia para trabajar sin internet. Sin tienda conectada, se usan las del proyecto.
- **Precio normal**: no aplica descuentos ni toca cotización, cupones o envío. Las promociones vigentes se recalculan como con cualquier producto agregado a mano.
- **Medición**: cada pedido guarda `suggestions = { channel, source, shown[], accepted[] }` (solo IDs de producto y titulares; sin datos personales). Base para un reporte de tasa de aceptación.
- Código: `src/ui/pos-upsell.js`, `src/styles/pos-upsell.css`, `_mostRenderUpsell()` en `src/legacy/sahten-mostrador.js`. Tests: `tests/pos-upsell.test.js`.

## Fase 2 — propuesta (requiere autorización)
1. **Reporte de sugerencias** en Reportes: ofrecidas vs. aceptadas por regla y por producto, ingreso incremental y margen (con el costo del producto).
2. **Complementos con descuento en Mostrador**: reutilizar la oferta firmada del servidor. Requiere una acción `pos-upsell` en `sahten-delivery` con la misma validación HMAC/nonce y revisión de costos (ver PR #56 y #63, hoy en borrador), y que el cobro se confirme con la recotización del servidor. No se habilita sin publicación ni revisión de costos.
3. **Pantalla del cliente** (segundo monitor o tablet hacia el cliente) con la misma sugerencia: el cajero la ofrece y el cliente la ve.

## Fase 3 — ideas a validar
- Sugerir **reglas nuevas** al dueño a partir de productos que se compran juntos en el historial local (solo como propuesta en el editor; nunca se ofrecen solas sin aprobación).
- Rotar sugerencias por franja horaria o día (platos individuales lunes a miércoles, según la guía comercial).

## Reglas comerciales respetadas
- Nada se ofrece si la regla está pausada o el producto está pausado/retirado.
- No se repite un producto que ya está en el pedido; si ya hay bebida, no se ofrece otra.
- No se ofrecen complementos en el ticket impreso (solo pantalla), como pide la guía de promociones.
