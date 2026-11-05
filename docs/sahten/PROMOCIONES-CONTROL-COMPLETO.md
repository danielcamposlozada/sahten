# Promociones: circuito completo

Estado: implementación en curso, sin cambios comerciales ni migraciones aplicadas en producción.

## Decisiones del dueño

- Reconocimiento de primera/segunda compra por teléfono, sin SMS ni WhatsApp de verificación. No equivale a identidad verificada.
- Efectivo y transferencia: beneficio habitual del 10 %, solo productos; envío aparte.
- No acumular ofertas: elegir el beneficio mayor por producto, conservar desglose e historial.
- Primera compra online: objetivo de hasta 20 % total. Revisar y confirmar mínimo, elegibles, topes y vigencia antes de activar.
- Segunda compra: beneficio emitido por servidor, de un uso y con prioridad en el ticket; no fabricar códigos al imprimir.
- Costos adicionales pueden quedar pendientes con reconocimiento explícito; nunca convertir un costo base desconocido en cero.

## Orden de trabajo y aceptación

1. Carrito y recomendaciones: fotos, recomendaciones también en escritorio, texto corto, cupón con estilos y pasos conectados. Conservar carrito, navegación y medios de pago.
2. Promociones: mantener desplegables/foco al refrescar; requisitos accionables hacia el campo de producto o la configuración correspondiente; volver para verificar.
3. Reglas: una política explícita de descuento total y margen global, excepciones por producto, evidencia de costo y simulación antes de guardar/publicar. No confundir margen sobre venta con recargo sobre costo.
4. Cupones: elegibilidad por teléfono normalizado, emisión y canje idempotentes, validación atómica de historial y uso único, cancelaciones y reembolsos excluidos. No exponer historial de clientes.
5. Fechas: separar duración del programa (puede ser permanente) del vencimiento de cada beneficio emitido.
6. Web: precio anterior/nuevo, badge y condiciones por producto; desglose del beneficio habitual y extra. Recalcular siempre en servidor.
7. Ticket: segunda compra prioritaria, condiciones completas y legibles en 48/58 mm; conservar importes originales en reportes.
8. Verificación: suite completa Vitest, compilación, pruebas de base de datos con fixtures ficticios y revisión responsive. Mostrar valores finales y cambios de servidor antes de activar producción.

## Configuración anterior observada (no modificada)

Bienvenida: 5 puntos extra + 10 % habitual, mínimo $30.000, vigencia 14 días, sin tope extra configurado.
Segunda compra: 10 puntos extra + 10 % habitual, mínimo $40.000, tope extra $4.000, vigencia 14 días.
Existen pisos distintos: global 40 %, umbral absoluto local 35 %, campañas entre 31 % y 45 %. El servidor aún contiene restricciones fijas del 40 % y máximo habitual del 20 % total. Unificar antes de prometer porcentajes nuevos.

Criterio confirmado: emitir el beneficio siguiente únicamente cuando el pedido web esté confirmado y cobrado. Mercado Pago requiere acreditación verificada por servidor; efectivo/transferencia requieren confirmación del cobro en la app. Entregar o retirar no sustituye la acreditación. Preparar acciones de cobro sin duplicar ventas, con auditoría de responsable/fecha/importe.

## Ampliación solicitada después de 1–7

8. Home y menú: todas las promociones y beneficios online publicados, con condiciones específicas, productos, medios, límites y vigencia. No anunciar borradores ni prometer elegibilidad universal.
9. Mercado Pago: primera/segunda compra con menor descuento, comisión contemplada y reglas independientes. Confirmado: 5% total en primera compra y 10% total en segunda con mínimo de $40.000 en productos, sin tope; envío excluido. Preparar sin activar hasta revisar el conjunto.
10. Presentación interactiva para socios, animación accesible, lenguaje simple: gestión, proyecciones, datos en nube, tienda propia, SEO/GEO/AEO, checkout, control comercial, delivery y ticket de cliente como vehículo de recompra. Separar funciones verificadas de hipótesis de crecimiento; no inventar resultados ni métricas.

La presentación incluirá proyección visual a 3 y 6 meses: escenarios conservador/base/crecimiento, supuestos explícitos y separación de pedidos, facturación, inversión en descuentos y resultado estimado. No presentar estimaciones como resultados garantizados.

## Avance local al 5/11 (sin publicar)

- Primera suite completa: 1007 pruebas aprobadas. Una corrida posterior: 1011 aprobadas, dos expectativas pendientes: cantidad del resumen y prioridad de Google/cupón. Corregidas sin desactivar pruebas: ahora se muestra ×cantidad y SOLO los cupones tienen prioridad antes de Google; las campañas mantienen su ubicación anterior. Verificación focal posterior: 61 pruebas aprobadas.
- Nuevas pruebas de PostgreSQL: política comercial, publicación revisada al 25% con excepción por producto, protección frente a catálogos viejos, normalización del teléfono, emisión idempotente tras cobro, Mercado Pago acreditado, cancelación/reembolso y cupones manuales protegidos. También pruebas de UI para conservar términos rechazados y evitar escribir en otro proyecto tras una confirmación.
- Chrome: comprobados escritorio y 390×844, fotos en resumen, progresión, desglose y cupón con estilo, sin overflow horizontal. Evidencias locales en `entregables/promociones-2026-11-05/`. Chrome rechazó abrir archivos `file://`; NO se intentó eludir esa restricción. Tickets comprobados estructuralmente a 48/58mm; impresión física IT01 pendiente.
- Migraciones preparadas: `20261105010000` reglas comerciales + validaciones; `20261105020000` programas/teléfonos/cobros/cupones; `20261105030000` complementos con política común; `20261105040000` lectura pública de condiciones sin datos privados. Ninguna aplicada en Supabase.
- Punto 8 en curso: condiciones y participantes en home/tienda/carta informativa, lectura pública de programas y enlaces `?beneficio=...#pedido`. Mantener la home aprobada según issue #41 (releída), el mapa y todas sus imágenes. Pruebas específicas del script conectado, escape de contenido y endpoint público aprobadas; pendiente última regresión completa y publicación.
- Punto 9 en desarrollo: dueño confirmó 5% en primera y 10% en segunda; segunda con mínimo $40.000 en productos, sin tope. Aprobó usar 10% provisional y editable para estimar la comisión, sin presentarlo como tasa real. Implementadas edición de comisión, comparación de capacidad por medio y snapshot de la hipótesis en cotizaciones; no se contabiliza como comisión real. Preparar capacidad sin activar. Debe incluir reserva/canje vinculados al checkout y confirmación atómica con el pago; jamás rechazar un pago acreditado por recotizar costos después.
- Punto 10 pendiente: presentación interactiva para socios con proyección visual a 3/6 meses, supuestos explícitos, escenarios y métricas reales agregadas si existen. No afirmar que los cambios preparados ya están publicados.
- Revisar antes de cerrar: copias genéricas de mejoras de producto siguen teniendo una integración específica pendiente; evitar un botón muerto y no prometer un reemplazo genérico que todavía no ejecuta el checkout.

### Cómo se ajustará la comisión estimada

En Promociones → Reglas de rentabilidad se consulta la configuración del servidor. El campo «Comisión de Mercado Pago para simulaciones (%)» comienza en 10 si no hay tasa guardada y queda marcado como provisional. Se puede cambiar el porcentaje y, cuando el negocio haya verificado su tasa total, quitar esa marca. Antes de guardar se muestran el porcentaje, su carácter provisional y las reglas por producto. El guardado usa revisión para detectar cambios desde otro equipo y conserva responsable/fecha/valores anteriores y nuevos.

La tabla compara la capacidad de descuento en efectivo/transferencia y Mercado Pago. Se descuenta la comisión del importe de productos después del descuento para estimar margen. Es una simulación, no una liquidación bancaria: ni el envío ni impuestos/retenciones reales se inventan. Los pedidos anteriores conservan su hipótesis original y el total del cliente no aumenta por cargar esta comisión. Esta opción sigue preparada localmente, pendiente de instalar servidor/app y publicar el conjunto.

Ejemplo didáctico, no precio ni liquidación de Sahten: productos por $10.000; 5% de descuento → cobro $9.500 → comisión estimada del 10% sobre ese cobro $950 → ingreso estimado $8.550 antes de costos. Con 10% de descuento → cobro $9.000 → comisión estimada $900 → ingreso estimado $8.100. El costo combinado no se obtiene sumando los porcentajes sobre bases distintas. Envío aparte; la comisión real puede alcanzar otros conceptos según la liquidación del proveedor.

### Pendiente técnico del canje en Checkout Pro (punto 9)

El flujo actual de cupones cobra y canjea atómicamente para efectivo/transferencia. Habilitar el selector de cupón para Mercado Pago sin un circuito específico sería incorrecto: una preferencia pendiente no acredita el pago y una tarjeta rechazada puede reintentarse con la misma preferencia.

Antes de activarlo:

1. Guardar condiciones diferenciadas por medio de pago en el programa y en cada cupón emitido; 5% / 10% de Mercado Pago son totales, sin sumar el 10% de efectivo. Segunda compra: mínimo $40.000 de productos participantes y sin tope.
2. Consultar el cupón desde el servidor, ligado al teléfono y al identificador de intento. Recotizar con costos online y comisión estimada. El cliente no aporta importes confiables, costos ni reglas.
3. Reservar el cupón junto con el checkout, bajo transacción y control de concurrencia. Conservar el presupuesto y sus condiciones en el checkout. Repetir la misma solicitud y su prueba no crea una compra nueva.
4. Consumir el cupón al recibir el pago acreditado y verificado, en la misma transacción que registra la orden. Los webhooks repetidos no duplican canje ni venta. Usar la cotización guardada: nunca rechazar un pago ya acreditado por un cambio de costos, horario o margen posterior.
5. Resolver abandono sin liberar por un simple rechazo de tarjeta ni por un timeout de red: comprobar estado de preferencia/pagos con el proveedor antes de liberar una reserva y permitir revisión por el dueño. Una contradicción tardía del proveedor debe registrar el pago y señalar revisión; no ocultar la venta ni ejecutar reembolsos automáticos.
6. No exponer un checkout anterior ni sus datos personales solo por conocer un teléfono. La reanudación requiere la prueba privada que ya guarda el navegador.
7. Recién después conectar UI, condiciones públicas, banners y ticket al circuito completo. Pruebas: dos solicitudes simultáneas con el mismo cupón, retry tras timeout, pago pendiente, tarjeta rechazada con reintento, acreditación duplicada, acreditación posterior a cambio comercial, abandono y devolución.

El circuito de reserva/canje ya está implementado y probado con fixtures ficticios: migración 20261105131202, cotización previa y consumo tras acreditación, recuperación de reserva vencida con verificación del proveedor y registro de conflictos tardíos sin ocultar la venta. Los programas comerciales siguen sin activarse automáticamente.

### Validación local del 5/11 · comisión provisional

Suite final completa: `npx vitest run --pool=forks --maxWorkers=2`, 1022 pruebas aprobadas en 141 archivos. `npm run build`, `npm run check:legacy` y `git diff --check` correctos. La primera regresión detectó dos expectativas que confundían la consulta pública de beneficios (POST solo lectura) con el envío de pedidos: se distingue exclusivamente ese RPC y se mantiene el bloqueo de compras. Una corrida con concurrencia alta agotó el tiempo de una verificación masiva; pasó con carga limitada sin relajar sus aserciones. El pool threads no es compatible con el harness actual basado en carpetas por PID; se descartó esa corrida y se validó íntegramente con forks. No se alteró el harness.

Nuevas comprobaciones: tasa provisional explícita, cero configurado respetado, límites de tasa, auditoría SQL, snapshot histórico inalterado, comisión sin cambio del total al cliente, costos de canal online en Checkout Pro y exclusión de beneficios de segunda compra ya no elegibles al reimprimir. No hay activación comercial, deploy ni migraciones ejecutadas en producción en este avance.


## Preparación de publicación 0.4.50 · 5/11/2026

Autorización del dueño: «Continua con la implementación, verifica y publica». Se publica código de app/web y migraciones/funciones de soporte. Preservar el catálogo comercial vigente, credenciales y pedidos. No crear pagos reales ni reembolsos para probar. Los programas nuevos se crean apagados y se configuran desde la app con participantes y condiciones explícitas; no deducir una activación universal del descuento sobre productos sin costos.

Verificación final de código: 1032 pruebas en 144 archivos, compilación y scripts clásicos correctos. Selector de efectivo/transferencia como radio nativo grande, dos posiciones, estado visible y foco por teclado. Cotización con cupón de Sahten antes de enviar el total final a Mercado Pago; reserva atómica, pago pendiente sin consumo, acreditación idempotente, orden basada en la cotización histórica, recuperación de abandono sin liberar fondos en proceso. Reimpresión no ofrece recompensas ya inelegibles; confirmar cobro también es accesible desde el detalle histórico de pedidos web.

Cloudflare de origen cotejado mediante su API: 224be689-2a50-4ece-bb11-434a0724f54d. Se actualiza el pin del empaquetador y de su guardia CI a esa versión, conservando la protección contra pisar una publicación concurrente. No usar la copia 006f0888 como origen nuevo.
