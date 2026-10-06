# Publicar tu menú online (gratis)

Sahten genera una carpeta estática con tu menú. Los clientes arman el pedido y **te lo mandan por WhatsApp** con el detalle,
el total, el envío calculado según la zona y sus datos. No hace falta servidor ni base de datos.

## 1. Generar la carpeta

1. En Sahten: **Menú Online › Configuración**. Cargá tu número de **WhatsApp** (con código de país) y revisá qué productos y categorías se muestran.
2. En **Ajustes › Tienda Online** dejá cargada la dirección del local, las **zonas de delivery**, el envío gratis desde cierto monto y los medios de pago.
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

Cada vez que cambies precios, productos o zonas, **volvé a publicar** y subí los archivos de nuevo.

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
| Delivery y retiro | horarios; zonas, mínimo y envío gratis salen de Ajustes › Tienda Online |
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
