# SAHTEN — Motor central de promociones, fases 1–4 y normalización de precios

Estado: **rama de desarrollo / PR borrador**. No equivale a promoción publicada, cobro validado en producción ni migración aplicada.

## Objetivo
Una fuente de reglas comerciales para tienda online y Mostrador; administración editable; comanda única con publicidad; seguimiento histórico de rentabilidad.

## Fase 1 — Motor de evaluación
- `src/core/promotions.js`: fecha de Buenos Aires, campañas semanales y segundos/terceros viernes-sábado, exclusiones de la cuarta Fatay, máximo de una promoción adicional por línea, 10% permanente para efectivo/transferencia, cupones con vencimiento DD/MM/AAAA y topes.
- El premio por cupón compite con la campaña pública. Cuando agota su tope, vuelve a considerarse la campaña pública elegible.
- Guardar el resultado desglosado por línea en `promotionSnapshot` para auditoría histórica.
- `initialPromotionConfig().enabled=false`: sin cambios automáticos para negocios ya operativos.
- Las plantillas genéricas no incluyen IDs específicos de un negocio. Configurarlos mediante el editor y el proyecto privado.

## Fase 2 — Editor y calendario
- `src/ui/promotions-editor.js`, `src/styles/promotions.css`, panel `#/promociones`.
- Secciones: Campañas, Calendario, Cupones, Tickets, Simulador, Resultados.
- Guardado de borradores por proyecto en `sahten_promotions` y sección `promotions` de .sahten.
- Permisos: administración visible a quien tenga rol autorizado; consultar siempre los permisos del servidor al publicar.
- Campo de comisión Checkout Pro en el simulador: calcular con tarifa real incluida la carga impositiva; la comisión del ejemplo no es oficial.
- Un cambio de fecha o canal no debe editar ventas ya creadas.

## Fase 3 — Pedido web, caja y servidor
- `src/payments/core.js`: servidor recompone el total usando menú de Supabase; nunca acepta el importe descontado enviado por navegador.
- `src/payments/repository.js`, `src/delivery/repository.js`: lectura privada de costos mediante RPC restringida a service_role. Esta RPC **aún no está aplicada**.
- `src/online/web/index.html`: previsualiza los descuentos cuando el menú publicado tiene el motor habilitado; bloquea envío no validado en rutas antiguas.
- `src/legacy/sahten-mostrador.js`: cálculo local aislado y resumen operativo, manteniendo comportamiento anterior cuando no está habilitado.
- **Pendiente de QA integral**: misma cotización exacta en tienda, servidor de pago, entrega y caja. En especial, no habilitar una campaña sin sincronizar la versión publicada del menú.

## Fase 4 — Comanda, cupones y resultados
- `src/ui/receipt-template.js` imprime una sola publicidad opcional debajo del bloque de Google Reviews, sin segunda hoja. Las comandas siguen funcionando sin anuncio.
- `src/core/ticket-advertising.js` selecciona un mensaje único; la instantánea del ticket se congela en el pedido para reimpresiones.
- `src/core/promotions-report.js` resume pedidos confirmados con snapshot y excluye los cancelados.
- `supabase/migrations/20261101000100_promotion_coupons.sql`: tabla privada de cupones, hash SHA-256 de códigos aleatorios, reserva y consumo atómicos; **archivo de migración, no ejecutado**.
- `supabase/functions/sahten-promotions/index.ts`: emisión administrativa protegida, sin secretos en código. **No desplegada**.
- **Pendiente para fidelización real**: verificación confiable de identidad del comprador, integración de canje/consumo con confirmación de cobro y cancelación, pruebas de concurrencia y de ancho de papel 58/80 mm. Sin esto, los cupones personales no se deben activar.

## Normalización de precios fijados (pedido adicional)
- `src/core/price-normalization.js` y `src/ui/price-normalization.js` implementan vista previa, ajuste individual calibrado, verificación de precio final idéntico y GF idéntico, respaldo y reversión por producto.
- Evitar cambios a tier global; un cambio global afectaría a múltiples productos. Se conserva el factor de tier asignado y se registra un `priceAdjByChannel` individual de referencia. El importe comercial normal pasa a `priceTargets`.
- `src/core/pricing.js` lee el nuevo precio final; `pricingPolicies[ch].price` pasa a null después de la normalización, desapareciendo la etiqueta «Precio fijado».
- El margen se calcula sobre **precio realmente cobrado – costo variable – GF asignado**. La normalización no modifica el GF ni los precios de ventas antiguas.
- Una empresa concreta tenía 55 productos registrados, 35 con precio explícitamente fijado en Mostrador (auditoría de solo lectura, 01/11/2026).
- No se ha ejecutado la normalización en la base de datos ni publicado los precios migrados. La operación está preparada para propietario/administrador desde Productos, con vista previa y rollback.

## Seguridad
- Mercado Pago funciona en Edge Functions con `SUPABASE_SERVICE_ROLE_KEY` como variable de entorno.
- Las credenciales de Mercado Pago están referenciadas en `sahten_private.mp_accounts.secret_id`, y la función privada de pago usa Supabase Vault.
- Nunca poner Access Tokens, secretos de webhooks, claves service_role ni información sensible de clientes en el repo o en `menu.json`.
- La clave pública de Supabase (anon/publishable) es distinta de una credencial privada.
- La migración de cupones sólo concede EXECUTE a service_role; verificar permisos y RLS después de aplicarla.

## Despliegue progresivo
1. Completar CI y corregir fallos. Realizar pruebas manuales en entorno de prueba.
2. Aplicar migración y desplegar Edge Function sólo después de revisar permisos/identificación.
3. Publicar configuración de campañas por negocio con costos verificados, comisión real y fecha de anuncio/activación.
4. Comparar totales para pago y delivery, verificar recibos y cupones.
5. Activar bajo bandera por negocio y medir antes de ampliar.
6. Revisar 35 normalizaciones en Productos, ejecutar con copia de seguridad y republicar carta sin alterar importes.

**No fusionar ni desplegar este PR como si estuviera completo antes de resolver los bloqueos anteriores.**
