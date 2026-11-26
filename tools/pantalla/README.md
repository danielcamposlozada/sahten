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
