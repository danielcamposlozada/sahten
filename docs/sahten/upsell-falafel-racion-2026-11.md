# SAHTEN | Política de upsell de Croquetas de Falafel (ración, no combo)
**Estado: propuesta técnicamente preparada, económicamente NO aprobada.**
**Implementación:** `src/core/upsell-policy-falafel-racion.js` · **Pruebas:** `tests/upsell-falafel-racion.test.js`.

## Regla de producto
- SKU del catálogo **`falafel`** = **una ración de 6 croquetas**, precio público de lista actual ARS 11.800. Al aceptar qty=1 se agrega **una ración**, NO una croqueta.
- **NO promocionar `falafel_mix`** (3 croquetas + otros componentes) como reemplazo, ni alterar su precio/cantidad.
- Una ración de seis se ofrece como agregado opcional para platos salados elegibles; evitar ofrecimiento cuando el pedido ya incluya falafel, Falafel Mix o sándwich de falafel.
- Nunca ofrecer una segunda línea de upsell con descuento en el mismo pedido.
- Usar el mismo flujo de la **Fatay individual**: preflight Edge, firma HMAC, validación de costos incremental+carrito, nonce y confirmación explícita. No agregar automáticamente al carrito.

## Escala comercial propuesta (porcentaje TOTAL, incluido beneficio general)
| Neto de platos disparadores elegibles, sin envío ni upsell | Descuento total máximo | Precio teórico de ración de $11.800 |
| --- | ---: | ---: |
| Desde ARS 20.000 | 20 % | ARS 9.440 |
| Desde ARS 35.000 | 25 % | ARS 8.850 |
| Desde ARS 50.000 | 30 % | ARS 8.260 |

Valores de referencia antes de verificación HMAC y costos. No usar ni mostrar como oferta real si no hay preflight firmado. La política se guarda **enabled:false** hasta aprobar la auditoría. Los umbrales, porcentajes y la condición de carrito replican `fatay-individual-up`; no son puntos porcentuales adicionales al 10 % habitual.

## Hallazgos que bloquean activación
1. `pricingPolicies.mostrador.variableCost` de `falafel` está **NULL**; `receta_cost` no es costo incremental verificado por ración. Receta base, tahini (subproducto), envases y aceite/fritura deben conciliarse. `pricingPolicies.mostrador.fixedCost` existe, pero asignación fija no equivale a mano de obra marginal.
2. Costos de envases y adicionales por pedido deben tener fuente de compra y revisión (`verifiedOrderCosts` aún ausente). No sustituir faltantes con cero.
3. La comisión final efectiva de Mercado Pago debe confirmarse por medio/plazo (`checkoutProFeePercent` aún NULL).
4. Toda oferta requiere margen de contribución >= 40 % para **unidad incremental y cesta completa** tras comisión, empaque, merma y subsidio de envío.
5. Registrar `reviewedBy`, `reviewedAt`, costo adicional incremental, auditoría de la receta y aprobación expresa. Los importes financieros de las facturas y costos privados NO se almacenan en este repositorio público.
6. Checkout Pro APRO/OTHE real en vendedor/comprador ficticio sigue sin confirmación: el navegador automatizado encontró pantalla de acceso/verificación de Mercado Libre y la API directa rechazó el cargo 401. Los webhooks simulados pasan pero no sustituyen las compras.

**No se despliegan cambios de este documento.** Proyecto productivo, menús y descuentos conservan configuración anterior.
