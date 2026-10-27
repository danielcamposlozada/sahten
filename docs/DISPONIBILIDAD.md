# Recetas, productos y tienda online

Versión 0.4.27 publicada y verificada el 26/10/2026. Las dos migraciones de disponibilidad se aplicaron y registraron en Supabase; sahten-payments v9 y sahten-delivery v6 están activos. Web e instaladores Windows/Mac públicos, con actualizador y firmas verificados. Actualizá cada equipo a 0.4.27 para usar los controles. Detalle del despliegue en docs/SEO-GEO-AEO.md.

## Las tres secciones

- **Recetas** (antes Costo Receta): incluye internas, borradores y subrecetas. Una receta interna no aparece en Productos, Mostrador ni la lista de Tienda online.
- **Productos** (antes Menú): precios y disponibilidad de venta. «Pausar ventas» afecta Mostrador y web; no cambia precios, costos, stock ni ventas históricas.
- **Tienda online** (antes Menú Online): publicación de cada producto, configuración de la página y exportación de sus archivos. Su interruptor muestra u oculta solamente en la web; no pausa Mostrador.

Habilitar una receta como producto requiere confirmación. El producto queda inicialmente **pausado y fuera de la tienda**. Después se reactivan sus ventas y se decide si publicarlo online. Los productos nuevos creados desde Productos y sus copias también comienzan pausados y fuera de la web; se conserva el estado de los productos existentes.

## Pausar ventas

El aviso ofrece **Por hoy**, **Hasta una fecha y hora** y **Hasta que lo vuelva a activar**. No pide motivos. «Por hoy» vence al comienzo del próximo día (00:00) en el huso indicado; el aviso muestra fecha y hora exactas. El huso se toma de la configuración horaria del negocio y, si no existe, del equipo (se muestra explícitamente).

Un producto pausado sigue visible en gris, con «No disponible», sin permitir agregarlo al pedido. Si ya estaba en el carrito, se identifica y bloquea la confirmación hasta quitarlo o reactivarlo. Una receta que vuelve a uso interno se retira de las pantallas de venta y se prepara su retiro de la web, respetando las operaciones pendientes si no hay conexión.

El vencimiento se evalúa con la misma función pura en app, web y servidor de pedidos/pagos; **no depende de dejar la app abierta ni de cron**. La web y los servidores calculan el estado efectivo a partir de `paused` y `resumeAt`. La web revisa estados al volver a la pestaña y cada 30 segundos mientras está visible; el vencimiento visual se comprueba cada 15 segundos. Una página sin conexión conserva su copia, pero el servidor verifica nuevamente al confirmar.

## Estados separados de los datos del catálogo

Las peticiones de interruptor llevan solo tienda, identificador de producto y estado. La pausa agrega opcionalmente la fecha de reactivación. **No envían precios, fotos, textos, clientes o pedidos**. Las colas persistentes se aíslan por proyecto, servidor y tienda; agrupan clics y conservan pendientes al cerrar. Los fallos de conexión se reintentan; los permisos o un producto que nunca se publicó requieren revisión. Un error de un producto no bloquea los demás. Una pausa temporal que venció desconectada se descarta sin reactivar decisiones más recientes de otros equipos.

La visibilidad guarda una copia privada del último producto publicado para poder volver a mostrarlo sin publicar un precio que se estaba editando. Un producto nuevo necesita una primera publicación de catálogo con su precio revisado. Las publicaciones completas toman las pausas vigentes del servidor y no las anulan.

Las recetas y los precios se siguen guardando en el archivo y compartiendo con el proyecto. Los estados publicados son independientes; una copia antigua del proyecto no publica por sí sola esos datos en la tienda. Solo dueño/administrador cambian estados de productos; el resto del equipo puede leer los estados actuales según sus permisos.

## Los botones de nube

- **Actualizar proyecto entre equipos**: sube o descarga recetas, costos, clientes, pedidos, ajustes y fotos según el rol. No publica el catálogo. Detecta cambios en ambos lados y pide resolver el conflicto antes de reemplazar una versión.
- **Publicar catálogo en la tienda**: reemplaza productos, precios, fotos y condiciones que ven los clientes. No descarga la copia de otro equipo ni reemplaza sus costos o pedidos. Conserva pausas vigentes y mantiene la confirmación previa.
- **Exportar archivos de la web**: genera la carpeta/ZIP de diseño, logos, páginas, respaldo del catálogo e imágenes para subir a Cloudflare. No sube la carpeta al hosting automáticamente.

Los dos botones de nube incluyen ayuda desplegable y descripción. La opción preexistente de publicación automática al cambiar fotos está nombrada explícitamente: también publica el catálogo completo, incluidos precios y textos. Iniciar sesión o abrir el proyecto ya no programa una publicación completa por sí solo.

## Orden del despliegue (completado para Sahten)

1. Revisar y aplicar `supabase/migrations/20261026_menu_availability.sql`. Crea tablas privadas, RPC de estados y protecciones; no cambia precios ni estados de productos existentes por sí sola.
   Aplicar también `20261027002342_published_pause_guard.sql` para respetar pausas del catálogo importado antes de conectar el proyecto; conserva el estado privado como prioritario. Ambas migraciones ya están registradas en el servidor de Sahten.
2. Desplegar **sahten-payments** y **sahten-delivery** con la validación compartida de pausa. El servidor de Mostrador consulta el estado reciente aunque la copia del proyecto esté atrasada. La migración también protege los pedidos web antiguos que entran por REST.
3. Generar y publicar la carpeta web nueva: las versiones anteriores no saben representar la pausa en gris.
4. Publicar la app con sus nuevos controles. Hasta actualizar el servidor, el cambio queda pendiente con una explicación; nunca se reemplaza el catálogo completo como respaldo de un interruptor. La app se publica creando la etiqueta `v0.4.27` (el workflow Release arma los instaladores y el `latest.json` del actualizador y los publica solos): se hace después de los pasos 1 a 3 y con autorización del dueño, porque desde ese momento los equipos reciben la actualización.
5. Para una comprobación operativa en el negocio, acordar un producto con el dueño y revisar pausa, bloqueo, reactivación y otro equipo. No se alteraron productos comerciales ni se crearon pedidos/pagos durante esta publicación. Los casos de estado, permisos y vencimiento se cubrieron localmente con datos ficticios; en producción se comprobaron migraciones, permisos, servicios y conservación exacta del catálogo.

### Cómo deshacer la migración

La migración solo agrega: un esquema privado (`sahten_catalog_private`) con dos tablas, funciones y dos disparadores. No borra ni modifica datos existentes al aplicarse, y con las tablas vacías los disparadores dejan pasar menú y pedidos sin cambios. Los dos disparadores están en rutas de producción, así que si algo falla al publicar el menú o al crear pedidos, lo primero es quitarlos:

```sql
drop trigger if exists sahten_menu_availability on public.menus;
drop trigger if exists sahten_order_sales_availability on public.orders;
```

Con eso la tienda y los pedidos vuelven a funcionar como antes; las pausas dejan de aplicarse en la base hasta restaurarlos (los servidores de pagos y delivery siguen comprobándolas). Los productos ocultos con el interruptor reaparecen en la próxima publicación completa. Las tablas pueden quedar sin uso; no hace falta borrarlas.

## Validación de esta preparación

El 26/10/2026 pasaron 644 pruebas en 69 archivos, compilación, scripts clásicos, revisión de versiones y diferencias. Las pruebas de base de datos ejecutan la migración en PostgreSQL local y comprueban permisos, tienda, restauración del producto publicado y bloqueo de pedidos pausados. Chrome real comprobó el aviso de las tres duraciones y las tarjetas grises sin compra en Mostrador y web con productos ficticios. La validación productiva y el estado de la web e instaladores se registran en docs/SEO-GEO-AEO.md. No se simularon pausas sobre productos comerciales ni se crearon pedidos reales.
