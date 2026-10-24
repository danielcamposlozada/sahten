# Mercado Pago por negocio

Implementación de Checkout Pro en la app y la web. Primera cuenta: Sahten; el modelo y la pantalla son generales para todos los negocios. Todavía no se activaron cobros reales.

## Decisión

Checkout Pro con redirección: el comprador arma el pedido en la web de su negocio y paga en Mercado Pago. La app muestra la confirmación verificada por el servidor. El nombre, dominio y cuenta de cobro pertenecen a cada tienda. No se cobra comisión de plataforma ni se comparten cuentas entre negocios.

La opción anterior «Mercado Pago» solo registraba el método elegido. Se reemplaza ese comportamiento con una conexión por tienda en Ajustes → Negocio → Tienda online y delivery.

## Lo que debe aportar cada negocio

1. Una aplicación en Mercado Pago Developers, configurada con Checkout Pro vía Preferences API.
2. Access Token de la cuenta vendedora de prueba y, después de validar, el de la cuenta real. Checkout Pro usa `init_point` en ambos casos; no usa `sandbox_init_point`. Se carga en la app mediante un campo privado; no se pega en el chat ni se incluye en el .sahten.
3. La clave secreta de Webhooks (evento Pagos), generada en esa aplicación. La app muestra la URL HTTPS que debe configurarse.
4. La URL pública de su tienda. Para Sahten: https://sahten.online.
5. Una cuenta de comprador de prueba y los medios de pago de prueba del panel para la validación del checkout.

Con redirección directa no se necesita Public Key en la página. Se necesitaría para integrar el botón/SDK de frontend o un checkout embebido. La producción requiere que el titular active las credenciales en Mercado Pago y complete los requisitos de su cuenta.

## Flujo y límites

- El servidor recalcula precios y envío desde el menú publicado; ignora importes enviados por el navegador.
- Cada intento conserva una referencia única y se reutiliza ante doble clic o reintento. Los intentos de pago no se consideran ventas ni pedidos listos para cocinar.
- Un retorno con «success» en la URL no confirma un pago. Se verifica la notificación firmada y se consulta el pago en Mercado Pago: cuenta de cobro, moneda, referencia, importe y ambiente deben coincidir.
- El pedido llega a la app cuando el importe completo está aprobado. Los pagos pendientes o rechazados conservan un estado separado; los reembolsos y contracargos actualizan ese estado sin duplicar pedidos.
- Las credenciales se guardan cifradas con Supabase Vault y solo las usa el servidor. El personal de caja no puede leerlas ni cambiarlas. La web solo recibe disponibilidad y URLs públicas.
- Los pagos con una cuenta de prueba quedan en el registro privado de pruebas; no crean ventas ni pedidos reales en el Mostrador.
- Las cuentas ficticias actuales entregan tokens `APP_USR` y sus pagos pueden informar `live_mode=true`. Esto no cambia el modo de Sahten: el servidor verificó la etiqueta `test_user` al conectar y conserva esos pagos como pruebas. Una conexión productiva sigue exigiendo una cuenta real y pagos productivos. Un error de verificación se informa como tal, en lugar de mostrarlo como pago pendiente.
- Pruebas primero. Sin credenciales válidas y configuración completa, el checkout permanece deshabilitado. No se enviarán pagos reales como parte de las pruebas del agente.

## Infraestructura

Supabase Edge Function `sahten-payments`, base de datos con separación por `store_id`, Vault y permisos de servicio. Cloudflare mantiene la página estática. La configuración se administra desde la app; no se agregan secretos al sitio ni al proyecto exportado. Para una plataforma que conecte a muchos vendedores mediante autorización delegada, se podrá sumar OAuth sobre el mismo modelo de cuentas por tienda.

## Fuentes oficiales (consultadas 21/10/2026)

- [Checkout Pro por Preferences API](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/overview)
- [Crear una preferencia](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/create-payment-preference)
- [Credenciales](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials)
- [Notificaciones firmadas](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/payment-notifications)
- [URLs de retorno](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/configure-back-urls)
- [Compras de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases)
- [Vault](https://supabase.com/docs/guides/database/vault)

## Instalación en otro servidor Supabase

Aplicar `supabase/payments.sql` después de `supabase/schema.sql`, con la extensión Vault habilitada. Desplegar `supabase/functions/sahten-payments/index.ts` con sus dependencias relativas y `deno.json`. El gateway JWT se desactiva porque la función valida JWT para configuración, HMAC para Webhooks y pruebas de sesión para consultar compras. No cambiar los permisos de las columnas verificadas de `orders`. Cada negocio carga su propia cuenta desde la app.

Las devoluciones y los contracargos se consultan y reflejan; esta versión no inicia devoluciones desde Sahten.

## Validación de compra acreditada · 24/10/2026

- Compra desde `https://sahten.online/pedir/?mp_test=1` en Chrome incógnito, con comprador y vendedor ficticios separados. Una unidad de Shawarma de Carne, retiro, ARS 16.000. Datos de contacto ficticios; no se usaron fondos ni tarjetas reales.
- Tarjeta oficial de prueba Mastercard terminada en 0604, titular de escenario `APRO`, una cuota. No se guardaron credenciales del comprador ni datos de tarjeta en el repositorio o en la app.
- Checkout `e73e3519-4c4f-4eed-be0f-b6fde4dfea1c`; pago `184807337731`, estado del proveedor `approved`. Mercado Pago mostró «Tu pago ya se acreditó» y regresó a la tienda, que mostró «Pago de prueba acreditado. No se creó una venta real» y total $16.000.
- Webhook firmado `data.id=184807337731&type=payment`: respuesta HTTP 200 a las 05:28:13.450 UTC. Llegó antes de la consulta de retorno `/status` (HTTP 200 a las 05:28:21.683 UTC). Confirmación independiente del enlace de retorno.
- Lectura de base: checkout `paid`, pago `approved`, `amount_cents=1600000`, `refunded_cents=0`, `order_id=null`; una fila de pago. Se preservó la separación de pruebas respecto de pedidos y contabilidad reales.
- También llegaron avisos del formato anterior IPN (`id`/`topic`), rechazados con HTTP 401 por la ruta que exige la firma de Webhooks. No bloquearon la confirmación firmada correcta. No se desactivaron las validaciones para aceptarlos.
- La cuenta activa sigue en modo `test`. Después de esta compra, el dueño autorizó y se desplegó la versión 5 de `sahten-payments`, cuya única diferencia funcional conserva `priceRevision` en los productos de futuras órdenes. El titular activó las credenciales reales en el panel. La conexión productiva en Sahten, guardar Webhooks productivos y una validación supervisada con fondos reales siguen pendientes. No se usaron claves productivas en esta validación.

Evidencia local: `entregables/mercadopago-2026-10-24/pago-prueba-resultado.png` en el espacio de trabajo de este chat.

## Descuento y selección de medios · preparado para 0.4.21

La tienda presenta dos opciones del mismo tamaño: efectivo/transferencia y Mercado Pago. Elegir pago directo permite precisar efectivo o transferencia para registrar el medio real. Mostrador muestra una opción compacta por medio, sin duplicación; los medios personalizados (QR, débito, otros) se incorporan en el mismo grupo y declaran su tipo. Esto registra una elección, no una confirmación bancaria ni una nueva integración QR.

En Ajustes → Negocio → Tienda online y delivery se configura el porcentaje y su alcance para web/Mostrador. Por defecto está desactivado. Sahten confirmó 10 %, solo productos, envío sin descuento y sin acumulación: se aplica el mayor descuento de la orden. Tras guardar, sincronizar el menú para que la web reciba la política. La revisión y vigencia cambian al guardar; las órdenes anteriores mantienen su registro original.

Ejemplo ilustrativo: productos $10.000 + envío $1.500 → efectivo/transferencia $10.500 (descuento $1.000); Mercado Pago $11.500. Con otro descuento de 15 %, se aplica ese mayor beneficio y no se clasifica como descuento por pago. Mercado Pago siempre recalcula en servidor desde precios del menú; ignora descuentos enviados por el navegador. Los pedidos directos conservan el flujo de recepción existente y requieren verificar el cobro por el negocio.

Reportes permite desplegar las operaciones beneficiadas y exportarlas con porcentaje, importe y revisión. El importe específico del beneficio se exporta una sola vez por orden, en la primera línea; no sumar las columnas rotuladas «total orden» por cada producto. Se excluyen las canceladas del resumen y no se infieren beneficios de ventas antiguas por coincidencia de importe.
