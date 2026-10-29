# Impresión directa por equipo

Preparado el 29/10/2026. La versión pública 0.4.30 conserva la impresión anterior; esta función necesita la actualización de escritorio que incluya este cambio. No requiere publicar la tienda ni cambiar Supabase.

## Configurar la caja

1. Instalar la impresora y su controlador en Windows o Mac. Debe aparecer entre las impresoras del sistema. Para imprimir sin diálogos se recomienda una impresora física; un destino virtual como PDF puede pedir un archivo desde su propio controlador.
2. Abrir **Ajustes → Negocio → Impresión**.
3. Elegir perfil, papel y calibración. Para el caso informado: **IT01 · 48 mm · 88 %**. El ajuste se aplica al ancho del contenido; el envío nativo no agrega otra reducción.
4. En **Impresora predeterminada de Sahten en este equipo**, seleccionar la impresora de esta caja. **Actualizar lista** vuelve a consultar los dispositivos instalados; nunca cambia automáticamente a otra impresora.
5. En **Mostrador**, activar **Imprimir al confirmar desde Cobrar** y, si se desea, **Sin diálogo del sistema**.
6. En **Pedidos online**, activar **Imprimir pedidos nuevos recibidos de la web** y, si se desea, **Sin diálogo del sistema**. Incluye retiro y delivery; funciona independientemente de Mostrador.

Las preferencias pertenecen al equipo y no al negocio: no viajan con el proyecto ni al publicar el catálogo. Activar estas opciones solo en la caja que debe imprimir; dos equipos configurados para imprimir pueden emitir un ticket cada uno. La app debe estar abierta y conectada para recibir e imprimir pedidos web.

**Sin diálogo** apagado conserva la ventana habitual del sistema. La reimpresión manual desde Pedidos también conserva esa ventana para revisar destino y copias. Un navegador web común no puede ofrecer esta impresión directa: se necesita la app de escritorio Windows/Mac y una impresora instalada.

## Qué se imprime y cuándo

Mostrador imprime después de guardar la nueva orden al confirmar desde Cobrar. Ese botón no acredita un pago automáticamente: la situación del cobro sigue siendo la del pedido. Online imprime al importar por primera vez una nueva orden recibida; no imprime el historial inicial, ni actualizaciones de pago/estado, ni sincronizaciones repetidas.

Se usa la misma plantilla compacta: logo, QR de reseñas si está configurado, productos, importes, dirección/piso/departamento/referencia, pago y vuelto. El estado de la comanda continúa fuera del ticket. No se modifican precios, descuentos, stock ni estados de pago para imprimir.

La cola procesa una comanda por vez y recuerda sus intentos por proyecto/pedido, incluso al reiniciar. Si no puede confirmar el envío, avisa y conserva la orden. No reintenta automáticamente: antes de reimprimir hay que revisar el papel y la cola del sistema para no duplicar un ticket que pudo haber salido. Un aviso de **Comanda enviada a la impresora** confirma que el sistema aceptó el trabajo; no es un sensor de salida de papel.

## Alcance técnico y verificación

Windows usa `ICoreWebView2_16::Print` con la impresora indicada, una copia, papel personalizado, escala nativa 100 % y sin cabeceras del navegador. Requiere WebView2 actualizado. Mac usa la operación de impresión de WKWebView/AppKit con paneles desactivados y restablece copias, escala y rango, sin heredar esas preferencias de la última impresión manual. La calibración del contenido se conserva en la plantilla.

El ticket se prepara en una vista oculta aislada con almacenamiento efímero, con recursos de imagen embebidos y sin acceso a archivos o páginas externas. Se esperan imágenes/fuentes y se mide el alto para el rollo; A4/Carta mantienen su alto normal. Cada trabajo tiene una ventana identificada, y no acepta señales de otro trabajo o de la ventana principal. La vista se destruye al terminar o vencer la espera. No se guardan archivos temporales ni datos personales del ticket en los logs.

Las pruebas de código no reemplazan una prueba física. **Pendiente en caja:** IT01 con el controlador real de Windows, papel 48 mm y calibración 88 %; comprobar una comanda de Mostrador y una de web, legibilidad, importes completos, dirección, QR escaneable, longitud y ausencia de duplicados. No afirmar validación de hardware hasta realizar esa comprobación.

Referencias: [impresión WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/print), [impresión WKWebView](https://developer.apple.com/documentation/webkit/wkwebview/printoperation(with:)), [NSPrintOperation](https://developer.apple.com/documentation/appkit/nsprintoperation).

## Verificación de esta entrega — 29/10/2026

PR [#36](https://github.com/danielcamposlozada/sahten/pull/36), rama `feature/impresion-directa`: 679 pruebas en 74 archivos, build web, scripts clásicos y coherencia de versiones correctos. CI general y las pruebas nativas de Mac y Windows aprobadas (dos pruebas nativas en cada sistema), sin impresoras reales en los runners.

En una app nativa local con identificador separado `app.sahten.printingpreview`, un proyecto ficticio y sin conexión a Supabase se verificaron la consulta de impresoras instaladas, la selección por equipo y ambos controles independientes. No se creó ninguna orden ni se envió ningún trabajo a la impresora detectada. Se desactivaron las opciones automáticas y se cerró la app de prueba al terminar. La instalación habitual permanece en 0.4.30. Captura y resultados en `entregables/impresion-directa-2026-10-29/` del espacio de trabajo.

El código está preparado para revisión; no se integró ni publicó un instalador nuevo en esta entrega. La comprobación física de IT01 continúa pendiente en el equipo de caja.
