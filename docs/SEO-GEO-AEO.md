# SEO, GEO y AEO de Sahten — lo que hay que saber antes de tocar la web

> **Lectura obligatoria** para cualquier agente o persona que modifique la web publicada, los datos SEO, el menú online, las imágenes de marca o los perfiles externos.
> Origen: informe del 23/10/2026 + paquete «Sahten — Paquete GBP, GEO y AEO» (documento en Claude: <https://claude.ai/artifact/PF23DELKs86ZiBTEK9pP2b>).
> Imágenes y marca: [brand/sahten/README.md](brand/sahten/README.md). Prompt para agentes: [PROMPT-AGENTES.md](PROMPT-AGENTES.md).

## 1. Objetivo
Que Google (ficha y buscador), Apple Maps, Bing y los asistentes de IA (Gemini/Ask Maps, ChatGPT, Perplexity, Copilot) encuentren y citen a **SAHTEN Gastronomía Árabe** con datos
correctos y coherentes. Lo que más pesa: datos idénticos en todos lados (NAP), páginas propias con información que nadie más tiene y reseñas.

## 2. Datos confirmados del negocio (fuente: sahten.online al 23/10/2026)
| Dato | Valor |
|---|---|
| Nombre público | **SAHTEN Gastronomía Árabe** (con tildes; no agregar «delivery» ni barrios al nombre en Google: lo toma como incumplimiento) |
| Dirección | General Julio Argentino Roca 1489, Vicente López, Buenos Aires (en Google y la web, escrita igual) |
| Teléfono / WhatsApp | +54 9 11 2393-7295 (el mismo en todos los perfiles) |
| Horarios | Lun–Jue 18:00–22:00 · Vie–Sáb 18:00–23:00 · Dom cerrado. Cargar horarios especiales de feriados |
| Zona de delivery | Belgrano, Núñez, Florida, Vicente López, Olivos, Martínez y La Lucila (~6 km). Mínimo $15.000, envío gratis desde $45.000 |
| Retiro | En el local, Roca 1489 |
| Catering | Mesas árabes para eventos, 48 horas de anticipación |
| Instagram | sahten.ar |
| Sitio | https://sahten.online/ — en Google usar `?utm_source=google&utm_medium=organic&utm_campaign=gbp` (y `utm_content=pedidos` / `menu` en esos botones) |
| Cocina | Árabe, siria. Recetas familiares (la Sitto y María Teresa) |

Textos listos para pegar (descripción de 631 caracteres, productos, publicaciones) están en el documento de Claude de arriba. **No inventar datos**: lo que no está en la tabla va a «Pendientes de confirmar».

## 3. Reglas de marca y contenido
- Árabe **siempre con vocales** (صَحْتَيْن, no صحتين). Confirmar la escritura con el dueño.
- Solo logos con letras sólidas, colores `#235328` / `#EF8E23` / `#FFF4D6`, tipografía AUDREY solo dentro de los vectores. Detalle en [brand/sahten/README.md](brand/sahten/README.md).
- «Sahten» puede ir con tilde en «Gastronomía Árabe»; nombres de platos sin errores de tipeo (Google y las IA copian los nombres tal cual): *Núñez*, *Árabe Clásico*, *tabulé* (una sola grafía).
- No crear una página por barrio con el mismo texto cambiando el nombre. No comprar reseñas ni menciones. No sembrar preguntas en Google (Q&A retirado; lo reemplaza Ask Maps).

## 4. Cómo funciona la web (fuente de verdad)
- `sahten.online` es una **carpeta estática** que genera «Publicar menú» (`src/online/publish.js`) y el dueño sube al hosting. Lo publicado = lo que haya en la app al generar.
- **Nunca escribir directo en Supabase (`menus`, `projects`)** para cambiar el sitio: la próxima publicación lo pisa y puede chocar con la versión local del proyecto. No tocar la tabla `orders` (datos personales de clientes).
- El contenido del sitio se edita en *Menú Online › Sitio web* y se puede importar con un archivo `sahten-sitio` (ver `src/online/site.js`). El archivo con todo lo de esta auditoría (SEO, delivery, catering, 11 preguntas frecuentes) se entregó al dueño para importar.
- Código relevante: `src/online/seo.js` (metadatos, JSON-LD Restaurant/FAQPage/Menu, sitemap, `brandHeadTags`), `src/online/pages.js` (páginas `/menu/`, `/delivery-y-retiro/`, `/catering/`, `/nuestra-historia/`), `src/online/brand.js` (kit de marca), `src/online/web/index.html` (plantilla; `seo.js` va embebido como script sin imports).
- Las páginas nuevas solo salen con *Dirección pública de la web* cargada y el sitio encendido; el sitemap las lista con `lastmod`.

## 5. Estado
**Integrado en `main` mediante el PR #14 (23/10/2026)**
- [x] Páginas propias estáticas con canonical, migas de pan (BreadcrumbList) y Open Graph; `/menu/` con esquema Menu/MenuSection/MenuItem y precios.
- [x] Restaurant enriquecido (cocina, `areaServed`, `sameAs`, `hasMenu`, `logo`) y FAQPage con las mismas preguntas visibles.
- [x] Sitemap con todas las páginas; enlaces «Más información» en el pie de la portada.
- [x] Campos nuevos en el editor: barrios de reparto, otros perfiles públicos, kit de marca.
- [x] Kit de imágenes: favicon, apple-touch-icon, manifiesto, imagen para compartir 1200×630 con medidas y texto alternativo, logo en el esquema.
- [x] Tests en `tests/seo.test.js`.

**Revisión del PR #14 (23/10/2026)**
- Corregidos los enlaces `Restaurant.hasMenu`, `Menu.url` y el sitemap declarado en `robots.txt` para sitios en subcarpetas sin barra final. Cuatro casos de regresión cubren subcarpetas, barra final, parámetros y rutas anidadas.
- Verificado con `npm ci`, `npx vitest run` (448 pruebas, 44 archivos), compilación y comprobación de versiones. Los 33 archivos del kit coinciden con el ZIP entregado por el dueño.
- `npm audit`: cuatro alertas preexistentes en herramientas de desarrollo (Vite/Vitest y sus dependencias); no se cambiaron dependencias en este PR. `npm audit --omit=dev` no informa vulnerabilidades. La actualización de esas herramientas queda pendiente como tarea separada.
- La revisión no modifica Supabase, la web publicada ni perfiles externos. Integrar el código en `main` no actualiza por sí solo la app instalada ni la carpeta del hosting; hace falta una próxima versión de la app con estos cambios y volver a generar/publicar el menú.

**App 0.4.15 publicada (23/10/2026)**
- Instaladores de Windows y macOS disponibles en [la publicación v0.4.15](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.15). El proceso completo de GitHub terminó correctamente y `latest.json` anuncia 0.4.15 con Windows, Apple Silicon e Intel y sus firmas de actualización.
- Verificación local: `npx vitest run` (457 pruebas en 45 archivos), compilación, comprobación de versiones y revisión de scripts clásicos correctas. Formulario de roles revisado en Chrome a 1366 × 768 y 390 × 844 con datos ficticios, sin conexión con Supabase.
- Incluye las páginas SEO, el kit de marca y la corrección de rutas del PR #14, además de las invitaciones con roles más claros y el logo completo de la app.
- No cambia los datos del negocio ni importa automáticamente el JSON de contenido. El dueño debe revisar el archivo antes de importarlo, especialmente la respuesta sobre medios de pago: Mercado Pago continúa en pruebas.
- La web publicada y los perfiles externos permanecen pendientes de publicación y verificación según la lista siguiente.

**Nueva integración web publicada (23/10/2026)**
- Opción genérica de tienda independiente en `/pedir/`, enlazable desde una web propia; la portada dirige a la tienda. Catálogo, carrito, retiro, delivery y conexión de pedidos usan el mismo motor existente.
- Campo «Logo de la tienda» en el editor: SVG, PNG, JPG y WebP (hasta 2 MB), con vista previa, quitar/cambiar y opción del color del texto. Se guarda con el proyecto y los archivos publicados; no cambia el logo de la app.
- El dueño entregó dos SVG completos: la caligrafía con los cinco signos y el wordmark completo. Aclaración posterior: el wordmark completo va en la barra de navegación y el hero usa solamente la caligrafía árabe, del mismo color que el texto. Ambos se guardan por separado. Se conserva el trazo original; símbolo de WhatsApp en los accesos.
- La carpeta preparada incorpora el JSON entregado y conserva el catálogo/precios públicos. La respuesta de pagos no anuncia Mercado Pago, tarjetas ni descuentos activos; las promociones y cobertura no confirmadas se omiten de las nuevas respuestas. Mercado Pago sigue en pruebas.
- Publicar menú continúa generando carpeta o ZIP; la conexión automática al hosting aún no existe. En el modo independiente, el catálogo en vivo no reemplaza el diseño guardado en la carpeta.
- Publicada por autorización del dueño en Cloudflare Pages (`sahten-menu`, despliegue `3dec932c`, 23/10/2026): https://sahten.online/ y tienda https://sahten.online/pedir/. Chrome confirma logo completo en el color del texto, símbolo de WhatsApp, navegación a la tienda y fotos visibles. Trece recursos públicos comprobados por HTTPS devuelven 200; el sitemap incluye las cuatro páginas informativas. No se escribieron datos en Supabase ni se modificaron perfiles externos.
- Validación del código: 468 pruebas en 47 archivos, compilación, scripts clásicos y versiones correctos. Recorrido de compra revisado a 1366 × 768 y 390 × 844 sin enviar pedidos; una compra acreditada nueva de Mercado Pago sigue pendiente y producción no se activa.
- Código del editor y generador en PR #16; el campo nuevo requiere una próxima versión instalada de la app. Antes de volver a generar la web, importar `docs/brand/sahten/sitio-publicado-2026-10-23.json` para conservar este contenido y logo. Publicar desde una versión anterior puede reemplazar la carpeta nueva con el diseño anterior.

**Lo hace el dueño / una persona**
- [ ] Importar el archivo de contenido, corregir nombre de la tienda («SAHTEN Gastronomía Árabe»), erratas del menú y sumar una línea de descripción por plato; poner `sahten` en *Kit de imágenes de marca*; **republicar y subir la carpeta** al hosting.
- [ ] Verificar y completar la ficha de Google (datos del documento), subir logo y portada del kit, productos, 20 fotos, reseñas por WhatsApp.
- [ ] Corregir Linktree, TodoResto/Pedile; alta en Apple Business Connect, Bing Places, TripAdvisor, Foursquare; Search Console y Bing Webmaster Tools (enviar sitemap).
- [ ] Cambiar avatar y portada en Instagram/Facebook/WhatsApp con el kit.

**Pendiente de verificar en vivo (después de republicar)**
- [x] `https://sahten.online/menu/`, `/delivery-y-retiro/`, `/catering/` devuelven 200 y salen en `sitemap.xml` (23/10/2026).
- [ ] Rich Results Test / Schema Markup Validator: Restaurant, FAQPage, Menu sin errores.
- [ ] Depurador de Facebook: la imagen al compartir se ve con el nuevo diseño; favicon y apple-touch-icon cargan.

## 6. Datos a confirmar con el dueño (no asumir)
1. ¿Hay mesas para comer en el local o solo retiro y delivery? (define la categoría principal en Google).
2. ¿Ficha de Google verificada y qué categorías tiene hoy?
3. Horario real frente al continuo que muestra TodoResto.
4. ¿Siguen vigentes el Fatay Hour (18:30–21:30) y el envío gratis en Vicente López?
5. Porcentaje del descuento por pagar en efectivo.
6. Tiempo de entrega y costo de envío por zona.
7. Platos vegetarianos y aptos para celíacos; qué es «Aristilos».
8. Año de apertura; fotos de fachada y equipo.
9. URLs de Instagram, Facebook y TripAdvisor (para `sameAs`).
10. ¿Están en PedidosYa, Rappi u otras apps?
11. Escritura correcta, con vocales, del texto árabe que se quiera mostrar.

## 7. Reglas para agentes
1. Leer este archivo y [brand/sahten/README.md](brand/sahten/README.md) antes de empezar.
2. No publicar, enviar formularios ni cambiar la ficha de Google o perfiles externos sin que el dueño confirme cada cambio (muéstrale el valor antes de guardar).
3. No inventar horarios, precios, promociones ni categorías: usar solo los datos de la tabla del punto 2 o lo que el dueño confirme.
4. Cualquier cambio en `src/online/seo.js` debe seguir sin imports (va embebido en la web) y con tests. Correr `npx vitest run`.
5. Si algo de esto queda desactualizado (datos, URLs, estado), actualizar este archivo en el mismo cambio.

## Ajuste de logos solicitado por el dueño (23/10/2026)
- Hero: solo la palabra árabe del SVG completo original, con sus cinco signos separados y en el color del texto.
- Navegación: el SVG completo de Sahten entregado por el dueño, con sus colores originales.
- El editor permite cargar el símbolo de portada por separado del logo de navegación; ambos viajan en el archivo de contenido.
- Ajuste publicado y verificado en Chrome: despliegue `d4d806e3`, https://sahten.online/. Hero: SVG árabe 941 × 255, blanco como el texto; navegación: SVG completo 1249 × 516, colores originales. Sin desborde en 1366 × 768 y 390 × 844. Las 469 pruebas y la compilación pasan.

- El dueño pidió cambiar únicamente las letras árabes del hero a **#FAF8F5**; se conserva el logo de navegación. Publicado y verificado en Chrome en el despliegue `b8ace0ec`: color calculado RGB(250, 248, 245), equivalente a #FAF8F5.

- Crédito confirmado por el dueño: **© 2026 · Diseñado y desarrollado por Daniel J. Campos Lozada · Noamdan**, enlace **https://noamdan.com/**. El pie auxiliar vacío producía una franja de 36 px; se oculta cuando no contiene información. Publicado y verificado en Chrome en el despliegue `b8ace0ec`: enlace correcto y pie auxiliar con altura cero. 471 pruebas pasaron antes del despliegue.

## Comandera y pausa solicitada (23/10/2026)
- Preparado y verificado en PR #16: formato de impresión por equipo para rollos 48/58/80 mm, con ancho útil de 40/48/72 mm. Default 58 mm para el caso IT01 informado por el dueño. Evita depender del tamaño de viewport que declara el controlador y presenta importes en una línea propia en tickets estrechos.
- Requiere próxima versión instalada y prueba física con IT01; no se afirma una impresión real desde este equipo.
- Por pedido del dueño: audios en pausa y no comenzar otra prueba de Mercado Pago hasta que retome. Último resultado confirmado de pago: rechazado; sigue pendiente una compra ficticia aprobada de punta a punta.

- Revisión final de impresión: 474 pruebas en 48 archivos, compilación y scripts clásicos correctos; Chrome sin desborde de elementos a la derecha en 48/58 mm, con importe largo y QR completo. Solicitud de publicación de 0.4.16 pendiente de confirmación del dueño.
