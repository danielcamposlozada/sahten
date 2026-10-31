# Kit de marca de Sahten

Imágenes de marca para la web publicada, Google Business Profile y redes. **Fuente de verdad: `source/`.** Todo lo de `export/` se regenera con
`python3 scripts/build-brand-kit.py` (necesita `pip install cairosvg pillow`); no se retoca a mano.

## Reglas de marca (no negociables)

- **Colores**: verde `#235328`, naranja `#EF8E23`, crema `#FFF4D6`. Salen del panel aprobado por el dueño (`source/panel-variantes.svg`).
- **Combinaciones confirmadas por el dueño el 30/10/2026** en su referencia de cuatro cuadrantes. Las letras latinas, la caligrafía árabe y sus signos llevan estos colores; no intercambiarlos ni aplicar filtros monocromáticos al logo completo:

  | Fondo | Letras latinas | Árabe y signos |
  |---|---|---|
  | Verde `#235328` | Crema `#FFF4D6` | Naranja `#EF8E23` |
  | Naranja `#EF8E23` | Verde `#235328` | Crema `#FFF4D6` |
  | Crema `#FFF4D6` | Verde `#235328` | Naranja `#EF8E23` |
  | Verde `#235328` | Naranja `#EF8E23` | Crema `#FFF4D6` |

  Esta confirmación reemplaza la enumeración anterior: **crema-naranja** (letras naranjas y detalles verdes sobre crema) no figura entre las combinaciones aprobadas. Para esta referencia, la forma y disposición correctas proceden de los once trazos sólidos de `source/panel-variantes.svg`, incluidos los cinco signos separados. Conservar todos los trazos y su proporción, sin estirar letras ni usar filtros. Las propuestas del 30/10 usan esos trazos originales del panel; no el wordmark de proporciones diferentes de `source/logo-web-dueno.svg` ni el lockup antiguo.
- **Tipografía de marca: AUDREY.** Solo existe dentro del logo y de su tagline «GASTRONOMÍA ÁRABE», que ya vienen **en curvas** (`source/logo-lockup-gastronomia-arabe.svg`). No hay archivo de fuente en el repo: no escribas texto nuevo «en AUDREY». Para textos sueltos de las imágenes se usa Inter (solo apoyo).
- **El logo no se redibuja ni se recorta.** El ícono cuadrado usa el wordmark completo (el dueño descartó un recorte de las primeras letras). En tamaños chicos (favicon) se usa sin tagline porque no se lee.
- **Árabe siempre con vocales (tashkeel).** Cualquier texto en árabe que se escriba en el sitio, la ficha o las imágenes lleva todas las vocales/signos: por ejemplo صَحْتَيْن, no صحتين. Confirmar la escritura con el dueño antes de publicar.
- Nombre público en todos lados: **SAHTEN Gastronomía Árabe**.

## Qué hay en `export/`

**Advertencia de inventario, 30/10/2026:** los archivos generados existentes todavía proceden del lockup anterior y de su antigua tabla de variantes. Sus nombres no bastan para confirmar que cumplen la referencia actual. No regenerar ni publicar todo el kit como efecto secundario de corregir una propuesta. Las propuestas locales de home/menú del 30/10 usan los trazos originales del panel y la tabla anterior; la migración del generador/kit publicado queda pendiente de un cambio específico con validación.

| Archivo | Uso |
|---|---|
| `favicon.svg`, `favicon.ico`, `favicon-32x32.png` | pestaña del navegador (se publican en la raíz del sitio) |
| `apple-touch-icon.png` (180) | ícono al agregar a la pantalla de inicio en iPhone |
| `sahten-icon-192.png`, `sahten-icon-512.png`, `sahten-icon-maskable-512.png` | manifiesto web / Android (el `maskable` deja margen de seguridad) |
| `site.webmanifest` | nombre, colores e íconos del sitio |
| `sahten-comida-arabe-og-1200x630.png` | imagen que se ve al compartir el link (Open Graph y Twitter/X) |
| `sahten-avatar-1080.png` | foto de perfil de **Instagram, Facebook, WhatsApp Business** y TripAdvisor (entra en el recorte circular) |
| `sahten-gbp-logo-720x720.png` | **logo** de Google Business Profile |
| `sahten-gbp-portada-1920x1080.png` | **foto de portada** de Google Business Profile (16:9) |
| `sahten-facebook-portada-1640x624.png` | portada de Facebook |
| `sahten-caligrafia-crema|naranja|verde-transparente.svg` | **la palabra en árabe sola**, vector ajustado al trazo: se puede escalar a cualquier tamaño (encabezado de la web, sellos, stickers) |
| `sahten-avatar-caligrafia-1080.png` | alternativa de avatar con solo la caligrafía (naranja sobre verde) |
| `sahten-logo-<variante>-con-tagline|sin-tagline-transparente|sobre-fondo.svg` | logos vectoriales de las 4 variantes sólidas, para cualquier uso |

## Cómo llega a la web

«Publicar menú» agrega al sitio los archivos del kit **solo si** en *Menú Online › Sitio web › SEO* el campo **Kit de imágenes de marca** dice `sahten`
y hay *Dirección pública de la web*. Publica en la raíz `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `site.webmanifest` y en `brand/` los
íconos y la imagen para compartir. El `<head>` (íconos, `theme-color`, manifiesto, `og:image` con ancho/alto/texto alternativo, `twitter:image:alt`) y el
campo `logo` del esquema Restaurant los genera `src/online/seo.js` (`brandHeadTags`); los archivos salen de `src/online/brand.js` (datos en
`src/online/brand/sahten.js`, generado). Los tests en `tests/seo.test.js` comprueban que cada etiqueta apunta a un archivo que existe.

**Encabezado de la web**: con el kit activo, la portada (y el encabezado simple si el sitio completo está apagado) muestra la **caligrafía sola** en crema,
incrustada como vector en `index.html` (sin archivo aparte, se ve igual en la vista previa). Si no hay kit, queda la etiqueta de texto con el nombre del negocio.
El editor ahora permite cargar un logo de navegación y otro de portada; sin uno propio se usa el kit o el nombre del negocio.

## Subir a las plataformas (lo hace una persona; no se automatiza)

1. **Google Business Profile › Fotos › Logotipo**: `sahten-gbp-logo-720x720.png`. **Portada**: `sahten-gbp-portada-1920x1080.png`.
2. **Instagram (sahten.ar), Facebook, WhatsApp Business**: `sahten-avatar-1080.png`; Facebook además `sahten-facebook-portada-1640x624.png`.
3. Después de publicar la web, probar el link en <https://developers.facebook.com/tools/debug/> (Facebook/WhatsApp) y pedir «Volver a extraer»: las redes guardan la imagen vieja en caché.

## Corrección del hero y logo propio (23/10/2026)

El dueño entregó `source/caligrafia-completa.svg`, con los seis trazos y caja `0 0 941 255`. El generador anterior tomaba solamente el cuerpo y omitía los cinco signos separados; ahora conserva los seis trazos sin redibujarlos ni recortarlos.

El editor permite cargar un logo propio para la web. Tiene prioridad sobre la caligrafía del kit y puede usar el mismo color que el texto del hero. El nuevo wordmark completo entregado por el dueño se usa solamente en sahten.online, sin reemplazar la marca de la app.

El dueño aclaró que el wordmark completo es para la **barra de navegación**. En el **hero** va únicamente `source/caligrafia-completa.svg`, con sus seis trazos originales y del mismo color que el texto. Ambos logos se guardan por separado.
