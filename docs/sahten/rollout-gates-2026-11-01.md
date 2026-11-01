# Sahten — compuertas de pagos, delivery y upselling (01/11/2026)

> Estado: **DRAFT / NO DEPLOY**. La promoción pública y el código nuevo de Edge siguen apagados.
> Este documento no autoriza ni inicia despliegues ni pagos.

## 1. API real de Mercado Pago
- [x] Credential de vendedor ficticio MLA confirmada, sin imprimir el token.
- [x] `POST /checkout/preferences` y `GET /checkout/preferences/{id}` reales, importe y referencia coinciden. GitHub Actions `41361489489`.
- [ ] E2E Checkout Pro con **comprador ficticio distinto**, tarjeta de prueba `APRO` y `OTHE`, respuesta firmada a la ruta nueva, estado de orden y replay idempotente. La prueba de preferencia **NO** es una compra acreditada.
- [ ] Garantizar aislamiento total de los datos de órdenes y webhooks sandbox respecto de la cuenta real de Sahten.

## 2. Seguridad del descuento
- [x] Token HMAC firmado, ventana de 5 min y nonce atómico; no confiar en importes del navegador.
- [x] Antes de consumir nonce, validar cotización y reservar. Si falla la reserva, nonce intacto; si falla canje, liberar reserva sin contactar MP.
- [x] Reintentar con el mismo requestId no crea otra preferencia.
- [x] Con promociones HMAC activas, **NO asumir 10% de comisión MP**: requiere tarifa aprobada o falla la cotización.
- [ ] Revisar las condiciones transaccionales con múltiples pedidos simultáneos y la RPC de costos antes del despliegue.

## 3. Bebidas y Shawarma SUPERMIX
- [x] 11 bebidas vinculadas con compra y precio unitario cargados en catálogo.
- [x] Diferenciar **costo cargado** de **origen de compra verificado**. Cuatro referencias tienen el precio cargado, pero siguen etiquetadas como `missing_supplier_cost`/`costVerified=false`. No borrarlas ni afirmar que cuestan $0.
- [x] Las recomendaciones a **precio de lista** pueden incluir las 11, sin prometer stock ni publicar costos privados. Política para SUPERMIX `p1779299917243`, otros shawarmas, platos y tablas.
- [x] El SUPERMIX tiene receta de 7 ingredientes y costo calculado en el proyecto; el snapshot promocional `pricingPolicies.mostrador` no está completado.
- [ ] **Cualquier descuento adicional** requiere fuente de costo aprobada, gasto de empaque/mano de obra incremental, comisión efectiva del medio, aportes de delivery y margen posterior >=40% (piso absoluto >=35%), por línea y carrito. No inventar ni prorratear gastos fijos de manera arbitraria.

## 4. Web segura y delivery
- [x] Catálogo vigente: 54 productos, 11 bebidas y 49 fotografías remotas; preservar los 38 SKU anteriores.
- [x] Scripts de empaque actualizados: pruebas de cantidad, fotos, precios de bebidas, beneficios, promociones apagadas, preservación de recursos.
- [x] Sugerencias completas a precio normal, nunca cupones, opt-in por clic; pruebas de SUPERMIX, carrito, entrega y transferencia.
- [ ] Verificar en navegador el HTML resultante y la elección de bebida sin introducir descuento adicional ni alterar envío.
- [ ] E2E de entrega con geocodificación/ruta realmente validada, autorización de excepción y conciliación con pedido.

## 5. Publicación controlada (bloqueada)
- La producción de Cloudflare apunta actualmente al despliegue **437a4503-7726-4482-a5e5-6b911fd7272c**. El script conserva como origen una versión **84a00719-0196-48ab-b31f-b321b979398e** anterior. **NO desplegar** hasta verificar diseño, recursos y versión base nueva; el guard de origen en GitHub debe detener reemplazos antiguos.
- Supabase: promoción pública desactivada, Edge pagos y delivery aún productivos antiguos; RPC de costos del PR no aplicada; falta secreto HMAC y aprobación económica.
- [ ] Validar el paquete contra la versión más reciente de Cloudflare sin degradar el diseño de la web.
- [ ] Validar Edge en sandbox aislado con credenciales de test, sin cambiar `mp_accounts` de producción.
- [ ] Autorizar y desplegar inicialmente con promociones **OFF**; observar y habilitar por campaña de forma separada sólo después de e2e/costos aprobados.
- [ ] Verificar rollback por ID exacto del deployment que está activo al momento de implementar.

### Referencias
- PR [#63](https://github.com/danielcamposlozada/sahten/pull/63)
- [Smoke API real sandbox](https://github.com/danielcamposlozada/sahten/actions/runs/41361489489)
- [Paquete web seguro aprobado en PR](https://github.com/danielcamposlozada/sahten/actions/runs/41361112318)
