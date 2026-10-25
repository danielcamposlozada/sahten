# Cómo actualizar la tienda de Sahten

Guía para el dueño · verificada el 25/10/2026 con app 0.4.23/0.4.24 y sahten.online conectada a Supabase.

## Elegí el recorrido

| Cambiaste… | Qué hacer para que tenga efecto |
|---|---|
| Precios, productos visibles, tarifas, mínimos, beneficios u horario de delivery | Guardar → **Nube y usuarios → Sincronizar menú** → esperar «Completado» → recargar la tienda |
| Diseño, logos, portada, navegación, pie, textos o preguntas frecuentes | Guardar → **Menú Online → Configuración → Publicar menú** → subir la carpeta completa a Cloudflare → comprobar la web |
| Instalaste una versión con cambios de la tienda | Volver a generar y subir la carpeta para incorporar esa plantilla |
| Querés actualizar también las páginas estáticas de información/SEO y el catálogo de respaldo | Volver a generar y subir la carpeta, aunque ya hayas sincronizado los precios |

**Guardar proyecto**, **Sincronizar ahora** y **Sincronizar menú** hacen cosas diferentes. Guardar conserva tu trabajo; Sincronizar ahora actualiza la copia del proyecto; Sincronizar menú publica el catálogo comercial que usa la tienda conectada. No hace falta editar un JSON a mano.

## A. Cambiar precios

1. Abrí el proyecto **SAHTEN Gastronomia Arabe**. Comprobá que sea el proyecto correcto antes de publicar.
2. Entrá a **Menú** y abrí el detalle del precio del producto. Usá **Ajustar precio y bloquear costos por canal**. La etiqueta **Precio fijado** también abre el editor cuando ya existe un valor fijado.
3. Elegí el canal que usa la tienda online. Revisá su nombre: cambiar otro canal no cambia automáticamente el precio online.
4. Para imponer un importe, elegí **Fijar precio para editar**, escribí el precio final y guardá. Para volver a la fórmula, usá **Volver a automático**. Los candados de costos son independientes.
5. Guardá el proyecto. En **Menú Online**, revisá el precio y que el producto esté visible.
6. Seguí el recorrido C para sincronizar.

La etiqueta interna «Precio fijado» no se muestra al comprador. Los cambios rigen desde el guardado; las ventas anteriores conservan sus valores históricos.

## B. Cambiar envíos y beneficios

1. Entrá a **Ajustes → Negocio → Tienda online y delivery → Delivery geográfico e incentivos**.
2. Seleccioná la zona en la lista o en el mapa. Revisá tarifa, mínimo y umbrales de beneficios. Un beneficio tiene dos valores: **desde qué subtotal** y **cuánto se cobra de envío** al alcanzarlo.
3. Conservá o ajustá conscientemente las opciones de zona habilitada y autorización. Una zona pausada no admite entregas.
4. Revisá **Usar nuevas zonas en este proyecto**, **Activar beneficios de envío** y **Combinar beneficio de envío con descuento por pago**, según lo que quieras ofrecer.
5. Revisá el horario de delivery y las excepciones de fechas especiales. No cambies el horario solo para hacer aparecer una promoción.
6. Usá **Previsualizar y validar**. Corregí cualquier error de zonas antes de guardar.
7. Elegí **Guardar configuración**, guardá el proyecto y seguí el recorrido C.

Los umbrales usan los productos **después del descuento**, sin sumar el envío. Ejemplo ilustrativo con la configuración confirmada: productos por $40.000 con 10 % por efectivo quedan en $36.000; alcanzan el umbral gratuito de Zona 2 ($35.000), si la validación del recorrido mantiene esa zona efectiva y el pedido cumple las demás condiciones.

El radio y el recorrido por calles pueden dar zonas diferentes. El servidor confirma la tarifa efectiva; una dirección cercana en línea recta puede requerir una zona superior por su recorrido.

## C. Sincronizar el catálogo con la web

1. Entrá a **Nube y usuarios**. Confirmá estado **conectado** y tienda **sahten**.
2. Pulsá **Sincronizar menú**. No es el botón «Sincronizar ahora» de la copia del proyecto.
3. Revisá el nombre del proyecto, la tienda y la cantidad de productos. El 25/10/2026 se publican **36 productos**; esa cantidad puede cambiar si vos modificás el catálogo.
4. Confirmá solo si son los datos que querés publicar. La sincronización reemplaza el catálogo visible.
5. Esperá **Actualizando el menú de la web → Completado**. Si falla, el cambio no está confirmado: revisá la conexión y el mensaje antes de volver a intentar.
6. Abrí o recargá <https://sahten.online/pedir/>. Comprobá un producto modificado y su total. Una página que ya estaba abierta no recibe instantáneamente los cambios de precio.

Con esta conexión, no necesitás subir toda la carpeta a Cloudflare para que el checkout tome precios, tarifas o mínimos nuevos. Las fotos requieren terminar su subida; está disponible «Actualizar fotos automáticamente en la web», que también sincroniza el menú completo cuando cambiás una foto. No equivale a publicar automáticamente cada edición de precio.

## D. Cambiar diseño o textos y subir la carpeta completa

1. Actualizá la app antes de generar, para que la exportación incluya la plantilla más reciente. Hacé una copia de tu archivo `.sahten` antes de cambios grandes.
2. En **Menú Online → Sitio web**, editá portada, logo de navegación, símbolo de portada, textos, secciones o pie. Revisá con **Vista previa**.
3. Guardá. Si también cambiaste condiciones comerciales, sincronizá el menú según C.
4. En **Menú Online → Configuración**, elegí **Publicar menú** y una carpeta nueva y vacía. Según el entorno, la app guarda una carpeta o descarga un ZIP.
5. Revisá que la carpeta contenga `index.html`, `menu.json`, `pedir/` y el resto de subcarpetas generadas. Si hay `img/` o `brand/`, incluilas. No subas el archivo del proyecto `.sahten`.
6. Entrá a Cloudflare con tu cuenta: **Workers & Pages → sahten-menu → Create deployment**.
7. Elegí **Production**. Subí el ZIP completo con **file**, o la carpeta generada con **folder**. El `index.html` del sitio debe quedar en la raíz de los archivos cargados, sin una carpeta envolvente adicional.
8. Esperá que termine la carga y pulsá **Save and deploy**. Esperá **Success**. Generar la carpeta en la app, por sí solo, todavía no la sube.
9. Abrí <https://sahten.online/> y <https://sahten.online/pedir/>. Recargá y comprobá logo, navegación, fotos, precios y el cambio solicitado. Si dudás del caché, probá una ventana privada.

Esta publicación actualiza también la copia estática del catálogo y las páginas informativas/SEO. Conservá la carpeta anterior como respaldo. Cloudflare mantiene despliegues previos; volver a uno anterior no revierte automáticamente el catálogo ya sincronizado en Supabase.

## Cómo comprobar el beneficio de delivery

- Desde 0.4.25, web y Mostrador sugieren direcciones al escribir calle y altura, después de una pausa breve. Elegí la opción correcta. Si no aparece, agregá la localidad. Solo si falla la consulta o no hay resultados aparece **Buscar de otra forma**. La sugerencia por sí sola no confirma un envío.
- Elegí **Delivery**, dentro del horario de reparto, buscá y seleccioná una dirección válida. El motor necesita validar zona y recorrido.
- Si cumple las condiciones, aparece la tarjeta verde clara con el costo, el próximo beneficio y el progreso. Al agregar productos o cambiar el medio de pago, se recalcula.
- En retiro no se muestra incentivo de envío. Fuera de horario aparece el aviso de cierre, no un beneficio disponible.
- Si la zona exige autorización, solicitá la revisión del local; no se confirma automáticamente solo por alcanzar un umbral.
- Comprobá importes sin pulsar «Enviar pedido» o «Pagar» si no querés crear una operación.

## Configuración confirmada al 25/10/2026

| Zona | Tarifa base | Mínimo neto | Beneficio de envío | Estado |
|---|---:|---:|---|---|
| 1 | $1.500 | $17.000 | Gratis desde $25.000 | Activa; requiere autorización |
| 2 | $3.000 | $25.000 | Gratis desde $35.000 | Activa |
| 3 | $4.000 | $35.000 | $2.000 desde $42.000; gratis desde $50.000 | Activa |
| 4 | $5.500 | $45.000 | $2.750 desde $62.000; gratis desde $80.000 | Activa |
| 5 | — | — | No disponible mientras esté pausada | Pausada |
| Excepcional | — | — | No disponible mientras esté pausada | Pausada |

Beneficios habilitados y combinables con el descuento de pago. Horario argentino: lunes a jueves 18–22; viernes y sábado 18–23; domingo cerrado. Son tus valores actuales, no valores universales de la aplicación.

**Pendiente por decisión del dueño:** los textos libres de FAQ y «Delivery y retiro» todavía mencionan mínimo $15.000 y gratis desde $45.000. No reflejan esta tabla. El cálculo del pedido usa las reglas activas; corregir esos textos requiere edición y publicación completa. El dueño eligió dejar esa corrección para después el 25/10/2026.

## Si no ves el cambio

| Lo que ves | Qué revisar |
|---|---|
| Guardaste, pero la web conserva el precio | Proyecto/canal correctos → Sincronizar menú → Completado → recargar |
| El precio cambió en la tienda, pero no en una página informativa | Volver a generar y subir la carpeta completa |
| El diseño no cambió | El ZIP se generó, pero falta subirlo; o elegiste Preview en lugar de Production |
| No aparece la barra de envío | Delivery seleccionado, horario abierto, dirección validada, zona habilitada y beneficios activos |
| La cotización se invalida al editar | Es correcto: cantidad, pago o dirección pueden cambiar mínimo, tarifa y autorización |
| Faltan fotos o subpáginas | Revisar carga completa, subcarpetas e imágenes; no subir solo index.html |

La publicación directa a Cloudflare desde un único botón de la app todavía no está implementada. El tutorial explica el flujo disponible; no exige entregar claves ni editar archivos técnicos.
