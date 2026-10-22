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
