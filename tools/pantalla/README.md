# Videos para la pantalla del local

Videos verticales **1080 × 1920 (9:16), 30 fps, H.264**, pensados para una tele de 32" en vertical. Cada video cierra en loop exacto (el último cuadro empalma con el primero) y `00-loop-completo.mp4` los encadena todos.

| Archivo | Contenido | Por qué |
|---|---|---|
| `01-10-off` | 10 % en productos pagando en efectivo o transferencia | Beneficio publicado para local y web. Usa las dos fotos reservadas para el banner del 10 %. |
| `02-lunes-a-miercoles` | Hasta 15 % en platos seleccionados, lunes a miércoles | Campaña publicada `weekly-meals`. |
| `03-tablas-fin-de-semana` | Hasta 15 % en tablas, 2.º y 3.er viernes y sábado | Campaña publicada `central-tables`. |
| `04-pedi-online` | Primera compra web (hasta 15 %) y segunda (hasta 20 %), con QR | Programas publicados `first_online` / `second_online`. El QR lleva UTM para medir en GA4. |
| `05-los-mas-pedidos` | Shawarma de Carne (N.º 1), Mixto, Pollo, Supermix | Ranking por unidades vendidas. |
| `06-para-compartir` | Tabla para Compartir, Promo Compartir Clásico, Compartir para Dos | La mayor ganancia por unidad, con poca venta: conviene empujarlas. |
| `07-sumale` | Hummus, Falafel, Tabulé y postres | Complementos con buen margen y productos foco de la guía comercial. |

**En pantalla nunca se muestran costos ni márgenes:** se usan solo para elegir qué productos mostrar.

## Cómo regenerar (por ejemplo, si cambia un precio)

```bash
pip install qrcode
NODE_USE_ENV_PROXY=1 node tools/pantalla/render.mjs            # todos (~17 min)
NODE_USE_ENV_PROXY=1 node tools/pantalla/render.mjs --only 05-los-mas-pedidos
NODE_USE_ENV_PROXY=1 node tools/pantalla/render.mjs --stills   # cuadros de control, rápido
```

`NODE_USE_ENV_PROXY=1` solo hace falta detrás de un proxy (entorno en la nube). Requisitos: Node 22, Playwright con Chromium y ffmpeg.

- Los **precios, fotos y disponibilidad** se leen del menú publicado en Supabase, con la clave publicable de la app y en solo lectura.
- El render **se detiene** en cualquiera de estos casos, para no anunciar algo que no corresponde:
  - una campaña ya no está publicada para el local;
  - un producto está pausado o fue retirado;
  - un producto con precio en pantalla no tiene precio publicado.
- Los textos de las promociones están en `videos.mjs`. Si una promoción cambia en Sahten, hay que actualizar el texto ahí y volver a renderizar.
- Solo se muestran productos publicados en la web (decisión del dueño): la Promo Fatay (3U) y la Tabla para Celebrar quedan afuera aunque figuren en campañas del local.
- Las fotos se descargan en `fotos/` y los videos se generan en `out/`. Ninguna de las dos carpetas se sube al repositorio.

## Diseño

- Lenguaje visual de sahten.online:
  - colores verde `#235328`, naranja `#EF8E23`, crema `#FFF4D6` y verde claro `#E3F1DD`;
  - titulares en DM Sans 900 con una palabra en Lora itálica;
  - etiqueta verde con la caligrafía صَحْتَيْن.
- Ornamentos propios:
  - patrón de estrella de ocho puntas, tenue y solo en los bordes, para que el centro quede limpio y se lea bien;
  - rosetón giratorio;
  - fotos enmarcadas en arco ogival;
  - cortinas de transición con borde de arcos.
- Textos cortos para leer a distancia: nombre, una línea y precio. Sin descripciones largas.
- Un único reloj (`seek(t)`) anima todo, así que cada cuadro es determinista.

## v2 (26/11/2026): marcos por tipo de promoción, cómo comprar y delivery

| Archivo | Marco |
|---|---|
| `01-10-off` | Tipografía cinética 3D («10 %» en capas) y las fotos del banner en ventanas de estrella |
| `02-lunes-a-miercoles` | Tira semanal L–D con L-M-M encendidos; los platos caen por turno |
| `03-tablas-fin-de-semana` | Calendario del mes (sin fechas inventadas) con el 2.º y 3.er viernes y sábado marcados |
| `05-los-mas-pedidos` | Podio: número gigante detrás del plato recortado que flota con sombra |
| `06-para-compartir` | Arco ogival (único video que lo usa) |
| `07-sumale` | Órbita: los complementos alrededor de un «+» |
| `08-como-comprar` | Celular 3D con capturas reales de sahten.online (`v2/capturar-web.cjs`, sin confirmar pedidos) |
| `09-delivery` | Mapa real (MapLibre + OpenFreeMap) con la ruta real (OSRM, `v2/ruta.json`), moto, anillos de 2–8 km y barrios |

- **Recortes:** los platos recortados están en `recortes/` (rembg `isnet-general-use`, bordes suavizados). Si un recorte no queda limpio, se usa la foto entera en un plato circular, como pasa con el Shawarma Mixto y el de Pollo.
- **Video 09:** dice «Envío gratis*», con la aclaración al pie «Según zona y monto del pedido». Muestra el horario de delivery publicado (lunes a sábado, de 18 a 22 h) y los barrios confirmados por el dueño.
- **Comandos:** `tools/pantalla/render-v2-promos.sh`, `node tools/pantalla/v2/render-howto.mjs` y `node tools/pantalla/v2/render-delivery.mjs`. Los tres admiten `--stills` (salvo el `.sh`).
- **Hosts que tiene que permitir la red:**
  - `tiles.openfreemap.org` y `router.project-osrm.org`, para el mapa y la ruta;
  - `dtnbokdrxojdcvguuidk.supabase.co`, para las fotos;
  - `sahten.online`, para las capturas.

### Decisión del dueño (26/11, tarde)

- **Sin platos recortados**: los recortes automáticos mostraban errores. Todos los platos van con la foto entera en marcos limpios (arco o círculo). Los marcos v2 que usan recortes (`podium`, `weekstrip`, `calendar`, `orbit`, `kinetic`) quedan en `stage.html` pero **no se usan** en el guion.
- **Se vuelve al diseño v1** de las promos, con **ritmo de lectura**:
  - escenas más largas;
  - reloj global ×1,3 (`PACE` en `videos.mjs`), así que un plato queda ~5,5 s y un tablero ~8 s;
  - «Cómo comprar» con ×1,5 y «Delivery» con ×1,35.
- Render de los 9 videos en paralelo, de a 4: `tools/pantalla/render-todo.sh`. Orden del loop: 01, 05, 02, 08, 06, 03, 09, 07, 04.

### Tele del local y moto (26/11)
- **Orientación:** la tele está girada con el **lado derecho hacia abajo**. Hay que reproducir `00-loop-completo-tele-1920x1080.mp4`, que lleva el loop pre-girado 90° en sentido antihorario (`transpose=2`) y se ve derecho en esa tele. Lo generan `render-todo.sh` y `render-delivery-y-loop.sh`.
- **Moto** (`v2/moto.js`): scooter de reparto ilustrado en los colores de marca.
  - Ruedas con rayos que giran.
  - Escudo, faro con brillo y humo del escape.
  - Repartidor con casco naranja y campera crema.
  - Caja térmica con volumen y la estrella.
  - La animación depende solo de `t`.
