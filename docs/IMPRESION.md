# Comandas e impresión

## Dónde configurarlo

En la actualización preparada: **Ajustes → Negocio → Impresión**. Reúne perfil, papel, calibración, logo para imprimir, reseña de Google con QR, vista previa e impresión automática. Estas novedades todavía no están publicadas en un instalador; Sahten 0.4.22 es la última versión pública verificada.

El perfil IT01 y la escala de interfaz ya están publicados desde 0.4.18. Hasta instalar la próxima actualización, sus controles siguen en **Ajustes → Marca y apariencia**. El formato de la impresora se guarda solo en esta computadora; el logo y la reseña pertenecen al negocio.

| Perfil/papel | Ancho máximo del documento | Configuración |
|---|---|---|
| IT01 · 48 mm | 35,2 mm | Base 40 mm × calibración 88 % |
| Térmica · 48 mm | 40 mm | Calibración 100 % |
| Térmica · 58 mm (predeterminado) | 48 mm | Calibración 100 % |
| Térmica · 80 mm | 72 mm | Calibración 100 % |
| Normal A4 / Carta | 186 / 192 mm | Papel normal |

El documento deja 1 mm interno a cada lado. La calibración modifica el ancho disponible y reorganiza las líneas; no achica la fuente ni el QR. Permite ajuste horizontal 80–110 %, sin acumular reducciones al guardar. No instala ni detecta el controlador.

En el diálogo de impresión seleccioná la impresora, el mismo ancho del papel, **escala 100 %**, sin encabezados/pies del navegador. El dueño confirmó que usaba 48 mm en Sahten y necesitaba 88 % en el controlador: por eso el perfil IT01 ya incorpora esa compensación. Mantener además 88 % en el sistema produciría una segunda reducción. Si el controlador muestra A4, configurá su papel en Windows.

## Ticket compacto preparado

- Número, entrega/retiro, fecha y cliente.
- Delivery: dirección completa, piso/departamento, referencia y teléfono. Las notas del pedido se imprimen aparte. Los pedidos anteriores no inventan datos que no guardaron.
- Productos y cantidades en 14 px, importes separados y total destacado. Arial, menos espacio y separadores; textos largos envuelven sin recortarse.
- Descuento aplicado, envío y ahorro de envío cuando existe; medio elegido y efectivo/vuelto si se indicaron.
- Se elimina el estado de la comanda del papel. El estado y sus acciones siguen en la app.
- Se mantienen el logo configurado y la reseña de Google con QR de 30 × 30 mm. Se quita la instrucción duplicada debajo del QR.

## Impresión automática opcional

Dos interruptores separados, desactivados de inicio: pedidos creados en Mostrador y pedidos nuevos recibidos de la web. **Solo afectan a este equipo** y no viajan con el proyecto ni activan otras cajas.

La cola procesa un pedido a la vez, identifica las órdenes ya intentadas y no vuelve a imprimir por un cambio de estado o sincronización. Al abrir/reconectar no imprime el historial pendiente. Cambiar de proyecto descarta sus trabajos en espera. Si falla, avisa para reimprimir manualmente desde Pedidos; no reintenta en bucle. Los últimos 1.000 intentos se conservan por dispositivo.

Automático significa **abrir la impresión al recibir/crear el pedido**. El WebView/controlador puede exigir confirmar el diálogo. No se promete impresión silenciosa ni confirmación física de que salió el papel. Activarlo en varias cajas puede producir una copia por caja: elegí la que tiene la impresora.

## Efectivo y vuelto

El importe es opcional y aparece solo con Efectivo. Vacío = no informado. Si se ingresa, debe alcanzar el total final (productos menos descuento más envío). Por ejemplo: venta $21.395, paga con $30.000, vuelto $8.605. Transferencia y Mercado Pago no conservan esos campos.

En la web es un aviso para preparar el cambio, no un cobro acreditado. Se conserva en las órdenes nuevas, detalle, ticket, WhatsApp y CSV. Reportes sigue sumando el total de venta, sin agregar efectivo entregado ni vuelto como ingresos/gastos extra. Los pedidos históricos no se recalculan.

## Escala de interfaz

**Ajustes → Marca y apariencia → Tema visual**, 80–125 %, accesos 85/90/100 %. Es independiente del ticket, del proyecto y de la tienda. En escritorio usa zoom del WebView; en navegador de desarrollo, zoom CSS.

## Validación

Pruebas con datos ficticios: dirección/piso/departamento de extremo a extremo, descuento y envío antes del vuelto, importación web, reapertura y archivo del proyecto, impresión sin pop-ups, deduplicación y exclusión del historial. Se revisa el ancho de 48 y 58 mm en Chrome.

**La prueba física de la IT01 en Windows sigue pendiente**: imprimir con escala del sistema 100 %, comprobar borde derecho, lectura cómoda e intentar escanear el QR. Una vista previa correcta no confirma la configuración del controlador ni una impresión real.

Preparación final verificada: **593 pruebas en 62 archivos**, compilación y scripts clásicos correctos; Deno comprueba ambas funciones. Chrome: tienda 320 × 640 y Mostrador/Ajustes 1024 × 600, datos ficticios y sin enviar pedidos. En IT01, ancho calculado 133,04 px (35,2 mm), QR 113,38 px (30 mm), sin elementos fuera del borde derecho. Se conservan las limitaciones de prueba física indicadas arriba. Los cambios de servidor que guardan estos campos se desplegarán con la futura publicación, antes de actualizar el formulario web.
