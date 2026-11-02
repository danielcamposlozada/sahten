# Sahten · Plan de publicación: promociones efectivo/transferencia, tickets y cupones

**Estado:** preparado para revisión, **NO publicado / NO activar campañas**.
**Fecha:** 02/11/2026 (Buenos Aires). 
**Producción:** sahten.online conserva el motor anterior. No desactivar ni cambiar los cobros normales de Mercado Pago.

## Decisiones aprobadas de alcance (no equivalen a aprobación económica)
- Solo `efectivo` y `transferencia` son elegibles para campañas/cupones nuevos de la primera fase.
- El beneficio habitual del **10 %** continúa intacto. Para Fatay individual y ración comercial de 6 croquetas de falafel, los escalones **20/25/30 % son el DESCUENTO TOTAL de esa línea**, no puntos adicionales.
- Agregado `fatay`: una unidad. Agregado `falafel`: `qty:1` corresponde a **una ración de seis**, nunca a `falafel_mix` de tres. Ambos deben ser explícitamente aceptados por el cliente.
- Como máximo **un upsell con descuento por carrito**; sin stacking con otra promoción sobre el mismo SKU.
- La comisión de MP no se inventa: MP **NO PARTICIPA** de esta etapa. Su flujo productivo normal queda igual.

## Fase A · integrar con promociones desactivadas
- [x] Código de cotización/checkout HMAC en PR #63, con suites de regresión.
- [x] Bloqueo de método promocional: `activationPolicy.allowedPromotionPaymentMethods` se evalúa en `quotePromotions`.
- [x] Emisión de cupón cerrada si programa OFF, costos de orden sin revisión o métodos no aprobados.
- [x] Nuevas pruebas de cash/transferencia y emisión de cupones.
- [x] Corrección del costo de la ración de falafel: salsa y envase por venta y no divididos por lote.
- [ ] Resolver conflictos PR #63 respecto a `main` (post PR #64). No fusionar rama en conflicto.
- [ ] Validar circuito completo a través de Edge contra Supabase de pruebas, no únicamente simulaciones.
- [ ] Aplicar migraciones privadas necesarias con revisión previa y habilitar Edge solo con flags OFF.
- [ ] Verificar el despliegue web y el histórico de pedidos sin alterar importes retroactivamente.

**Configuración inicial OBLIGATORIA al publicar:** `promotions.enabled=false`, `promotions.ticket.enabled=false`,
`upsells[*].enabled=false`, `couponPrograms[*].enabled=false`,
`activationPolicy.allowedPromotionPaymentMethods=['efectivo','transferencia']`.
Nunca habilitar la emisión por la mera existencia de funciones SQL o claves.

## Fase B · tickets 58/80
- El PR #61 contiene franja negra, titular dominante, código recuadrado, total contable separado.
- Los HTML de muestra fueron corregidos: **Fatay 25 % TOTAL**, beneficio habitual 10 % más **15 puntos adicionales** en la línea Fatay, no 20/30 puntos. Ejemplo de tres Árabe Clásico netos = $49.275, que activa tramo de $35.000 pero **no** de $50.000.
- [ ] Ensayo físico en impresora 58 mm (48 mm imprimibles), escala 100 %, sin recortes ni números partidos.
- [ ] Ensayo físico 80 mm (72 mm imprimibles), contraste y longitud máxima de código.
- [ ] Verificar corte automático, reimpresión inmutable, formato monocromo y Google Reviews antes del anuncio.
- [ ] Sin código de cupón real emitido → no incluir cupón/QR, sin placeholder ni código inventado.

## Fase C · auditoría financiera (documentación privada, NO subir cifras de costos al repo público)
- Se exige margen **40 % incremental** del agregado y **40 % de la cesta completa** tras beneficios, GF pertinente, extras de pedido y subsidios de envío.
- El costo histórico asignado a una unidad nueva no equivale al costo marginal: usar ambos indicadores por separado.
- [ ] Revisar horas de producción, mermas, embalajes incrementales y energía (sin duplicar packaging/tahini ya imputados).
- [ ] Certificar costo de SUPERMIX y demás productos disparadores, y todos los SKUs de cesta.
- [ ] Verificar costo de cuatro bebidas con proveedor pendiente antes de cualquier rebaja sobre ellas.
- [ ] Registrar responsable, fecha, método de revisión y costo autorizado en `incrementalCostOverrides` y `verifiedOrderCosts`.
- [ ] Excluir cualquier pedido sin costos fiables: **fail closed**.
- [ ] Aprobar una cesta piloto sin subsidio delivery ni cupón apilado antes de ampliar.

## Fase D · cupones
- Bienvenida web: propuesta 5 % adicional, mínimo $30.000, 14 días. **Programa OFF**.
- Segunda web: propuesta 10 % adicional, máximo $4.000, mínimo $40.000, 14 días; requiere compra previa efectivamente confirmada. **Programa OFF**.
- [ ] Validar emisión, reserva, canje, liberación tras error, idempotencia, expiración y atribución.
- [ ] Probar ticket con código emitido en entorno de prueba; reimpresión sin reemitir ni consumir de nuevo.
- [ ] No declarar una promoción real en ningún anuncio si todavía no está disponible.

## Fase E · activación reversible
1. Desplegar código, migraciones y plantillas con **todo en OFF**; confirmar catálogo/órdenes/pagos intactos.
2. Validar caja y checkout con un pedido de efectivo o transferencia controlado en entorno de prueba, incluidos ticket y contabilidad.
3. Aprobar costos de cesta real y margen incremental; habilitar solo una campaña por vez con límites de exposición.
4. Auditar primer pedido promocionado, descuento total, margen, registro y ticket. Revisar por día.
5. Si falla margen, autenticidad, precio o impresión: **apagar campaign flag**, detener emisión y reimprimir solo instantáneas válidas; no alterar pedidos ya cobrados.

## Riesgos abiertos
- PR #63 requiere sincronización con main.
- Prueba física térmica pendiente; las vistas digitales no sustituyen impresora.
- Costos adicionales y aprobaciones siguen ausentes en la base; no publicar beneficios reales.
- No se incluyen pruebas externas de pagos APRO/OTHE en este alcance; no modificar transacciones ordinarias de MP.
- La documentación financiera detallada pertenece a un Excel **privado**, no al repositorio público.
