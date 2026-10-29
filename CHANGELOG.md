# Changelog

## Sin publicar

Plantilla web publicada en sahten.online el 29/10/2026; los campos nuevos del editor estarán disponibles en una próxima versión de la app.

- **Historia con dos fotos**: foto horizontal y segunda imagen vertical opcional, descripciones accesibles y pies editables. Se incluyen en la portada y en la página de historia, sin recortar personas; las imágenes se optimizan al exportar.
- **Movimiento de la web**: reemplaza la cinta continua por texto fijo; feedback breve de botones, carrito y desplegables, con tiempos más cortos en celular y alternativa sin movimiento.

## 0.4.31

- **Impresión directa opcional** en Ajustes → Negocio → Impresión: elegir la impresora instalada en este equipo y activar «Sin diálogo del sistema» por separado para Mostrador (al confirmar desde Cobrar) y pedidos nuevos de la web (retiro/delivery). Mantiene papel, calibración, logo, QR, dirección y vuelto; la impresión manual conserva su diálogo.
- **Cola de comandas**: conserva el control de duplicados, no imprime el historial al conectar ni repite cambios de estado. Un fallo conserva el pedido, avisa y requiere comprobar la impresora antes de reimprimir; no cambia el estado del pago ni reintenta automáticamente. Integración nativa Windows/WebView2 y Mac/AppKit; falta la prueba física del perfil IT01 en el equipo de caja antes de dar por validado el hardware.

## 0.4.30

- **Zonas de delivery en vivo**: habilitar/pausar cada zona y pedir/quitar autorización se envía automáticamente, con permisos de dueño/admin, cola persistente y estado confirmado/pendiente. No publica tarifas ni el catálogo completo. La web abierta recibe cambios y conserva el precio del carrito; una publicación vieja no revierte estas decisiones. Requiere desplegar la migración y actualizar app/plantilla una sola vez.
- **Ayuda de publicación**: Tienda online y Pagos explican qué cambios son en vivo y cuáles requieren Publicar catálogo en la tienda. Auditoría de controles documentada en docs/CONTROLES-EN-VIVO.md.

- **Catálogos más claros**: Ingredientes y Envases comparten con Mercadería las vistas de lista/tarjetas, búsqueda por nombre/proveedor, etiquetas de campos y costo de referencia destacado. Acciones agrupadas en tres puntos, con teclado, cierre por Escape y alternativa para navegadores sin popover.
- **Stock legible**: listas y tarjetas con existencias, mínimo, estado con texto y color, valoración al costo y acciones compactas. Los movimientos de ingredientes por unidad o volumen abren la unidad base correcta; Mercadería comparte su única existencia con el producto de reventa.
- **Tabla avanzada de Productos**: conserva columnas y colores de canales; producto/selección y acciones fijos al desplazar, encabezado fijo, espacios consistentes, región accesible por teclado y flechas para recorrer las columnas sin perder la referencia del producto.

- **Mercadería**: catálogo separado para productos terminados de proveedores, con buscador, lista/tarjetas, proveedor, presentación, unidades por paquete y costo unitario calculado con el mismo motor de Ingredientes.
- **Reventa sin receta**: crear un producto de venta desde Mercadería y ajustar unidades por venta, categoría, foto, envases opcionales y precio por canal. Comienza pausado y oculto en la tienda, con las mismas decisiones de activación del resto de productos.
- **Costo y stock compartidos**: agregar mercadería a recetas y combos; el artículo es una sola fuente de costos y existencias para ventas individuales, packs y combos. Incluye ingresos/retiros, movimientos, plantilla de inventario y cálculo de precios, proyecciones y costos históricos de nuevas ventas. Las anteriores conservan su registro original.
- **Trasladar desde Ingredientes**: acción con confirmación para artículos cargados en unidades, conservando ID, referencias, costo y stock. Guardado en el proyecto y respaldo/nube completa; sin exponer proveedores ni costos en la web o en vistas públicas.

## 0.4.29

- **Carta visual y búsqueda**: productos en dos columnas en celular y tres en escritorio, buscador por nombre, descripción y categoría sin exigir tildes, filtros con estado visible y fotografías con espacio reservado. El aviso del beneficio usa la configuración real del negocio.
- **Pedido editable al costado** en escritorio: sumar, restar y quitar sin salir de la carta, subtotal y acceso a entrega/pago. En tablet/celular se conserva el acceso fijo y la revisión del pedido antes de completar datos.
- **Checkout adaptable en dos pasos**: entrega, datos y pago agrupados; en escritorio, resumen y confirmación en una columna propia. Piso/departamento/referencia y notas plegables, importes con envío pendiente claramente identificado, vuelto y selección de pago conservados al editar. No cambia tarifas, descuentos, cobros ni validación del servidor.

## 0.4.28

- **Delivery con apertura propia** en Ajustes › Negocio › Delivery. Pausar/reactivar envía solamente el estado a la tienda conectada, con cola por negocio, reintento y confirmación visible. Conserva horarios, zonas, tarifas, retiro, pedidos y pagos iniciados. La web abierta consulta cambios cada 10 segundos y al recuperar foco; el servidor rechaza nuevos envíos incluso desde páginas antiguas.
- **Ajustes separados**: Delivery concentra apertura, ubicación, horarios, cobertura, tarifas, incentivos y rutas. Pagos de la tienda reúne medios, Mercado Pago, beneficio por pago y datos bancarios.
- **Productos con las cuatro vistas acordadas**: Lista esencial como inicio, Lista con editor lateral, Tarjetas y Comparador de canales. Acceso directo al editor histórico de precios, estados automático/fijado, favoritos, selección en lote, fotografías, detalles plegables y colores de todos los canales. Tabla avanzada y grilla anterior conservadas; análisis de costos plegable.
- **Publicación coordinada**: app, plantilla web y validación del servidor; conserva el estado operativo actual de delivery y los datos del negocio.

## 0.4.27

- **Pausas importadas, protección adicional del servidor**: el ingreso de pedidos antiguo también consulta una pausa del catálogo publicado cuando todavía no existe su registro privado. Aplicada con autorización específica; no requiere otro instalador.

- **Recetas, Productos y Tienda online**: nombres y funciones separados. Habilitar una receta para venta requiere confirmación y la deja pausada y fuera de la tienda; las internas no aparecen en las pantallas de venta.
- **Pausa compartida de ventas**: por hoy, hasta una fecha/hora o sin vencimiento; gris y «No disponible» en Mostrador y web, con protección del carrito y del servidor. Conserva precios, costos, stock e historial.
- **Interruptores de la tienda automáticos**: mostrar/ocultar envía solo el estado y recupera el último precio publicado. Cola persistente, reintento, separación por negocio y protección frente a respuestas antiguas. Los precios y el catálogo completo siguen con publicación explícita.
- **Nube con acciones claras**: «Actualizar proyecto entre equipos», «Publicar catálogo en la tienda» y «Exportar archivos de la web», con ayuda sobre su alcance y reemplazo de datos. La publicación automática por fotos ya no se dispara al abrir el proyecto o iniciar sesión.

## 0.4.26

- **Confirmación al cliente desde Pedidos**: botón para preparar WhatsApp en retiro y delivery, tanto web como Mostrador. Vista previa, teléfono editable para esa orden y tiempo estimado con opciones rápidas. Abre el chat con el texto listo; el envío se confirma en WhatsApp y no acredita un pago.
- **Tiempo estimado en Mostrador**: campo opcional al crear el pedido; editable después desde su tarjeta. Se conservan la estimación, su hora y los ajustes dentro del proyecto.
- **Aviso acústico exclusivo de pedidos web nuevos**: retiro y delivery; pedidos de Mostrador, avisos del sistema y carga de pedidos existentes quedan sin sonido. Se conserva la darbuka y las palmas.
- **Cancelar desde la tarjeta**: acceso directo con motivo opcional y devolución de stock solo si se elige. Conserva el historial y los pagos; no realiza reembolsos. Los estados sin sincronizar quedan pendientes con reintento, sin que una respuesta anterior reactive el pedido.
- **Buscador de clientes en Mostrador**: sugerencias locales por nombre, teléfono o correo, selección con teclado y alta rápida con datos precargados. Reemplaza el desplegable y evita asignaciones accidentales al dejar una búsqueda sin seleccionar.
- **Disponibilidad de delivery a la vista**: la tarjeta de horario/cobertura/envío se ubica debajo del selector de modalidad, antes de los datos personales en la web y antes de la dirección en Mostrador.

## 0.4.25

- **Direcciones automáticas y más rápidas**: web y Mostrador vuelven a sugerir al escribir calle y altura, sin pulsar un botón. Espera de 350 ms, cancelación de consultas anteriores, resultados cercanos al local y caché temporal en memoria. Usa Georef para sugerencias argentinas y muestra «Buscar de otra forma» solo si falla la consulta o no hay resultados; elegir la sugerencia sigue siendo necesario para validar recorrido y envío.

- **Búsqueda de direcciones recuperada**: si el servidor no obtiene una dirección precisa, web y Mostrador usan la búsqueda directa de OpenStreetMap ya disponible, manteniendo la validación de rutas en el servidor. Descarta resultados generales de ciudad del proveedor de ubicaciones; los errores del buscador ya no se etiquetan siempre como «sin conexión». Conserva límites, horarios, tarifas y autorizaciones.

- **Tutorial de administración de la tienda**: guía visual y escrita en `docs/`, con los recorridos para cambiar precios/envíos, sincronizar el catálogo y subir la carpeta completa a Cloudflare. Distingue la copia del proyecto del menú publicado y explica la verificación de horarios/beneficios. Es documentación independiente; no agrega una pantalla a los instaladores 0.4.24 ya publicados.

## 0.4.24

- **Pedido editable antes de pagar**: la tienda separa «Pedido» y «Entrega y pago». Desde el carrito se pueden sumar/restar unidades o quitar un producto completo, sin volver al catálogo. El segundo paso permite regresar y conserva datos, dirección, notas y efectivo; recalcula el total, el descuento y el envío tras cada edición. Un carrito vacío no permite continuar ni enviar.

## 0.4.23

- **Proveedor de rutas actualizado**: usa el dominio vigente `api.heigit.org/openrouteservice/v2`, reemplazando el dominio que ORS retira en noviembre de 2026. Conserva el mismo perfil y las validaciones de recorrido, sin activar zonas ni beneficios.

- **Impresión en un solo lugar**: Ajustes → Negocio → Impresión reúne perfil de impresora, papel, calibración, logo, QR y vista previa. Impresión automática opcional y local por equipo para pedidos de Mostrador y pedidos web nuevos; cola sin duplicados ni impresión del historial al conectar. Puede requerir confirmar el diálogo del sistema.
- **Ticket compacto de delivery**: dirección, piso, departamento, referencia y notas completas; tipografía de 11–11,5 px en 48/58 mm para admitir más caracteres por línea, número de orden de 14 px, total de 13 px y QR de 30 mm. Menos espacios y separadores; se elimina el estado de la comanda del papel, manteniéndolo en Pedidos. Papel de mayor ancho conserva texto de 14 px.
- **Efectivo y vuelto**: campo opcional «Con cuánto paga» en web y Mostrador, validación de importe suficiente y vuelto calculado sobre el total final, con descuento y envío. Se guarda con la orden y aparece en detalle, ticket, WhatsApp y CSV; no aumenta los ingresos ni acredita un pago automáticamente.
- **Datos de entrega completos**: piso y departamento separados de referencias y notas, conservados entre web, caja, servidor y archivo del proyecto. Cambiar dirección invalida ruta y autorización anteriores.
- **Servidor de envíos**: migración privada y funciones desplegadas con autorización del dueño, política delivery v2 desactivada. Se fijan los search_path de las funciones nuevas; conectar y validar el proveedor sigue siendo un paso separado.

## 0.4.22

- **Publicar menú en escritorio**: crea las subcarpetas de tienda, páginas informativas y marca antes de escribir sus archivos. Corrige la exportación incompleta que fallaba con «undefined».

- **Ruta para el repartidor**: las tarjetas de delivery aceptado ofrecen icono de mapa, copiar ruta, abrir Google Maps y compartir. Destino ya cargado, GPS del repartidor como origen, sin clave de Google ni envío automático de mensajes. Disponible desde En preparación, Listo para enviar y En camino; fallback para equipos sin compartir/portapapeles y pedidos anteriores con dirección.

- **Delivery geográfico preparado**: zonas 1–5 y excepcional exclusivas del proyecto Sahten, con tarifas, mínimos y beneficios precargados. Editor de anillos y polígonos con huecos, vértices, previsualización, reversión, pausas y validación de superposiciones. Activación y promociones inicialmente apagadas.
- **Una sola cuenta para web y Mostrador**: ruta comprobada por calles, piso tarifario efectivo y autorización administrativa entre 8 y 8,5 km. Backend para todos los medios; el 10 % de pago sigue aplicándose solo a productos. Tarjeta de progreso compartida con fondo verde claro, ahorro y próximo beneficio.
- **Delivery con horario**: horario argentino confirmado de Sahten, turnos y fechas especiales editables; web, POS y servidor bloquean nuevas entregas fuera de horario. Retiro y pedidos ya aceptados conservan su flujo.
- **Históricos de envío**: tarifa base/cobrada, ahorro comercial, revisión, zonas, ruta y autorización en pedidos, comprobantes y reportes. Migración y funciones preparadas, sin despliegue automático; ver `docs/DELIVERY-GEOGRAFICO.md`.

## 0.4.21

- **Medios de pago visibles**: en la tienda, dos opciones grandes del mismo tamaño para efectivo/transferencia y Mercado Pago con su símbolo oficial, sin desplegable. En Mostrador, una opción compacta por medio real, incluidos QR y medios personalizados, sin botones duplicados. El total se actualiza al elegir y conserva los datos de contacto y entrega.
- **Beneficio configurable por negocio**: descuento por efectivo o transferencia sobre productos, con alcance independiente para web y Mostrador. Aplica el mayor descuento de la orden, sin acumular; no reduce el envío. Desactivado por defecto para otros negocios.
- **Descuentos trazables**: cada orden nueva conserva porcentaje, base, importe y revisión de la promoción. Mostrador importa el descuento web, el ticket y WhatsApp lo detallan, y Reportes identifica operaciones y monto concedido; no reclasifica ventas anteriores ni duplica el descuento como gasto. Corrige el total de descuentos del reporte que leía un campo anterior.

## 0.4.20

- **Instaladores corregidos**: restaura la versión original de una dependencia de Rust y alinea el registro de la app. Incluye el pie de la tienda de 0.4.19, cuyos instaladores no llegaron a publicarse. La validación de versiones ahora comprueba también Cargo.lock y package-lock.json.

## 0.4.19

- **Pie de la tienda restaurado**: la página de pedidos conserva contacto, horarios, enlaces y crédito configurados. También funciona en la vista de pedido de la portada, sin duplicar el pie; la barra del carrito no tapa el crédito y el acceso flotante de WhatsApp se oculta al llegar al pie. Filtrar categorías conserva la dirección de la tienda y los enlaces del pie en subcarpetas.

## 0.4.18

- **Navegación dentro de la tienda**: `/pedir/` conserva logo, secciones del sitio, Menú activo y botón «Mi pedido» con cantidad. Enlaces compatibles con subcarpetas y menú desplegable en pantallas chicas. El carrito conserva cantidades al visitar otras secciones durante la sesión, sin guardar datos personales ni precios anteriores.
- **Editor de precio más claro**: precio final destacado, costos secundarios y candados con estado explícito. La vista previa actualiza el campo automático al modificar costos y mantiene precio/resto visibles durante la edición; explica qué cambia al fijar un precio.

- **Precio y costos bloqueados por producto/canal**: editor con importe, slider y bloqueo independiente del precio final, costo variable por unidad, gasto fijo asignado por unidad y porcentaje de comisión estimada. Etiqueta interna «Precio fijado», sin mostrarla a clientes. Historial con vigencia desde el guardado; los precios fijados reemplazan recargos y descuentos automáticos de ese producto/canal.
- **Costos históricos privados**: las nuevas órdenes de la caja conservan su desglose. Versiones de precio publicadas permiten recuperar costos de pedidos recibidos desde la web u otra caja después de un cambio. Los costos permanecen en el proyecto privado; órdenes y catálogo solo llevan una referencia. Reportes y exportación distinguen órdenes sin historial; la proyección pondera los costos por canal y descuenta el GF mensual una sola vez.
- **Perfil IT01 y calibración**: 48 mm con calibración horizontal del 88 % (contenido de 35,2 mm), sin reducir texto ni QR. Perfil manual, papel térmico 48/58/80 y papel normal A4/Carta. Preferencias locales por equipo; escala del controlador 100 %. Pendiente prueba física de IT01.
- **Escala de interfaz por equipo**: 80–125 %, accesos a 85/90/100 %, persistente y con zoom nativo de escritorio. Independiente del proyecto, la web y el formato del ticket.
- **Importar clientes CSV/Excel**: vista previa, asignación de columnas, hoja de direcciones por ID externo, múltiples direcciones y una principal por cliente. Los teléfonos compartidos conservan personas distintas; se omiten duplicados claros y filas inválidas sin reemplazar clientes previos. Se conservan compras anteriores como referencia, sin crear ventas. El checkout con identificación de clientes queda para una próxima etapa.

## 0.4.17

- **Nuevo aviso de pedidos**: grabación acústica de darbuka con palmas de 3 segundos, elegida por el dueño. Reemplaza el sonido sintetizado; está incluida en la app, funciona sin internet y las notificaciones simultáneas no superponen ni cortan el ritmo.

## 0.4.16

- **Guardado fiable de Mostrador**: altas, ediciones y eliminaciones de clientes y medios de pago activan el guardado del proyecto aunque no haya otro cambio pendiente. También cubre pedidos y el resto de los datos internos; la carga de un archivo no dispara escrituras. La instalación de una actualización se detiene si el proyecto no pudo guardarse o se canceló su guardado.
- **Más altura para el pedido**: el carrito comienza junto al aviso de prueba y aprovecha toda la altura; las pestañas ocupan el ancho del catálogo. El aviso se puede ocultar con una X y vuelve al entrar a Mostrador. Los niveles de precio ya no aparecen como categorías de platos.
- **Pedidos de mostrador y web en una cola**: «Pedidos» reúne ambas procedencias en Retiro en local / Mostrador y Delivery. Los pedidos locales también se completan como retirados o entregados y siguen disponibles en Historial.
- **Tarjetas compactas con detalle desplegable**: muestran cliente, origen, tiempo, total y estado; productos, dirección, contacto, indicaciones, pago e impresión se despliegan a pedido. Bordes, etiquetas y botones distinguen estados sin teñir la tarjeta completa. Elegir un medio de pago no equivale a un cobro acreditado.

- **Comandas sin recortes en tiqueteras**: selección local de papel de 48, 58 u 80 mm; ancho útil explícito de 40, 48 o 72 mm. Los tickets estrechos separan nombre e importe en líneas y conservan el QR dentro del ancho. El documento de impresión usa el papel seleccionado, sin depender de ventanas emergentes ni de detección automática del controlador.

- **Pie del sitio personalizable**: texto y enlace del crédito por negocio; el pie auxiliar vacío ya no agrega una franja de 36 px debajo del sitio.

- **Color del símbolo de portada**: campo independiente para definir el color del logo monocromo del hero. Sahten usa `#FAF8F5`, solicitado por el dueño.

- **Logo de navegación y portada separados**: la barra muestra el logo de la tienda y la portada permite cargar un símbolo independiente. Sahten usa el logo completo en navegación y solo la caligrafía árabe completa en el hero, del color del texto.

- **Tienda independiente**: opción en Sitio web para generar `/pedir/`, enlazable desde cualquier web propia. La portada dirige a la tienda y el catálogo conserva el mismo carrito, retiro, delivery y conexión de pedidos. La actualización del catálogo no reemplaza el diseño publicado.
- **Logo de la tienda**: cargar, previsualizar, cambiar o quitar SVG, PNG, JPG o WebP desde Sitio web. Viaja con el proyecto y la publicación; opción para usar el color del texto. No cambia la identidad de la aplicación.
- **Logo árabe completo**: el encabezado del kit de Sahten conserva los cinco signos separados del SVG entregado por el dueño.
- **WhatsApp**: símbolo vectorial de la marca en los accesos de la portada, navegación y botón flotante. Texto de productos y controles de compra más legibles.

## 0.4.15

- **Invitaciones con permisos claros**: el dueño ve campos separados de correo y rol, la explicación de los permisos elegidos y una guía de todos los roles. La invitación empieza como Vendedor / Caja, conserva los errores y evita envíos duplicados.
- **Vendedor / Caja**: nombre visible del rol de mostrador; conserva los permisos y las cuentas existentes. Dueño, Administrador, Encargado y Solo lectura mantienen sus alcances.
- **Logo completo en la app**: restaura los cinco signos del vector original en el menú lateral, la personalización y los documentos impresos.

- **SEO en subcarpetas**: los enlaces a la carta y al sitemap conservan la ruta del negocio aunque la dirección pública se cargue sin barra final.
- **Más páginas para buscadores y asistentes de IA**: «Publicar menú» genera además `/menu/` (carta completa con precios y datos estructurados Menu), `/delivery-y-retiro/`, `/catering/` y `/nuestra-historia/`, cada una con su dirección propia, migas de pan y Open Graph; el sitemap las incluye con fecha. Solo salen con la dirección pública cargada.
- **Datos estructurados más completos**: Restaurant con tipos de cocina, barrios de reparto (`areaServed`), perfiles (`sameAs`), enlace a la carta y logo; preguntas frecuentes como FAQPage idénticas a las visibles. La portada enlaza a las páginas nuevas.
- **Kit de imágenes de marca**: favicon, ícono para iPhone, manifiesto, íconos Android/maskable e imagen para compartir el link (1200×630, con medidas y texto alternativo). Se activa con *Kit de imágenes de marca* en SEO. La portada muestra la caligrafía árabe sola como logo. Incluye en `docs/brand/` los avatares y portadas para Google, Instagram y Facebook.
- **Editor del sitio**: nuevos campos de barrios de reparto, otros perfiles públicos y kit de marca.
- **Documentación para agentes**: `AGENTS.md`, `docs/SEO-GEO-AEO.md`, `docs/PROMPT-AGENTES.md`.

## 0.4.14

- **Tablero de pedidos online**: dos columnas fijas para Retiro y Delivery, con número, cliente, cantidad de productos, horario y progreso.
- **Acciones rápidas**: avanzar a preparación, listo, enviado, retirado y entregado sin abandonar el tablero.
- **Completados recientes**: sección plegable durante 30 minutos; el historial conserva todos los pedidos.
- **Sincronización de estados**: flujos diferenciados para retiro y delivery; migración de Supabase requerida y aplicada para la instalación actual.
- **Adaptabilidad**: pantalla estrecha con selector Retiro/Delivery y mejoras de estilos compatibles con el tema existente.

## 0.4.13

- **Sincronización visible**: muestra la etapa de datos, fotos y guardado, con barra y contador real de fotos, fin o error. Cubre sincronizar proyecto, abrir desde nube y publicar menú.
- **Buscadores y enlaces compartidos**: configuración por negocio para título, descripción, dirección pública y datos del restaurante; publicación con contenido HTML legible sin JavaScript, datos estructurados, Open Graph, robots y sitemap. La carta aparece sin esperar a Mercado Pago.

- **Actualizaciones al iniciar**: comprueba en cada apertura y ofrece Actualizar o Más tarde. Si no hay conexión o novedades no interrumpe.
- **Fotos web más livianas**: genera una copia WebP al sincronizar el menú (JPEG como alternativa), sin reemplazar las fotos originales del proyecto. Limita productos a 800 px y portada/historia a 1600 px, sin ampliar fotos pequeñas; conserva la copia más liviana.
- **Publicación de fotos**: conserva referencias válidas de la misma tienda y bloquea referencias incompletas o de otras tiendas antes de reemplazar el menú.

## 0.4.12

- **Ticket completo de reseñas**: el pie incluye el logo de Google en blanco y negro junto al texto y el QR del negocio. El logo está incluido en la app y se imprime sin conexión.
- Conserva las mejoras de Mostrador, Pedidos online y papel de 48/58 mm de 0.4.11. Activá el pie de reseñas en Ajustes → Negocio → Personalización y usá Previsualizar comanda para comprobarlo antes de imprimir.

## 0.4.11

- **Pedidos online**: reemplaza Delivery, incluye retiro y envío con filtros Todos / Retiro / Delivery y contadores compartidos. Los pedidos creados en mostrador siguen en el historial.
- **Reseñas en el ticket**: opción por negocio con texto editable y QR de Google generado sin internet. Se configura junto al logo para impresión.

- **Mostrador en lista o grilla**: ambas vistas comparten búsqueda por nombre o categoría y conservan el pedido y los filtros. La elección se recuerda en cada equipo.
- **Lectura más clara**: buscador con etiqueta y borde destacado, contador de resultados, nombres y precios más grandes; en lista los nombres largos se muestran completos.
- **Comandas sin pop-ups**: la impresión prepara un documento aislado dentro de la app, espera al logo y abre el diálogo del sistema sin ventanas emergentes.
- **Papel de 48 y 58 mm**: texto negro y mayor tamaño; en 48 mm los importes de los productos pasan a su propia línea para dejar espacio a los nombres. Elegí el papel correspondiente en el controlador de la impresora.

## 0.4.10

- Checkout Pro de Mercado Pago con cuenta independiente por negocio, configurada desde Tienda online y delivery. Claves cifradas en el servidor y permisos de dueño o administrador.
- La web recalcula el total y el envío antes de crear el pago. Confirma la acreditación con Mercado Pago y crea un solo pedido cuando se cobra el total.
- Pagos de prueba separados de las ventas reales. Seguimiento de rechazos, pagos incompletos, reembolsos, disputas y cobros excedentes.
- Los pedidos de la app reciben actualizaciones del estado de pago, con respaldo por consulta periódica.

## 0.4.9

- **Menú retráctil**: se puede plegar y desplegar; recuerda la elección en cada equipo y se compacta en ventanas pequeñas. En el teléfono, el botón abre todas las secciones con teclado y foco controlado.
- **Mostrador en pantallas pequeñas**: el pedido desplaza productos y datos juntos; total y cobro conservan su espacio. En ventanas estrechas se abre desde «Ver pedido», sin cerrarse automáticamente.
- **Ventana de escritorio**: adapta su tamaño inicial al área útil y a la escala del monitor, y permite reducir la ventana hasta 640 × 480 cuando hay espacio.
- **Web adaptable**: el encabezado conserva el acceso al pedido y agrupa las secciones en un menú desplegable. El formulario tiene etiquetas, cierre y foco accesibles; el envío conserva su espacio también con teclado móvil.
- **Marca y contraste**: los botones eligen texto claro u oscuro según los colores configurados por cada negocio.

## 0.4.8

- **Fotos en la nube**: Sincronizar menú sube las fotos de productos, categorías, portada e historia a Supabase Storage. El menú usa direcciones versionadas para mostrar las fotos nuevas sin volver a subir la carpeta.
- **Publicación automática opcional**: en Nube y usuarios se puede activar «Actualizar fotos automáticamente en la web». Guarda primero el archivo local y publica el menú completo; informa pendientes y errores, reintenta al volver internet y permite reintentar manualmente.
- **Fotos entre equipos**: el proyecto en la nube guarda referencias y al abrirlo se descargan las fotos dentro del .sahten, para conservarlas sin internet. Las fotos cambiadas o quitadas también cuentan como cambios del proyecto.
- **Configuración necesaria**: ejecutar supabase/photos.sql después del esquema existente y volver a publicar la web una vez. El bucket es público y solo el dueño o administrador de la tienda puede subir fotos.

## 0.4.7

- **La vista previa muestra lo que tenés en la app.** Con la nube conectada, la vista previa (y «Abrir en el navegador») bajaba el menú ya publicado y lo ponía encima: por eso lo que importabas o escribías en «Sitio web» no se veía. Ahora la vista previa usa solo lo local y no puede enviar pedidos de verdad.
- **Fotos más fáciles**: ahora hay una sola forma de cargarlas, en todos lados. Tocá la miniatura (o arrastrá una imagen encima) en **Menú Online**, **Menú**, **Costo Receta** y en la **Receta**, y la foto se actualiza en todas las pantallas. La × quita la foto.
- **Menú Online**: cada producto tiene los botones «Receta» (abre la receta para editar nombre, categoría, ingredientes y foto) y «Precio» (salta al Menú con ese producto buscado).
- **Fotos de categoría**: cada categoría de Menú Online tiene su foto. Se usa en las tarjetas de «Pedir online» de la web; si no tiene, se usa la foto de uno de sus productos. Hay que volver a publicar la carpeta para que se suban.
- **Sitio web**: las fotos de portada e historia usan el mismo selector (con arrastrar y soltar).

## 0.4.6

- **Vista remota en vivo**: ahora hay un aviso fijo arriba con «Salir de la vista remota», que vuelve a la lista de proyectos (antes no había forma de salir).
- **Aviso de actualización**: ventana más ancha, con las novedades con formato y barra de desplazamiento (antes se veía el texto sin formato).
- **Notas de la Release**: un renglón por cambio (título y primera frase) con enlace al detalle en el CHANGELOG.
- **Menú publicado (web)**: la barra de categorías quedaba despegada del borde superior; ahora queda pegada justo debajo de la barra del sitio, que además se mantiene fija al bajar.
- **Web del menú: «Pedir online» en su propia vista**: el inicio ya no trae toda la carta; muestra una tarjeta por categoría (con su cantidad de productos) y un botón «Pedir online». La carta completa con categorías y carrito se abre aparte (`#pedido`, o `#pedido/Categoría` para ir directo a una), y «Atrás» vuelve al inicio. Sin el sitio activado, la página sigue siendo la carta de siempre.
- **Editor del sitio web**: con el sitio apagado (el estado inicial) la vista previa mostraba solo el menú y lo que se escribía no se veía. Ahora la vista previa del editor siempre muestra el sitio, con un aviso de que mientras esté apagado se publica solo el menú.

## 0.4.5

- **Menú Online**: «Ver vista previa» abre la página publicada dentro de la app (celular / escritorio). Antes «Vista previa en pestaña» no hacía nada en la app de escritorio (faltaba un permiso y el error se perdía). «Abrir en el navegador» sigue disponible y ahora avisa si falla.
- **Cada tienda con su marca**: al abrir otro proyecto se vuelven a leer su nombre, logo y colores (antes se quedaba la marca del primero). La pestaña, el color del navegador y el nombre de la tienda en Supabase siguen la marca.
- **Usuario en la barra superior**: muestra la tienda activa (nombre y color) y la cuenta. La tienda se configura una sola vez (se puede pegar un código de conexión) y después solo se pide email y contraseña; «Cerrar sesión» conserva la conexión; «Olvidé mi contraseña».
- **Navegación**: menú lateral, barra inferior y cajón del celular salen de las mismas secciones (el cajón ahora incluye Mostrador, Menú Online, Reportes y Nube y usuarios). Enlaces reales con teclado y lector de pantalla, sección activa marcada, y URL por sección (`#/menuonline`) con botón Atrás.
- **Barra superior de escritorio**: Guardar y un menú «Archivo» (Abrir, Exportar a CSV, Recalcular precios).
- **Accesibilidad**: foco visible, zonas táctiles de 44 px, texto mínimo de 12 px, «Saltar al contenido», respeto de «reducir movimiento».
- **Avisos y confirmaciones propios** (no bloquean y se ven igual en escritorio, web y celular); una acción que falla ya no queda muda.
- **Protección del menú publicado**: «Sincronizar menú» siempre pide doble confirmación (cuántos productos se publican y cuántos hay publicados ahora; después «¿Seguro?», avisando si el menú nuevo tiene menos productos). Un proyecto sin productos nunca se publica (evita pisar el menú desde una PC con un proyecto vacío).
- **«Abrir proyecto de la nube…»**: la lista de proyectos se armaba y se borraba al instante, así que nunca aparecía nada. Ahora se ve la lista y «Abrir» carga el proyecto elegido.
- **Releases de GitHub**: las notas de cada versión salen de este archivo.
- Documentación: `docs/AUDITORIA-UX.md` y `docs/SISTEMA-DISENO.md`.

## 0.4.4

- **Corrección al eliminar proyectos**: al elegir «Borrar el archivo…», el cuadro para escribir el nombre quedaba detrás del anterior y la pantalla se oscurecía sin poder continuar.
- **Actualizaciones en las notificaciones 🔔**: al abrir la app de escritorio, si hay una versión nueva queda un aviso con el botón «Actualizar ahora» (ya no interrumpe con un cuadro). Los avisos de la app no dependen del proyecto abierto.
- **Ajustes reorganizado** en tres grupos: **Negocio** (marca y apariencia, canales, niveles de ganancia, tienda online y delivery), **Proyecto** (archivo y proyectos, respaldos e importación, zona peligrosa) y **Esta app** (versión y actualizaciones, ayuda y tour).

## 0.4.3

- **Sitio web por módulos** (Menú Online › Sitio web): portada, favoritos, menú, cómo funciona, historia, cinta de texto, reseñas, catering, delivery, preguntas frecuentes y contacto. Cada sección se enciende, se mueve y se edita, con vista previa real al lado y fotos para portada e historia. Página publicada rediseñada. Descripción corta por producto.
- **Proyectos**: la app entra directo al último proyecto; pantalla de proyectos tipo perfiles; bienvenida más simple; eliminar proyectos (quitar de la lista o borrar el archivo).

## 0.4.2

- **Menú Online rediseñado** en una sola pantalla: estado de publicación (sin publicar / al día / cambios sin publicar / falta completar), lista agrupada por categoría con interruptores, arrastrar para ordenar, fotos, avisos por producto (precio $0, sin categoría, sin foto), filtros y búsqueda, ajustes plegables y **vista previa del celular en vivo**.
- Corrección: la columna Precio del Menú Online mostraba $0 en todos los productos; ahora muestra el precio que se publica. «Productos visibles» ahora cuenta lo que realmente sale (respeta las categorías ocultas).
- Mostrador: cobra el precio con el descuento del canal, igual que el panel Menú.
- Demo: el canal WhatsApp no tiene recargo (mismo precio que Mostrador) y el menú ya trae título y WhatsApp de ejemplo.

## 0.4.1

- **Sin datos reales en el repositorio**: el negocio de ejemplo, los archivos de prueba, el baseline, la carpeta `reference/` y los valores por defecto (dirección, coordenadas, teléfono) ahora son ficticios. Se quitaron las referencias antiguas v2.

- Cambio de numeración: la versión pasa a ser **0.4.1** (reemplaza a 4.0.x) y se muestra en la app («Beta v0.4.1») desde una única fuente: `APP_VERSION`. Cambia a mano en cada versión (package.json, tauri.conf.json, Cargo.toml, schema.js; un test verifica que coincidan).
- Proyecto de ejemplo nuevo: **pizzería ficticia** con 6 productos, ingredientes, envases, stock, gastos fijos, canales y proyección (`scripts/pizzeria-data.mjs`, `npm run demo`).
- **Tour guiado**: se abre solo en el ejemplo y se puede repetir en Ajustes › Archivo y respaldo › «Tour guiado», también con tus propios datos.

- Abrir un `.json` de versiones anteriores lo convierte en proyecto y **pide enseguida dónde guardarlo** (ya no queda «sin guardar»).
- Ajustes › Archivo y respaldo: «Dónde está guardado» (ruta, mostrar en carpeta, cambiar ubicación), «Carpeta de proyectos» (escritorio) e «Importar datos» (como proyecto nuevo, o reemplazando los del proyecto abierto con respaldo previo).
- El indicador «Sin guardar» ahora se puede tocar para guardar.

## 4.0.0 — Fase D: instaladores de escritorio (Tauri) y web/PWA

- **Sin CDN**: Chart.js, Leaflet, SheetJS y las fuentes DM Sans / DM Mono van empaquetadas (Leaflet y SheetJS se cargan al primer uso). El build no pide nada a servidores externos.
  El mapa (OpenStreetMap) y la búsqueda de direcciones (Nominatim) siguen necesitando internet: la app avisa y se puede cargar el envío a mano.
- **Tauri** (`src-tauri/`): ventana nativa, plugins `fs`, `dialog`, `store`, `updater`, `process`, `opener`. Abrir/guardar `.sahten` con los diálogos del sistema, guardado atómico
  (temporal + renombrado), respaldos **junto al proyecto** (`.<nombre>.backup-…sahten`), configuración de la app en el store de Tauri, descargas (CSV, ZIP) con «Guardar como»,
  enlaces y WhatsApp en el navegador del sistema, vista previa y carpeta del menú publicado.
- **Asociación de archivos** `.sahten` (doble clic abre el proyecto; una sola ventana).
- **Actualizaciones automáticas** con el updater de Tauri + GitHub Releases (firmadas con clave propia). Botón «Buscar actualizaciones» en Ajustes › Archivo y respaldo.
- **CI**: `ci.yml` (tests + builds) y `release.yml` (`tauri-apps/tauri-action`: macOS universal `.dmg` + Windows `.msi`/`.exe`, borrador de Release con `latest.json`). Firma de Apple opcional.
- **PWA**: manifiesto, íconos y service worker (la web abre sin internet), mismo código.
- [docs/INSTALACION.md](docs/INSTALACION.md): avisos de Gatekeeper y SmartScreen y cómo abrirla igual, firma opcional (USD 99/año), publicar versiones.
- Menú publicado: los mensajes de WhatsApp ya **no llevan emojis** (`wa.me` los convertía en «�» al redirigir; verificado con un redirect real). Con el menú en vivo, solo se muestran
  las fotos que existen en la carpeta publicada; si una foto no carga, se muestra la inicial del producto.
- Íconos de la app regenerados (logo más grande, legible en 32 px), `.ico` con 6 tamaños, `.icns`, PNG y PWA (maskable).
- QA final: checklist automatizado ([docs/QA.md](docs/QA.md)) y modo oscuro verificado en todos los paneles.
- Tests: 272.

## 4.0.0-alpha.3 — Fase C: online opcional por proyecto (costo $0)

- **Publicar menú** (sin backend): carpeta `index.html` + `menu.json` + imágenes optimizadas (hasta 800 px, JPEG), lista para Cloudflare Pages,
  GitHub Pages o Netlify ([docs/PUBLICAR.md](docs/PUBLICAR.md)). El pedido sale por `wa.me/<número>` con detalle, total, envío por zona y datos del cliente.
  `menu.json` no lleva costos, márgenes ni datos de clientes. La web nueva reemplaza a `Sahten Menu v2.html` (queda en `reference/`).
- **Delivery por zonas compartido** (`src/core/delivery.js`): el Mostrador, el menú publicado y la web usan la misma cuenta (círculo/polígono, envío gratis por monto, mínimo de pedido).
- **Supabase opcional** (`supabase/schema.sql`, [docs/SUPABASE.md](docs/SUPABASE.md)): tablas `stores`, `menus`, `orders` (C.2) y `projects`, `project_ops`, `project_members`,
  `project_invites`, `audit_log` (C.3), con RLS. Probado contra Postgres real (PGlite): visitante anónimo solo lee el menú y crea pedidos;
  los costos solo se leen con funciones que verifican el rol.
- **App**: conectar proyecto (URL, anon key, slug, cuenta), sincronizar menú, pedidos entrantes por Realtime en Mostrador › Delivery con notificación
  (con respaldo por consulta periódica) y el estado del pedido vuelve a la nube. Si la web no tiene conexión, se lo avisa al cliente.
- **Sincronización**: local primero (el `.sahten` siempre se guarda), cola offline con reintentos, conflictos por versión con aviso (mía / de la nube).
- **Roles**: dueño, administrador, encargado (sin costos), cajero, solo lectura. Pantalla «Nube y usuarios»: invitaciones por email, cambio de rol,
  auditoría y vista remota de solo lectura para el dueño.
- **Build sin online**: `SAHTEN_ONLINE=false npm run build` deshabilita la UI de conexión («No disponible en esta versión»). El formato `.sahten` es el mismo.
- **Keep-alive**: GitHub Action diaria para que Supabase gratis no se pause; alternativa Cloudflare D1 + Workers documentada.
- Arreglo: al abrir un proyecto, el menú online y los reportes volvían sin sus valores de fábrica.
- Tests: 236.

## 4.0.0-alpha.2 — Fase B: un archivo por proyecto (`.sahten`)

- **Formato `.sahten`** (JSON, esquema 2): `project`, `settings`, `catalog`, `costs`, `channels`, `stock`, `sales`, `projections`, `online`, `images`, `ui`.
  Ver [docs/FORMATO-SAHTEN.md](docs/FORMATO-SAHTEN.md).
- **`migrate(data)`**: abre `.sahten` de cualquier esquema, el JSON de `collectState()` de v2/v3 y los `Proyeccion_*.json`.
- **Mismo formato con o sin online**: lo que esta versión no conoce (p. ej. `online.supabase`) se conserva al guardar.
- **Sin `localStorage` para datos del negocio**: pedidos, clientes, menú online, tienda, reportes, notificaciones, imágenes (antes IndexedDB) y
  personalización viven en el proyecto. Se reemplazó el selector de «proyectos» (espacios de trabajo) por Abrir / Recientes / Nuevo / Duplicar / Exportar copia.
- **Guardado automático** con espera de 2 s, solo si cambió el contenido, y escritura atómica; indicador «Guardando… / Guardado hace X s / Error».
  File System Access API en Chrome/Edge; descarga e importación manual en el resto.
- **Respaldos**: diario (`.<nombre>.backup-AAAA-MM-DD.sahten`), previo a estrategia/importación (`.pre-estrategia.sahten`) y previo a restaurar.
  Reemplazan el respaldo de estrategia en `localStorage`. Ajustes › Archivo y respaldo: restaurar respaldo de ayer y deshacer la última estrategia, con resumen de diferencias.
- Arranque sin proyecto: pantalla de bienvenida (abrir, nuevo, ejemplo, recientes). «Nuevo» dispara el asistente de configuración.
- **Corrección de v3 — los combos no sobrevivían a guardar/cargar.** Las filas «Pizza Muzzarella x4» / «Pizza Napolitana 1/2» perdían su cantidad: el costo daba 0 en la
  primera carga y otro valor en la segunda (los productos «Tabla para…» cambiaban de precio). Ahora la fracción se convierte a cantidad al migrar.
- **Proyecto de ejemplo consistente** (`npm run demo`): se parte del demo de v3, se aplican las recetas del Excel y se repite guardar → cargar hasta
  un punto fijo. Las recetas del Excel ya no se aplican «solas» en la primera edición (movían 18 precios del demo).
- Tests: 140+ (formato, migraciones, sesión, respaldos, restauración idéntica byte a byte, app real con el proyecto como archivo).

## 4.0.0-alpha.1 — Fase A: base técnica (sin cambios de comportamiento)

- Vite + `src/`: el HTML/CSS de v3 se conservan; la lógica sale de a poco de `src/legacy/`.
- `src/core/` (cálculo puro): `costs`, `gf` (incluye control mensual), `pricing`, `projection`, `menuEngineering`, `stock`.
- **`computeProjection()` única.** La pantalla de Proyección, el snapshot, el CSV y el PDF ya no repiten la cuenta.
  Antes de calcular normaliza la distribución de canales, así el snapshot y el CSV no dependen de haber abierto la pantalla.
- **Estado único del proyecto.** Las globales de v3 son accesores sobre `state`. Comisión global y dólar viven en el estado
  (antes se leían de inputs del DOM).
- **Registro de módulos con eventos** (`onPanelShow`, `afterRender`, `beforeRender`, `around`, `onDataChanged`) en lugar de los
  wrappers en cadena sobre `showPanel`, `renderDashboard`, `renderProyeccion`, `renderMostrador`, `renderRecipeBody`,
  `renderStock`, `renderProductos`, `renderCostReceta`, `mkChart` y `mostSetTab`.
- i18n mínimo (`t()`, es-AR) para los textos del núcleo.
- Tests con Vitest (95): baseline de precios idéntico a v3 en 6 escenarios, GF mensual, costos, combos, precios, proyección,
  stock, asistente de estrategia y eventos.
