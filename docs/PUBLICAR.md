# Publicar tu menú online (gratis)

Sahten genera una carpeta estática con tu menú. Los clientes arman el pedido y **te lo mandan por WhatsApp** con el detalle,
el total, el envío calculado según la zona y sus datos. Ese modo básico funciona sin servidor.

**Delivery geográfico v2:** al activarlo se necesitan Supabase, la migración y las funciones de validación/rutas. No confirma envíos por WhatsApp como respaldo si la ruta no se pudo validar. Actualizá la carpeta web y la app antes de activar la política nueva. Ver el orden de despliegue y aprobación en [DELIVERY-GEOGRAFICO.md](DELIVERY-GEOGRAFICO.md#8-pendiente-antes-de-activarpublicar).

## 1. Generar la carpeta

1. En Sahten: **Menú Online › Configuración**. Cargá tu número de **WhatsApp** (con código de país) y revisá qué productos y categorías se muestran.
2. En **Ajustes › Negocio › Tienda online y delivery** dejá cargada la dirección del local, las **zonas de delivery**, el envío gratis desde cierto monto y los medios de pago.
3. **Menú Online › Configuración › Publicar menú**.
   - En Chrome/Edge te pide elegir una carpeta y escribe los archivos ahí.
   - En otros navegadores descarga un `.zip`: descomprimilo.
4. Con **Vista previa** podés ver cómo queda antes de subirlo.

La carpeta contiene:

| Archivo | Para qué |
|---|---|
| `index.html` | la página del menú (con el cálculo de zonas y el mensaje de WhatsApp adentro) |
| `menu.json` | productos, precios, zonas, medios de pago y colores de tu marca. **No incluye costos ni márgenes** |
| `img/` | imágenes optimizadas (hasta 800 px, JPEG) |
| `menu/`, `delivery-y-retiro/`, `catering/`, `nuestra-historia/` | páginas propias para buscadores y asistentes de IA (solo con *Dirección pública de la web* y el sitio encendido) |
| `robots.txt`, `sitemap.xml` | para buscadores; el sitemap lista todas las páginas |
| `favicon.*`, `apple-touch-icon.png`, `site.webmanifest`, `brand/` | íconos e imagen para compartir el link (solo con *Kit de imágenes de marca*; ver [brand/sahten/README.md](brand/sahten/README.md)) |

Guía de SEO, GEO y AEO del negocio: [SEO-GEO-AEO.md](SEO-GEO-AEO.md).

Sin conexión con Supabase, cada vez que cambies precios, productos, fotos o zonas, **volvé a publicar** y subí los archivos de nuevo. Con Supabase y la configuración de fotos, **Sincronizar menú** sube también las imágenes; la web debe republicarse una vez al actualizar a 0.4.8 (ver [SUPABASE.md](SUPABASE.md#fotos-en-la-nube-desde-048)).

## 2. Subirla a un hosting gratis

### Cloudflare Pages
1. Creá una cuenta en <https://pages.cloudflare.com> y elegí **Create a project › Direct Upload**.
2. Poné un nombre (será `tu-nombre.pages.dev`) y arrastrá la **carpeta** (o el contenido del zip).
3. **Deploy**. Para actualizar: **Create new deployment** con la carpeta nueva.

### Netlify
1. Entrá a <https://app.netlify.com/drop>.
2. Arrastrá la carpeta. Te da una dirección `https://….netlify.app`; podés cambiarle el nombre en **Site settings › Change site name**.
3. Para actualizar: **Deploys › Drag and drop** de nuevo.

### GitHub Pages
1. Creá un repositorio público en GitHub y subí los archivos (**Add file › Upload files**).
2. **Settings › Pages › Build and deployment › Deploy from a branch › main / (root)**.
3. A los minutos queda en `https://tu-usuario.github.io/tu-repositorio/`.

## 3. Probar el pedido

Abrí tu dirección en el celular, armá un pedido de prueba y mandalo: tiene que abrirse WhatsApp con el mensaje armado.
Probá una dirección dentro y otra fuera de tus zonas: la de afuera no deja pedir delivery (sí retiro).

## Dominio propio (opcional)

Los tres hostings permiten conectar un dominio (`menu.tulocal.com`) desde su panel, sin costo del hosting.

## ¿Querés recibir los pedidos dentro de Sahten?

Con **Supabase** (plan gratis) los pedidos entran en tiempo real a Mostrador › Delivery y el menú se actualiza solo, sin volver a subir archivos.
Ver [SUPABASE.md](SUPABASE.md). Publicás igual la carpeta, pero con la conexión cargada: si el cliente no tiene internet, la web se lo avisa.


## Un solo sitio: portada + menú (editor por secciones)

En **Menú Online › Sitio web** armás la página completa de tu negocio **por módulos**. Cada sección es una tarjeta que podés **encender o
apagar**, **mover** (arrastrando ⋮⋮ o con ▲▼) y **editar**; a la derecha ves la **vista previa real** de la página (escritorio o celular).

| Sección | Qué lleva |
|---|---|
| Portada | título, bajada, botón, hasta 4 destacados y foto de fondo opcional |
| Favoritos | tus productos con ⭐ (con foto y descripción) |
| Menú y pedido | la carta con categorías y el carrito (siempre está) |
| Cómo funciona | hasta 4 pasos |
| Nuestra historia | texto, foto y un destacado opcional (una palabra y su significado) |
| Cinta de texto | una franja con tu lema que se desplaza |
| Reseñas | hasta 9 |
| Catering y eventos | texto y datos de cobertura (zona, anticipación…) |
| Delivery y retiro | horarios; zonas, mínimo y envío gratis salen de Ajustes › Negocio › Tienda online y delivery |
| Preguntas frecuentes | hasta 12 |
| Contacto y pie | dirección, WhatsApp, Instagram |

Cada producto puede llevar una **descripción corta** (el lápiz ✎ en Menú Online › Menú). Con el interruptor general apagado se publica
solo el menú. Cada negocio (proyecto) tiene su propio sitio: al volver a **Publicar**, se actualiza.

## Dónde alojarlo: opciones

| Opción | Costo | Notas |
|---|---|---|
| **Cloudflare Pages** (recomendada) | Gratis | Ancho de banda sin límite, rápido, dominio propio fácil |
| **Netlify** | Gratis | Arrastrar y soltar; 100 GB/mes en el plan gratis |
| **GitHub Pages** | Gratis | Se actualiza desde un repositorio; solo sitios estáticos |
| **Firebase Hosting** | Gratis hasta cierto uso | Requiere instalar su herramienta |
| **Vercel** | Gratis | El plan gratis es solo para uso **no comercial**: no sirve para un negocio |
| **Hosting tradicional** | ~US$2-5/mes | Subís por FTP; a veces incluye dominio y correo |

Un **dominio propio** (por ejemplo `tunegocio.com`) cuesta ~US$10 al año; en Cloudflare se compra al costo. Con Cloudflare Pages podés
usar una dirección gratis `algo.pages.dev` y sumar el dominio después.

## Tienda independiente y logo propio

En **Menú Online › Sitio web** podés cargar el **Logo de la tienda** (SVG, PNG, JPG o WebP, hasta 2 MB), cambiarlo o quitarlo. Se guarda con el contenido del proyecto, conserva transparencia y proporciones y tiene prioridad sobre el logo del kit. En la sección **Portada** podés cargar un **Logo de la portada** independiente; si lo dejás vacío, se usa el logo de la tienda. No cambia el logo de la aplicación. La opción «Usar el mismo color que el texto del encabezado» permite mostrarlo en un solo color; se recomienda un archivo con fondo transparente.

Activá **Abrir tienda en una página independiente** para que la carpeta incluya `pedir/index.html`. La portada dirige sus botones a `pedir/`; los favoritos llevan a su categoría. La tienda conserva el mismo carrito, entrega, retiro y conexión de pedidos. Si ya tenés una web con tu diseño, agregá un enlace a `https://tudominio.com/pedir/` (o al dominio donde alojaste esta carpeta). No hace falta importar tu HTML/CSS en Sahten. Subí también `menu.json`, imágenes y archivos de marca: no alcanza con subir solo `pedir/index.html`.

En este modo, los productos, precios y condiciones de venta siguen actualizándose desde la nube, mientras el diseño y contenido del sitio son los de la carpeta publicada. Los cambios visuales requieren volver a generar y subir la carpeta. La vista previa permanece dentro del editor y no envía pedidos reales.

«Publicar menú» sigue exportando una carpeta o ZIP; no sube automáticamente al hosting. La publicación directa puede conectarse a un proveedor con autorización por negocio y estado de progreso, pero esa conexión aún no está implementada.

La tienda independiente conserva la barra de navegación y el logo configurado. «Menú» identifica la página actual y «Mi pedido» muestra la cantidad de productos; los otros enlaces vuelven a las secciones de la portada. En pantallas chicas se agrupan en «Secciones».
