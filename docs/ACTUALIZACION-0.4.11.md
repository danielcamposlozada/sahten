# Sahten 0.4.11 — Mostrador, pedidos online y tickets

- Mostrador conserva el pedido y los filtros al cambiar entre lista y grilla. Búsqueda etiquetada, contador de resultados y tamaños de texto mayores. La vista es una preferencia del equipo.
- Pedidos online reemplaza la etiqueta Delivery. Todos, Retiro y Delivery filtran los pedidos activos del sitio. Los pedidos creados en Mostrador se consultan en Historial.
- La impresión usa un iframe local aislado, espera el logo e invoca el diálogo de impresión del motor del sistema. No usa window.open, ventanas emergentes, servidores de impresión ni generadores externos de QR.
- En Ajustes → Negocio → Personalización, junto al logo de impresión: habilitar reseñas, pegar un enlace HTTPS de Google y editar el texto. El negocio guarda esos datos en el archivo y en su proyecto en la nube. Cajeros y encargados reciben únicamente la marca pública y los datos de impresión permitidos.
- En Menú Online → Sitio web → Reseñas: enlace, título y texto de la invitación. El botón abre Google en otra pestaña e incluye el logotipo oficial de Google.

## Impresión

Seleccionar el papel real del controlador (58 mm en el equipo del usuario), escala 100 %, sin encabezados/pies del navegador. El diseño adapta tamaños y márgenes para 48/58/80 mm. En 48 mm, los importes de los productos van debajo de sus nombres. El QR vectorial conserva cuatro módulos blancos alrededor y mide 30/32 mm.

Verificaciones: suite automatizada, compilación online y offline, contraste de texto, recorrido en Chrome y simulación visual de papel de 48/58 mm. El QR de la captura de 58 mm se decodificó con un lector independiente hacia el formulario correcto.

Pendiente: prueba física con la impresora térmica del usuario en Windows. Las capturas de simulación no equivalen a impresión en hardware. No se ha consumido papel ni enviado un trabajo a una impresora real.

## Criterios de diseño

Se mantienen la tipografía y colores del negocio. Se separa origen (online/mostrador) de entrega (retiro/delivery), con Todos como vista inicial para no ocultar pedidos. La guía UI UX Pro Max disponible aporta criterios de etiquetas, foco, lectura y controles táctiles; sus recursos locales de búsqueda no estaban incluidos, por lo que no se atribuyen recomendaciones a resultados de su buscador.

## Enlace de Sahten

El enlace compartido por el titular abre la ficha de SAHTEN | Gastronomía Árabe. El formulario identificado desde esa ficha es https://search.google.com/local/writereview?placeid=ChIJ_8u4HRjLvJUR6O_iQ94qY6Y. Es configuración del negocio, no una constante de la aplicación.
