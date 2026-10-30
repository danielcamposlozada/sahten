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
| Apertura y retiro | Confirmado por el dueño el 30/10/2026: Lun–Jue 12:00–15:30 y 18:00–22:00 · Vie–Sáb 12:00–15:30 y 18:00–23:00 · Dom cerrado. La apertura de las 11:00 publicada en Maps es incorrecta según el dueño; no modificar la ficha sin indicación |
| Delivery | Calendario independiente: Lun–Jue 18:00–22:00 · Vie–Sáb 18:00–23:00 · Dom cerrado. Fechas especiales editables; no se inventan feriados |
| Zona de delivery | Cobertura y tarifa confirmadas por dirección y recorrido. Desde el 25/10/2026 están activas las zonas locales 1–4, con mínimos/beneficios por zona; Zona 5 y Excepcional pausadas. Zona 1 ya no requiere autorización desde el 28/10/2026. Tabla vigente en [DELIVERY-GEOGRAFICO.md](DELIVERY-GEOGRAFICO.md#configuración-local-activada--25102026). Los textos libres anteriores de cobertura/mínimo/gratuidad siguen pendientes por decisión del dueño |
| Retiro | En el local, Roca 1489 |
| Beneficio confirmado el 24/10/2026 | 10 % con efectivo o transferencia, solo productos (envío sin descuento), en web y Mostrador. No acumulable: aplicar el mayor descuento de la orden. Activo en app y tienda; verificación final del 24/10/2026 al pie |
| Catering | Mesas árabes para eventos, 48 horas de anticipación |
| Instagram | sahten.ar |
| Sitio | https://sahten.online/ — en Google usar `?utm_source=google&utm_medium=organic&utm_campaign=gbp` (y `utm_content=pedidos` / `menu` en esos botones) |
| Cocina | Árabe, siria. Recetas familiares (la Sitto, **Marcelle Wakil** —nombre confirmado el 29/10/2026—, y María Teresa) |

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
5. Resuelto el 24/10/2026: 10 % por efectivo o transferencia; solo productos, web y Mostrador, sin acumular (se aplica el mayor). Activado y verificado el 24/10/2026 (estado final al pie).
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

- Revisión final de impresión: 474 pruebas en 48 archivos, compilación y scripts clásicos correctos; Chrome sin desborde de elementos a la derecha en 48/58 mm, con importe largo y QR completo. El dueño eligió dejar los cambios preparados: no integrar el PR #16 ni publicar 0.4.16 todavía.

**Mostrador y conservación de datos preparados (23/10/2026)**
- El PR #16 también prepara el carrito con altura completa, aviso de prueba descartable por visita y pestañas al ancho del catálogo. Los niveles de precio se ocultan de los filtros de platos, sin modificar el catálogo.
- «Pedidos» reúne mostrador y web, en Retiro en local / Mostrador y Delivery. Las tarjetas se muestran plegadas; productos, entrega, contacto, indicaciones, pago e impresión se despliegan al pedirlos. Se distinguen estados por borde, etiqueta y acción.
- Corregida la falta de aviso al guardado automático cuando se modifican clientes, medios de pago u otros datos internos. El instalador detiene la actualización si falla o se cancela el guardado previo. No se considera un medio de pago elegido como un cobro acreditado.
- Estas mejoras de aplicación permanecen sin publicar, por decisión del dueño. No cambian la web desplegada ni datos de Supabase. Detalles de operación y validación en `docs/MOSTRADOR.md`.

**Publicación 0.4.16 autorizada (23/10/2026)**
- El dueño confirmó publicar para Windows y Mac los cambios preparados de impresión, personalización web, Mostrador, tarjetas desplegables y conservación de clientes/medios de pago. Se integra mediante el PR #16 y se construyen los instaladores firmados para el actualizador.
- Publicación de instaladores en curso; la verificación final del release y `latest.json` se registra al terminar. Esta autorización no despliega nuevamente la web, no escribe en Supabase y no activa cobros reales. Audios y prueba nueva de Mercado Pago siguen en pausa.

**Sahten 0.4.16 publicada y verificada (23/10/2026)**
- Publicación autorizada e integrada mediante merge normal del PR #16, commit `174886aa0f388efa3df2e7c12b2b3132f2224d8e`, etiqueta `v0.4.16`.
- [Release 0.4.16](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.16) pública, marcada como última versión: Windows `.exe` y `.msi`, Mac universal `.dmg`, paquete del actualizador y firmas. [Proceso completo](https://github.com/danielcamposlozada/sahten/actions/runs/39999265447) correcto en pruebas, Windows, Mac y publicación.
- La dirección que consulta la app (`releases/latest/download/latest.json`) devuelve 0.4.16. El manifiesto contiene Windows x64, macOS Apple Silicon e Intel, con enlaces de la versión y firmas de actualización presentes.
- 480 pruebas en 48 archivos; CI de la rama y del merge, compilación local y comprobación de versiones correctos. Se corrigió una espera fija de la prueba de guardado para comprobar la escritura real en equipos lentos; no se fuerza el guardado para hacerla pasar.
- Esto reemplaza el estado anterior «dejar preparado». La web conserva su despliegue `b8ace0ec`; no se escribieron datos en Supabase ni se activaron cobros reales. Audios y nueva compra de prueba de Mercado Pago continúan en pausa.
- Pendiente de uso real: instalar en Windows, verificar clientes/medios de pago al reiniciar e imprimir un ticket IT01 de 58 mm comprobando importes y QR. No se afirma prueba física desde este equipo.

**Mercado Pago: prueba retomada (23/10/2026)**
- El dueño pospuso la revisión manual de Windows y pidió continuar. Se retoma únicamente la compra ficticia; audios y cobros productivos permanecen sin activar.
- Consulta de solo lectura: el checkout anterior `700280a2-0f40-4f45-866e-f0f02dff00d8` y su pago `184620449915` figuran rechazados, con actualización del proveedor a las 12:07:09 UTC. No creó una venta real.
- Conexión habilitada en modo `test`, vendedor ficticio `3782799792`; función `sahten-payments` activa, versión 4. La tienda abre Checkout Pro desde `/pedir/?mp_test=1`.
- Se preparó retiro de un Shawarma de Carne por ARS 16.000 con datos ficticios. El primer checkout (`299942b4-31b4-4726-b3c2-e216646bc9de`) encontró una sesión real de comprador; se volvió a la tienda sin pagar.
- Se abrió Chrome en incógnito y se generó el checkout separado `1f271f34-5451-43af-8a76-f6a750cc3ba1` (18:33:29 UTC; vence 19:03:29 UTC). Sigue `pending`, sin pago del proveedor y sin `order_id`. Espera que el dueño ingrese con el comprador ficticio; no se afirma acreditación ni validación completa del webhook.
- No se escribieron tablas públicas de menús, proyectos o pedidos. Las altas anteriores son únicamente registros privados del flujo de prueba generados por la tienda. No se cambió la configuración, no se desplegó código y no se activó producción.
- El dueño pidió que el agente inicie sesión. Se accedió a Developers → Integraciones y se localizó `Sahten Tienda Online` (`1680445440969879`); al abrir «Cuentas de prueba», Mercado Pago exigió validación de identidad por QR. La pestaña queda preparada para que el titular la complete. No se consultaron claves productivas ni se modificaron credenciales.

**Sonidos retomados (23/10/2026)**
- El dueño pidió continuar con el sonido. Se conservan las cinco muestras de campanita/darbuka y se preparó una sexta muestra musical breve filtrada de su referencia. Se entregan para elegir; todavía no se modifica la aplicación ni se publica una versión por este cambio.
- La grabación musical conserva acompañamiento; no se afirma voz aislada. Fuentes, duración, tratamiento y límites de uso en `entregables/audios-pedidos/FUENTES-Y-USO.md` del espacio de entregables del dueño. La revisión de Mercado Pago sigue pendiente de validación del titular.
- Revisión de muestras: el dueño pidió darbuka de 3 segundos con otro sonido sin campana, y refinar el recorte musical sin atenuar el cierre de la voz. Preparadas 07 (darbuka + palmas, 3 s) y 08 (separación vocal del mismo fragmento, 2 s, ganancia constante sin fade-out). No se integran ni se publican; se entregan para valoración auditiva.
- Selección posterior confirmada: «usa la de darbuks y palmas». Integrada localmente la opción 07 en el centro de notificaciones: 3 s, audio CC0 incluido en el paquete, preparación con gesto y sin superposición/reinicio por avisos simultáneos. La muestra musical no se incorpora. 484 pruebas en 49 archivos, compilación y revisión de scripts clásicos correctas; reproducción completa confirmada en Chrome. Pendiente publicar una nueva actualización; 0.4.16 publicada sigue sin este cambio. Sin cambios en la tienda pública, Supabase o Mercado Pago.
- El dueño autorizó «publica»: se prepara Sahten **0.4.17** para Windows y Mac con el nuevo sonido. La publicación incluye integrar la rama mediante merge normal, construir instaladores y comprobar el canal del actualizador. La verificación de disponibilidad se registra cuando termine; no incluye desplegar la tienda ni modificar Supabase o Mercado Pago.

**Sahten 0.4.17 publicada y verificada (23/10/2026)**
- PR #17 integrado mediante merge normal, commit `6521dfe4c4dd2db17e7c1b7cf367f1ade281dfcb`, etiqueta `v0.4.17`. Incluye el aviso elegido de darbuka y palmas de 3 segundos.
- [Release pública](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.17), no preliminar y marcada como última versión, publicada a las 19:59 UTC. Windows `.exe`/`.msi`, Mac universal `.dmg`, paquete de actualización y firmas presentes.
- [Publicación](https://github.com/danielcamposlozada/sahten/actions/runs/40013761666) correcta en pruebas, Windows, Mac y publicación automática. CI del PR `40013431976` y del merge `40013736549` correctos; 484 pruebas locales en 49 archivos, compilación y scripts clásicos correctos.
- El archivo público `releases/latest/download/latest.json` devuelve **0.4.17**, con Windows x64, macOS Apple Silicon e Intel, firmas presentes y enlaces de la misma versión. Requiere instalar la actualización; no se afirma prueba física en Windows.
- Reemplaza el estado anterior «preparado». La web conserva su despliegue `b8ace0ec`; no se cambió Supabase ni Mercado Pago.

**Ajustes de app preparados, sin publicar (23/10/2026)**
- Bloqueos persistentes de precio/costos por producto y canal, etiqueta interna «Precio fijado» e historial privado. El catálogo web recibe el precio final y una referencia opaca; no muestra etiquetas ni costos. El precio público y la caja usan la misma regla de descuento del canal.
- IT01: el dueño confirma **48 mm seleccionados en la app** y reducción al **88 % en el controlador** para evitar el recorte. Se prepara perfil 48 mm con ancho de contenido calibrado a 35,2 mm, texto/QR sin transformación de escala y controlador al 100 %. Sustituye la hipótesis anterior de IT01 con 58 mm; sigue pendiente la prueba física.
- Escala de interfaz 80–125 % por equipo, separada del proyecto, de la tienda y del documento de impresión.
- Importación CSV/Excel de clientes y múltiples direcciones por ID, con revisión previa, sin fusionar personas por compartir teléfono. Datos reales de la lista no importados. El dueño eligió primero importación y después checkout con identificación del cliente; la web no revela direcciones al escribir un teléfono.
- Revisada en Chrome la tienda publicada `/pedir/`: oculta la barra principal y el logo; solo muestra «Volver al inicio». Se preparó un ejemplo local con navegación persistente y logo original, sin implementarlo en la plantilla ni desplegarlo. Pendiente elección del dueño.
- No se publicó nueva versión, no se desplegó la web ni la función de pagos, no se modificaron datos de Supabase ni perfiles externos. Guías: `PRECIOS-FIJADOS.md`, `IMPORTAR-CLIENTES.md` e `IMPRESION.md`.
- Validación final del código preparado: `npx vitest run` **506 pruebas / 53 archivos**, compilación, scripts clásicos, comprobación de versiones y revisión de diferencias correctas. Chrome: editor sin desborde y con guardado visible en 1366 × 768, 1024 × 600 y 320 × 640; importación confirmada de dos clientes ficticios, teléfono compartido y dos direcciones vinculadas. El selector de archivos de la extensión de Chrome requiere un permiso local no habilitado; la prueba visual usó un archivo ficticio incluido en la página local y las pruebas automatizadas cubren CSV/Excel. No se cambiaron permisos del navegador.

## Actualización 0.4.18 y navegación de tienda autorizadas (23/10/2026)
- El dueño confirmó publicar ambas: la web con navegación persistente en `/pedir/` y la app con importación CSV/Excel con direcciones, bloqueos por producto/canal e historial privado, perfil IT01 de 48 mm al 88 % y escala de interfaz.
- Antes de publicar pidió revisar la jerarquía y los candados del editor: precio principal, costos secundarios y actualización visible de la fórmula. Se corrigió el campo automático que mostraba un importe anterior a los cambios de costos.
- Publicación en preparación. Se conserva el contenido aprobado, logos originales, hero #FAF8F5 y crédito de Noamdan. No se escriben datos en Supabase ni se activa Mercado Pago. La nueva compra de prueba y el checkout con identificación de clientes siguen pendientes.
- Validación previa: 510 pruebas en 53 archivos, compilación, scripts clásicos y versiones correctos. Chrome confirma respuesta real del slider, precio de 32 px y ausencia de desborde horizontal en 1366 × 768, 1024 × 600 y 320 × 640; guardar permanece visible. Los importes de las capturas son ficticios.
- La revisión del regreso desde secciones incluye conservar en la sesión solo cantidades de productos, por negocio y subcarpeta, con vencimiento de 24 horas; no guarda datos personales ni precios. Validación final: 512 pruebas en 53 archivos y compilación correctas.

**Navegación de la tienda publicada y verificada (23/10/2026)**
- Cloudflare Pages `sahten-menu`, despliegue `2e85becf-933e-4194-a0d9-989a78f03cea`, estado correcto. https://sahten.online/pedir/ conserva el SVG original de navegación, «Menú» activo, enlaces a la portada y botón «Mi pedido». En pantallas chicas usa «Secciones».
- Se generó desde `menu.json` público existente, conservando sus 37 productos, precios y contenido aprobado; no se escribieron menús, proyectos ni órdenes en Supabase. Logo y símbolo del hero coinciden con el archivo aprobado, color #FAF8F5 y crédito de Noamdan conservados. El catálogo en vivo continúa leyendo la nube.
- Chrome confirmó ausencia de desborde a 320 px y conservación de un producto al ir a «Nosotros» y volver al menú, sin enviar el pedido. Se quitó el producto al terminar la prueba.
- PR #18 integrado con merge normal (`8da0affda22d965038ba0249b1c07e05be057fa8`); etiqueta `v0.4.18` enviada. Instaladores en construcción: https://github.com/danielcamposlozada/sahten/actions/runs/40050282296. Se registra su resultado al finalizar.

**Sahten 0.4.18 publicada y verificada (23/10/2026)**
- Release pública y última versión: https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.18. El proceso `40050282296` terminó correctamente en pruebas, Windows, Mac universal y publicación.
- El actualizador (`releases/latest/download/latest.json`) devuelve 0.4.18: Windows x64 (MSI y NSIS), macOS Apple Silicon e Intel, enlaces de la versión y firmas presentes. Instaladores `.exe`, `.msi` y `.dmg` disponibles por HTTPS (200). No se afirma validación criptográfica manual de las firmas ni instalación nativa en este equipo.
- Incluye editor de precio con jerarquía y candados claros, costos por canal e historial privado, importación de clientes con direcciones, perfil IT01 y escala de interfaz. La web ya usa el despliegue `2e85becf`; no se escribieron datos en Supabase ni se activó Mercado Pago.
- Pendientes reales: ticket físico IT01 y lectura de QR; zoom nativo de Windows; lista real de clientes; checkout con identificación de clientes. Para referencias de costos históricos en futuras compras de MP se requiere actualizar su función por separado; la próxima compra ficticia aprobada sigue pendiente.

## Corrección del pie en la tienda (23/10/2026)
- El dueño señaló que `/pedir/` no mostraba el pie. La plantilla omitía el bloque «Contacto y pie» al separar la compra de la portada.
- Se restaura el mismo pie configurado: contacto, dirección, horarios, páginas informativas y crédito aprobado a Daniel J. Campos Lozada · Noamdan con enlace https://noamdan.com/. También se conserva en la vista de compra `#pedido`, sin duplicar IDs ni módulos de portada.
- La barra del carrito dispone de espacio para no tapar el crédito; se evita dejar el espacio reservado del catálogo antes del pie cuando éste está presente. Se respeta el módulo de contacto desactivado en otros negocios.
- Se prepara publicación de la web y actualización correctiva 0.4.19 del generador, dentro de la publicación de ambas solicitada por el dueño. No modifica datos del negocio, Supabase ni Mercado Pago. Estado de publicación se registra al verificar.
- La revisión del pie detectó además que filtrar categorías cambiaba la ruta de `/pedir/` a su carpeta base, desplazando enlaces relativos en subcarpetas. Se conserva la ruta y los parámetros actuales al actualizar solo el fragmento de categoría. Cubierto por regresión junto al pie.
- En la revisión móvil se evita además que el acceso flotante de WhatsApp cubra el crédito: se oculta mientras el pie está en pantalla, donde permanece el enlace de contacto.

### 24/10/2026 — Pie publicado y retomada de Mercado Pago

- El pie ya está visible en la tienda publicada, conserva contacto y crédito aprobados. Publicación Cloudflare Pages `4558e615` desde `bdf88816bf59f55db202bf2ea961c2f009299ca6`; no se modificaron datos de Supabase.
- Los instaladores de 0.4.19 fallaron antes de publicarse: el cambio de versión alteró por error `regex-automata` en Cargo.lock y dejó la entrada de Sahten con la versión anterior. La última versión pública verificada sigue siendo 0.4.18. Corrección preparada como 0.4.20, conservando la etiqueta e historia de 0.4.19; se amplía la comprobación de versiones a ambos archivos de bloqueo.
- Mercado Pago continúa habilitado solo en Pruebas (vendedor ficticio 3782799792). El intento 700280a2-0f40-4f45-866e-f0f02dff00d8 terminó rechazado; los intentos posteriores no registraron pago. Se retomó la prueba y el panel exige validar identidad por QR antes de consultar el comprador ficticio. No se activó producción, no se usaron tarjetas reales ni se modificaron pedidos.

### 24/10/2026 — Mercado Pago: primera compra nueva aprobada y notificada

- Se completó la compra ficticia por ARS 16.000 en Chrome incógnito. Checkout `e73e3519-4c4f-4eed-be0f-b6fde4dfea1c`, pago `184807337731` aprobado; la tienda mostró la acreditación de prueba al regresar.
- La notificación firmada respondió HTTP 200 antes de la consulta del navegador. Base verificada solo en lectura: `paid` / `approved`, importe 1.600.000 centavos, sin reembolso y sin `order_id`. No creó ventas ni pedidos reales. Los avisos anteriores IPN fueron rechazados y no se relajó la seguridad del receptor.
- Cobros reales sin activar. Antes de producción: actualizar la Edge Function para conservar `priceRevision` de las órdenes nuevas; preparar y mostrar los valores productivos al dueño para su confirmación. El seguimiento automático del intento antiguo está pausado y no se reactivó.
- Dueño autorizó integrar y publicar 0.4.20: PR #20 fusionado normalmente (`510b467d045a94568a7c16d75c4252b6bc8e9d3a`), etiqueta `v0.4.20` creada sin cambiar etiquetas anteriores. Pruebas de release aprobadas; instaladores Windows/macOS en construcción (run 40066236369). Publicación todavía no confirmada.

### 24/10/2026 — Preparación de producción y beneficio por pago

- Sahten 0.4.20 ya publicada: release pública y última versión, run `40066236369` correcto, instaladores Windows y Mac universal y manifiesto `latest.json` 0.4.20 con enlaces y firmas presentes. No incluye todavía los botones nuevos ni la promoción.
- El dueño autorizó actualizar únicamente `sahten-payments` para conservar `priceRevision` de cada producto. Versión 5 activa, sin cambios en la cuenta: sigue en Pruebas. El retorno de la compra ficticia aprobada sigue verificándose correctamente.
- El titular activó personalmente las credenciales productivas en Mercado Pago (aplicación `1680445440969879`). Aún no se conectaron a Sahten: no se guardaron secretos productivos ni se habilitaron cobros reales en la app. URL de Webhooks preparada en modo productivo, sin guardar; evento Pagos (legacy), correspondiente a Preferences API.
- Beneficio confirmado: 10 % en efectivo o transferencia, sobre productos; envío íntegro, web y Mostrador, mayor descuento sin acumular. Configurable por negocio y desactivado de forma predeterminada. Nuevas órdenes guardan porcentaje, base, importe, medio, revisión y fecha de vigencia; no se recalculan ventas anteriores. Reportes/CSV, ticket y WhatsApp conservan el descuento. Se reduce la venta neta sin volver a cargarlo como gasto.
- Diseño preparado para 0.4.21: la tienda usa dos opciones grandes de igual tamaño, con el símbolo oficial de Mercado Pago y totales por opción. Mostrador usa una opción por medio real, sin grupo duplicado: efectivo, transferencia, Mercado Pago, QR u otros. Crear un medio permite indicar su tipo; QR y otros no reciben el beneficio por pago. Elegir un medio no acredita automáticamente el cobro ni crea una integración de QR.
- Validación visual local con datos ficticios, sin conexión al negocio: tienda a 320 px y Mostrador a 1366 × 768 y 1024 × 600. El descuento no altera precios publicados ni costos fijos/variables. Pendiente de aprobación concreta: conexión productiva, activación del beneficio, publicación web e instaladores 0.4.21. No se modificaron menús, proyectos u órdenes en Supabase para esta preparación.

- Validación final de 0.4.21 preparada: `npx vitest run` — 521 pruebas en 54 archivos; compilación, scripts clásicos, versiones y diff sin errores. Incluye prueba de QR personalizado sin beneficio, cambio entre efectivo/MP, persistencia de la política sin alterar ventas, costos históricos netos, ticket y exportación sin duplicar el importe del beneficio. La prueba antigua de guardado espera ahora la escritura automática observable, sin forzarla, para evitar un fallo por espera fija en equipos lentos.

### 24/10/2026 — 0.4.21 publicada; conexión real verificada; web en espera

- El dueño confirmó integrar PR #22, publicar web e instaladores y conectar producción con el beneficio confirmado. Merge normal `5e47372b25d74ea555b5560d2f8dbd5b84d8c265`, etiqueta `v0.4.21`. [Release pública](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.21) publicada a las 06:48:53 UTC; run `40070821412` correcto en pruebas, Windows, Mac universal y publicación. `latest.json` ofrece 0.4.21, enlaces y firmas presentes. La app instalada muestra 0.4.21.
- Verificación de configuración, sin leer secretos: cuenta `MARCELTKAMISSO` (`326689208`), `production`, habilitada, sitio `https://sahten.online`; conexiones ficticias deshabilitadas. No se hizo ningún pago con fondos reales. El QR posterior para volver a leer credenciales no hace falta para esta verificación; se conserva la conexión existente.
- Se guardó en la app el beneficio del 10 %, enabled=true, web y Mostrador=true, solo productos y mayor descuento sin acumular. La tienda todavía recibe la política publicada anterior (enabled=false): no afirmar que el beneficio esté activo online.
- La app advierte que sincronizar reemplazaría 37 productos publicados por 36 visibles: «Combo Fatay» está oculto en la app. Se pidió al dueño elegir entre conservar los 37 (volver a mostrar Combo Fatay) o publicar los 36 actuales. No se continuó ese formulario; no se cambió la visibilidad de productos ni sus precios.
- Cloudflare continúa en el despliegue `4558e615-3350-4f37-9dc3-625f15eecb2b`. La revisión automática bloqueó la carga del ZIP hasta resolver la diferencia 36/37. No se publicó un despliegue nuevo. La carga directa quedó abierta en Chrome; el paquete de la nueva plantilla está preparado localmente, pendiente de ajustar al catálogo elegido y la política sincronizada.
- El límite previo de autorización se restableció. La API de assets rechazó la autenticación general (403); la obtención de una credencial temporal no pudo completarse y no se guardó ningún JWT de carga. Se preparó la carga desde el panel del navegador, manteniendo las credenciales en ese panel, pero se detuvo ante el bloqueo de publicación indicado.


### 24/10/2026 — Publicación final de 0.4.21 y 36 productos verificada

- El dueño confirmó «Publicar los 36 actuales, sin Combo Fatay». Se sincronizó desde la app instalada mediante su formulario normal, sin escrituras SQL directas en menús, proyectos ni pedidos. La app informó carga de 42 imágenes y «Completado». El catálogo público contiene 36 productos, sin Combo Fatay; los precios de los restantes coinciden con los publicados anteriormente.
- Beneficio activo en el catálogo: 10 %, web y Mostrador, revisión `4aa36749-e29c-4e98-bb2e-68fcd0d44abe`, vigencia `2026-10-24T11:59:09.140Z`. Envío sin descuento y mayor descuento sin acumular. Actualización del menú `2026-10-24T12:20:21.667Z`.
- Cloudflare Pages, publicación productiva final `918df74c-3a5f-47f4-86a5-8878ad33a51f`, creada a las 12:28:33 UTC, estado success. Subida por el panel de Chrome de 17 archivos. https://sahten.online/ y https://sahten.online/pedir/ usan la plantilla 0.4.21, el diseño y los logos aprobados y el crédito de Noamdan.
- La comprobación de la primera carpeta nueva detectó que el auxiliar temporal de generación había omitido conservar la conexión pública de pedidos al combinar el catálogo. Se corrigió el auxiliar, se volvió a generar y publicar y se verificó la conexión en el archivo público. El despliegue intermedio `8273ac3f` queda sustituido por el final indicado; no fue un cambio de las credenciales del negocio.
- Chrome en vivo: dos opciones principales de idénticas dimensiones (251,5 × 132,89 px). Shawarma de Carne $16.000 → efectivo/transferencia $14.400, descuento $1.600; Mercado Pago $16.000 sin ese descuento. Transferencia conserva $14.400. Las acciones muestran «Enviar pedido» e «Ir a Mercado Pago» según corresponda. Navegación, fotos y pie presentes. Se limpió el producto de la comprobación sin enviar ninguna orden.
- Mercado Pago productivo conectado a MARCELTKAMISSO (326689208), con conexiones ficticias deshabilitadas, tal como se verificó antes. No se realizó una compra con fondos reales: queda pendiente la comprobación supervisada del titular de un cobro productivo, su notificación y su orden recibida.
- Reemplaza los estados anteriores de espera por la elección 36/37. Sahten 0.4.21 para Windows/Mac ya publicada, manifiesto del actualizador verificado y 521 pruebas aprobadas antes de publicar. Capturas, ZIP final y estado en `entregables/checkout-descuento/` del espacio de trabajo del dueño.


## Delivery geográfico y horario — preparado el 24/10/2026, sin publicar

Rama `codex/delivery-geografico`. Se verificó el centro −34.5264314, −58.4818959 contra la dirección de la tabla y OSM way 369183696. El horario publicado coincide con la tabla: lun–jue 18–22, vie–sáb 18–23, domingo cerrado, zona Argentina. La integración nueva lo aplica a web, Mostrador y servidor, con excepciones por fecha editables; no se inventaron feriados, cortes anticipados ni pedidos programados.

Zonas, tarifas y mínimos solicitados están precargados pero la política y sus promociones permanecen apagadas. No se modificaron Supabase, el hosting ni perfiles públicos. La lectura de `menu.json` encontró tarifas anteriores $1.500/$2.500/$6.000 y umbral global gratis $60.000; no confundir ese estado observado con las referencias históricas de la tabla o con la propuesta nueva. No anunciar los nuevos valores como activos.

La tarjeta de beneficio se prepara con fondo verde claro tanto para tienda como para POS. Fórmula, tabla propuesta, pruebas, fuentes, requisitos del proveedor y orden de activación: [DELIVERY-GEOGRAFICO.md](DELIVERY-GEOGRAFICO.md). Antes de publicación falta aprobar configuración, disponer de clave de rutas, aplicar migración, desplegar y verificar en ensayo, actualizar app/web y activar la revisión acordada.

La rama también prepara en las tarjetas internas de Pedidos el enlace de ruta para el repartidor (copiar, abrir Maps o compartir). Solo para deliveries aceptados; no expone pedidos en una URL pública ni cambia el sitio publicado, pagos, estado de envío o datos SEO. Sin API adicional de Google.


### 24/10/2026 — Precios fijados publicados por solicitud del dueño

- Se tomó el catálogo de la app instalada mediante su exportación y se sincronizó desde «Nube y usuarios → Sincronizar menú», con confirmación de sus 36 productos. No se modificaron precios, visibilidad ni ventas mediante SQL. Combo Fatay continúa oculto.
- 28 precios cambiaron respecto de la carpeta anterior. Ejemplos: Shawarma de Carne $18.600, Shawarma de Pollo $16.000, Shawarma Mixto $16.100, Hummus $9.900 y Fatay $5.850. Los 36 precios de la nube coinciden con la exportación de la app.
- Cloudflare Pages Production: despliegue **fa054caf-c8f5-4072-a5be-ecaad779dc0f**, éxito, 24/10/2026 20:04:58 UTC. Se publicaron 17 archivos, incluyendo respaldo menu.json y páginas de precios/SEO. Se preservaron logos, diseño, crédito, fotos públicas, conexión de pedidos y beneficio por pago del 10 %. La política delivery v2 continúa desactivada.
- Chrome confirma los precios nuevos en la portada y tienda. No se enviaron compras ni se usaron fondos reales. Evidencias y ZIP en entregables/web-precios-2026-10-24/ del espacio del dueño.
- La exportación nativa fallaba al escribir subcarpetas nuevas de páginas/marca. Se prepara corrección y actualización 0.4.22 con 583 pruebas aprobadas y compilación correcta; publicación de instaladores pendiente de completar.
- El dueño pidió configurar el proveedor de rutas. OpenRouteService requiere acceso/clave de una cuenta; acceso con GitHub pendiente de autorización específica. La revisión automática rechazó aplicar la migración del delivery hasta obtener autorización explícita para tablas privadas y controles de pedidos/proyectos productivos; no se aplicó ni se desplegaron funciones.


### 24/10/2026 — 0.4.22 y servidor de rutas verificados

- Sahten 0.4.22 publicada: PR #25, merge `15c99175bfb766c165d80afcdce744dfec5dc7ff`, etiqueta v0.4.22. Proceso `40128751674` correcto en pruebas, Windows, Mac universal y publicación. `latest.json` anuncia 0.4.22 con enlaces y firmas; la app de este equipo ya muestra 0.4.22.
- El dueño autorizó expresamente iniciar OpenRouteService con GitHub y aplicar la migración/desplegar ambas funciones de envíos/pagos. Se aplicó `delivery_geografico_y_rutas` y el ajuste `delivery_function_search_paths`; tablas privadas con RLS y RPC solo para service_role. Se fijó `search_path=pg_catalog, public` en las dos funciones nuevas señaladas por el asesor.
- `sahten-delivery` v1 y `sahten-payments` v6 activas, con autenticación propia por acción. No se alteraron precios, menús, proyectos, órdenes existentes ni credenciales productivas de Mercado Pago. La política delivery v2 publicada sigue desactivada.
- OpenRouteService: ingreso con GitHub autorizado; formulario de alta con Daniel J. / Campos Lozada y uso Logistics. Términos/verificación completados por el titular; al comprobar sigue pendiente el botón final «Complete Sign-Up». No hay clave configurada ni una ruta real verificada con ese proveedor todavía. No se contrató un plan pago.
- Reemplaza las notas anteriores de instaladores pendientes y migración bloqueada. La web mantiene `fa054caf-c8f5-4072-a5be-ecaad779dc0f`, 36 productos y precios verificados.

### 24/10/2026 — Entrega, vuelto y ticket preparados, sin publicar

- Por solicitud del dueño: piso, departamento y referencia separados en web/Mostrador y conservados en servidor, órdenes, proyecto, detalle, WhatsApp, ticket y CSV. Se preservan notas del pedido.
- Campo opcional de efectivo y vuelto sobre el total final (descuento en productos, envío íntegro). No aumenta ventas ni acredita un pago. Cambio a transferencia/MP omite efectivo; retiro omite datos de piso/departamento.
- Ticket compacto para 48/58 mm con Arial, dirección completa, QR conservado y sin estado de la comanda. Nueva pestaña Impresión con perfiles y autoimpresión local de órdenes nuevas, sin historial ni duplicados y con posible diálogo del sistema.
- No se publicó todavía esta plantilla/formulario ni un instalador con estas novedades. No se crearon compras ni se escribieron órdenes reales para probarlo. La prueba física IT01 permanece pendiente. Detalles y límites en [IMPRESION.md](IMPRESION.md).

- Validación final de esta preparación: **593 pruebas / 62 archivos** aprobadas, compilación Vite, scripts clásicos, versiones 0.4.22 y diferencias sin errores; ambas funciones pasan Deno. La advertencia heredada `allowJs` de pagos se ignora y no impide comprobarla.
- Chrome con datos ficticios: Mostrador y Ajustes de impresión a 1024 × 600; tienda a 320 × 640. Piso/departamento/referencia conservados y efectivo $20.000 sobre total $8.550 muestra vuelto $11.450; no se envió la orden. Tickets de 48/58 mm revisados, QR completo de 30 mm y sin desborde horizontal en IT01. Los archivos nuevos de servidor que conservan estos campos **están preparados, todavía no desplegados**; los despliegues activos v1/v6 son los de la integración de rutas 0.4.22. Actualizarlos junto con la futura app/web.
- Comprobación HTTP del servidor actual: configuración de Mercado Pago 200 y modo production habilitado; consulta de proveedor sin sesión 403; cálculo de delivery v2 apagado 409. Consulta de solo lectura confirma 36 productos, política v2=false y cero conexiones ORS. No se crearon pedidos ni se alteró la cuenta de pagos.

### 25/10/2026 — OpenRouteService conectado y comprobado

- El titular completó el alta HeiGIT y autorizó guardar su Basic Key cifrada en Supabase y realizar tres consultas de prueba con destinos públicos. La conexión se guardó desde **Ajustes → Negocio → Tienda online y delivery → Servicio de rutas por calles**, en la app instalada 0.4.22. La clave no se pegó en el chat, proyecto, menú ni archivos de trabajo; se retiró de la memoria de la prueba al terminar.
- Plan Standard gratuito confirmado en el panel oficial: **0 €**, Directions V2 **2.000 consultas diarias / 40 por minuto**. No son 2.000 pedidos: una compra puede consultar varias veces. No se contrató un plan pago. Referencia: https://account.heigit.org/info/plans.
- Se detectó el dominio de API deprecado. Se corrigió a `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`, según el aviso oficial (retiro del dominio anterior previsto para el 2–6/11/2026): https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912.
- Despliegue limitado a la base publicada 0.4.22 y **solo ese cambio de URL**: `sahten-delivery` **v2** y `sahten-payments` **v7**, ambas activas. No incluye todavía los campos nuevos de impresión/efectivo/dirección preparados en PR #26. Deno correcto en ambos paquetes; 593 pruebas aprobadas y regresión de la URL nueva. La conexión productiva de MP conserva su configuración.
- Tres consultas reales con la misma clave y el mismo motor de rutas: Hospital Houssay **1.707,4 m**, Plaza Vicente López y Planes **2.551,5 m**, estación La Lucila **4.062,2 m**. Perfil driving-car, extremos validados a 100 m. Son estimaciones por calles sin tráfico, no un perfil específico de moto. Evidencia pública: [rutas-ors-2026-10-25.json](delivery/rutas-ors-2026-10-25.json).
- La comprobación directa del proveedor se hizo en una página de diagnóstico local con los mismos módulos del servidor; no fue un pedido ni una compra. Queda pendiente la validación de una orden completa en ensayo al activar una política acordada. No afirmar que ya esté probada la operativa nueva de punta a punta.
- Lectura de base: conexión privada guardada (25/10/2026 03:11:19 UTC), catálogo **36 productos**, **delivery v2=false**. Comprobaciones HTTP: pagos/config 200, proveedor sin sesión 403 y cálculo v2 apagado 409. No se cambiaron menús, proyectos, órdenes ni tarifas para realizar estas pruebas. Este estado reemplaza el alta/clave pendiente y las versiones v1/v6 anotadas antes.


### 25/10/2026 — Tipografía de ticket más compacta (preparada, sin publicar)

- A pedido del dueño, papel de 48/58 mm usa cuerpo de 11 px, productos de 11,5 px, número de orden de 14 px y total de 13 px. Reduce la negrita general y los espacios; el total puede entrar en una línea y se acomoda si el importe es largo. No se comprime ni recorta texto ni se modifica la calibración IT01 al 88 %.
- Dirección, piso/departamento, referencia, teléfono, descuentos, efectivo/vuelto y QR permanecen completos; QR conserva 30 mm. Los estados de comanda siguen fuera del ticket. Papel de mayor ancho conserva cuerpo de 14 px.
- Muestras ficticias verificadas en Chrome: contenido de 35,2 mm en IT01 y 48 mm en papel de 58 mm, sin desbordes horizontales y QR de 113,38 px (30 mm). La escala de interfaz no altera la plantilla impresa. No se usó ni modificó información de pedidos reales.
- 593 pruebas / 62 archivos y compilación Vite aprobadas. Se retiró la expectativa anterior que obligaba cuerpo de 14 px y se verifica la independencia entre escala de pantalla y CSS de impresión.
- Preparado en PR #26; **no publicado ni probado físicamente en IT01**. No cambia la web activa, Supabase, tarifas ni la versión 0.4.22. Evidencia local: entregables/impresion-entrega-efectivo/comparacion-tipografia.html y tipografia-metricas.json. Esta actualización reemplaza la medida de texto de 14 px de la preparación anterior para 48/58 mm.


### 25/10/2026 — Publicación 0.4.23 autorizada

El dueño aprobó la tipografía compacta y pidió integrar y desplegar todos los cambios preparados del PR #26: actualización de app Windows/macOS, carpeta web y ambas funciones para dirección/piso/departamento/referencia y efectivo/vuelto. Incluye Ajustes de impresión e impresión automática opcional por equipo. La publicación conserva los 36 productos/precios vigentes, logos y contenido aprobado, cobros productivos existentes y delivery v2 apagado. No activa zonas/tarifas nuevas ni crea órdenes o pagos reales. Comprobación de instaladores y despliegues en curso; se registra el resultado al finalizar.


### 25/10/2026 — 0.4.23 publicada; carrito editable en preparación

- PR #26 integrado por merge normal `2351085f9ca561d427162058da8fad3bd3c0420d`, tag `v0.4.23`. Release `40158899096` finalizó correctamente en pruebas, Windows, macOS universal y publicación. `latest.json` anuncia 0.4.23 con Windows y ambas arquitecturas Mac, enlaces correctos y firmas presentes. No se afirma prueba física en IT01 ni instalación nativa desde este chat.
- Web productiva Cloudflare `78fdcc0c-6689-4e92-8b3c-3dcbd95e6b80`, éxito, 25/10/2026 03:38:36 UTC; 17 archivos generados desde el catálogo público vigente y el diseño aprobado, con 36 productos y precios coincidentes. Conexión pública y versión de esquema `menu.json` 1 conservadas.
- Funciones activas `sahten-delivery` v3 y `sahten-payments` v8: incluyen piso/departamento/referencia y efectivo/vuelto preparados. HTTP: configuración productiva de pagos 200, proveedor sin sesión 403 y nueva política de envíos apagada 409. Credenciales y tarifas sin cambios; no se crearon pedidos ni pagos.
- Chrome en producción: campos de piso, departamento, referencia y efectivo presentes. Retiro con producto $18.600, beneficio $1.860, total $16.740 y efectivo $20.000 muestra vuelto $3.260. Al elegir Mercado Pago desaparece efectivo y el total vuelve a $18.600. Se vació el carrito de comprobación sin enviar.
- Después de publicar, el dueño solicitó un carrito editable y un proceso simple en dos pasos. Se prepara en rama `codex/checkout-editable-dos-pasos`; todavía no está publicado. La auditoría UX general continúa en pausa.


### 25/10/2026 — Carrito en dos pasos, actualización 0.4.24 en preparación

El dueño amplió la publicación solicitada con edición fácil del carrito antes de completar datos y pagar. Se prepara el primer paso «Pedido» con controles de sumar/restar unidades y quitar productos, subtotal de productos y acceso al catálogo; el segundo «Entrega y pago» conserva los campos, el medio elegido, las notas y el efectivo al regresar. Indicador de dos pasos, resumen plegable y regreso visible en móvil. Quitar todo bloquea continuar/enviar; los cambios de cantidad recalculan descuentos, mínimo y envío. No cambia catálogo, precios, credenciales, órdenes existentes ni la política de delivery apagada. La 0.4.23 continúa publicada; la nueva versión y carpeta web se publican una vez terminadas las comprobaciones.

- Verificación de la preparación 0.4.24: 596 pruebas en 62 archivos y build aprobados. Prueba real de interfaz local en Chrome a 320 × 640: sumar una unidad actualiza subtotal, quitar Hummus reduce el pedido y volver conserva nombre/piso. Botones de cantidad, continuar y volver visibles; sin enviar una orden ni conectar datos privados. Las pruebas automatizadas cubren efectivo/vuelto, cantidades finales de Mercado Pago, bloqueo de carrito vacío y mínimo/envío tras editar.

### 25/10/2026 — 0.4.24 publicada y reglas locales de delivery activas

- PR #27 integrado mediante merge normal `45b7a0416c71b5a345aae066ca4c7770fd2a0f39`; tag `v0.4.24`. [Release 0.4.24](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.24), publicada a las 15:20:15 UTC, con Windows EXE/MSI y Mac universal. [Proceso de publicación](https://github.com/danielcamposlozada/sahten/actions/runs/40205433225) y CI del merge correctos. `latest.json` anuncia 0.4.24, con enlaces de esa versión y firmas presentes para Windows/Apple Silicon/Intel.
- Carrito editable en dos pasos publicado en sahten.online/pedir/: sumar/restar unidades, quitar línea, subtotal, continuar con entrega/pago y regresar sin perder datos. Chrome productivo: 1 Shawarma $18.600 → 2 unidades $37.200; efectivo 10 % $3.720 → total $33.480; retiro conserva flujo; al quitar la línea queda vacío e impide continuar. Sin enviar pedidos ni iniciar pagos; carrito de comprobación vaciado.
- Cloudflare Production `b06a9f7d-f120-4ffa-a46d-c65666b39986`, éxito, 15:22:34 UTC. Los 17 archivos públicos coinciden por SHA-256 con la carpeta generada; cuatro fotos públicas comprobadas devuelven 200. 36 productos, precios y diseño aprobado conservados.
- El dueño confirmó activar **su configuración local actual**. Guardada y sincronizada por la app, revisión `2d0d93c3-5e24-4aeb-85f2-dc197876513f`. Zonas 1–4 y promociones activas, combinables con descuento por pago; Zona 1 requiere autorización; Zona 5 y Excepcional pausadas. [Tabla exacta vigente](DELIVERY-GEOGRAFICO.md#configuración-local-activada--25102026). El JSON público coincide íntegramente con el exportado por la app; precios idénticos a los anteriores. No se usó SQL para modificar menús, proyectos u órdenes.
- Domingo cerrado confirmado tanto en la web como en el servidor, con próxima apertura lunes 26 a las 18:00 de Argentina. No se generaron pedidos, pagos ni rutas de comprobación en esta activación. No se afirma una compra completa con la nueva política ni prueba física IT01. La validación abierta de incentivos está cubierta por pruebas y demo local; el servicio productivo respetó el cierre.
- El dueño pospuso expresamente el reemplazo de textos libres de FAQ y «Delivery y retiro». Siguen mencionando mínimo $15.000 y gratis desde $45.000, distintos de la tabla activa. Es un pendiente conocido, no un valor comercial que deba copiarse a nuevas publicaciones.
- Se entrega [tutorial visual](TUTORIAL-TIENDA.html) y [guía escrita](GUIA-ACTUALIZAR-TIENDA.md): precios/envíos requieren guardar + Sincronizar menú + recargar; diseño, textos, plantilla nueva y respaldo/SEO estáticos requieren exportar y subir la carpeta completa. No se implementó publicación automática directa a Cloudflare. El tutorial es independiente, no una pantalla de la app 0.4.24.
- Código del carrito validado con 596 pruebas / 62 archivos, build y versiones correctos. La auditoría UX general continúa pausada; no se modificaron Google, redes, credenciales ni otras reglas comerciales.

### 25/10/2026 — Incidente del buscador de direcciones y corrección 0.4.25

- El dueño informó «No pudimos buscar la dirección (sin conexión)» en la web. Se reprodujo HTTP 503 `routing_geocoder_unavailable` desde `sahten-delivery/geocode` con la dirección pública del local; una consulta local al buscador original respondió 200 con el punto exacto. No se atribuye el incidente a la conexión del comprador ni se afirma un código HTTP específico del proveedor que no se registró.
- Se comprobó Pelias del proveedor ORS ya conectado. Una primera respuesta solo identificaba Vicente López: no era una dirección precisa y se descartó. La función activa `sahten-delivery` v5 filtra capas generales de localidad, usa solo direcciones/lugares, separa caché por tienda/revisión de credencial y conserva el límite global también cuando devuelve cero resultados. SHA-256 `98c0bf5b0da25d9872233a622ae9e37561d31d41fbcd2b13cc867be0fc2680bc`; gateway JWT false conservado, controles internos sin cambios. `sahten-payments` continúa v8.
- Web y próximo instalador 0.4.25 recuperan la búsqueda directa de Nominatim ya utilizada por la app si el servidor no obtiene una dirección precisa o falla su geocodificador. No usan ese respaldo para eludir límites/cuotas ni reemplazan la validación de ruta por una distancia radial. El mensaje web distingue fallo del buscador de falta de internet y limpia el error anterior al reintentar.
- Corrección web publicada en Cloudflare Production `0eabc917-487c-4e13-973e-c538d0bd88a8`, éxito, 15:55:19 UTC. Los 17 archivos coinciden por hash; cuatro fotos públicas 200. Catálogo de 36 productos, precios, política activa, credenciales, logos y textos libres pospuestos conservados.
- Chrome real local y productivo devuelve «1489, General Julio Argentino Roca, Vicente López». Comprobación sin crear pedidos ni pagos. Se conserva el aviso de domingo cerrado. Evidencia local: `entregables/publicacion-0.4.25/direccion-publicada.png` y `https-verificado.json`.
- Validación: 602 pruebas / 63 archivos aprobadas con `npx vitest run --maxWorkers=2`, build, scripts clásicos y versiones correctos. Una prueba antigua esperaba 60 ms para guardar: ahora espera la condición real con límite; otro intento de suite simultánea agotó los hooks de preparación, resuelto reduciendo la concurrencia sin omitir pruebas. El despliegue web se hizo después de aprobar las 602.
- Instaladores 0.4.25 en preparación; no se afirma su publicación hasta verificar release y manifiesto. Tutorial entregado como documento visual independiente, probado a 1200 y 360 px con selector de recorrido e índice navegable; también se conserva guía escrita en el repo.

### 25/10/2026 — Ampliación solicitada: sugerencias automáticas en web y Mostrador

El dueño aclaró que necesita recuperar la búsqueda al escribir calle y altura, sin exigir «Buscar dirección», en ambos puntos de venta. Se amplía 0.4.25 antes de crear su etiqueta de publicación; el PR #28 ya integrado conserva la corrección previa.

- Motor compartido `address-suggestions.js` para sugerencias argentinas con Georef oficial: pausa de 350 ms, cancelación de solicitudes anteriores, rechazo de respuestas tardías, contexto de departamentos cercanos y caché temporal en memoria por consulta/centro. No se guardan nombres, teléfonos ni historial de búsquedas en el proyecto o en almacenamiento del navegador.
- Se requieren calle y altura antes de consultar. La localidad escrita refina los resultados. Se descartan direcciones sin coordenadas o altura; se priorizan coincidencias de calle y cercanía. Las coordenadas son las estimaciones del servicio oficial, no una medición del acceso a la vivienda. La persona debe seleccionar la opción; la validación de tarifa/ruta/horario sigue en el servidor.
- El botón habitual «Buscar dirección» se elimina. «Buscar de otra forma» aparece únicamente cuando falla la consulta o no hay resultados, también con delivery anterior. Nominatim no se usa para autocompletar: se conserva únicamente para la búsqueda explícita disponible, respetando su política. Georef no requiere clave ni cuenta; no se contrató ningún servicio.
- Prueba técnica real de «Roca 1489» con el centro público del local: primera búsqueda 543 ms, repetición en caché 0 ms (tiempo de la función, sin la pausa de escritura ni render). Chrome local: alrededor de 1.015 ms incluyendo la pausa; Mostrador de ejemplo aislado encuentra «AV CORRIENTES 1234, San Nicolás» sin botón y mantiene el foco. No se modificó el proyecto del negocio con esta prueba ni se crearon órdenes.
- Tutorial escrito/visual ampliado para describir sugerencias automáticas y la alternativa explícita. Publicación final y comprobación de instaladores se registran al terminar. El texto libre comercial pospuesto continúa intacto.

Referencias: [Georef: normalización de direcciones](https://www.argentina.gob.ar/georef/normalizacion-de-direcciones), [uso gratuito sin autenticación y aplicaciones privadas](https://www.argentina.gob.ar/node/473730), [restricciones de autocompletado de Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

- Comprobación final de esta ampliación: 608 pruebas en 64 archivos, compilación, versiones y scripts clásicos correctos. Chrome local muestra sugerencias al escribir «Roca 1489» y confirma que el botón alternativo no es visible. Las pruebas cubren su aparición solo ante error/sin resultados y su ocultación al volver a escribir. Publicación final en curso; no se crean pedidos de prueba productivos.

- Web final publicada y verificada: Cloudflare Production `c20f3cd9-f0f0-4547-bbef-7264321d509b`, 25/10/2026 19:54:42 UTC, éxito. Diecisiete archivos por hash y cuatro fotos 200. Chrome real en sahten.online muestra sugerencias y confirma que el botón alternativo permanece oculto; Mostrador de ejemplo también. Catálogo, precios, condiciones activadas y textos pospuestos intactos. PR #29 integrado mediante merge normal `726761e50af3536afdcf070b020d8080aeb16e5d`, CI correcto; etiqueta `v0.4.25` enviada, instaladores en construcción. Evidencia: `entregables/publicacion-0.4.25/web-automatico-publicado.png`.

### 25/10/2026 — Sahten 0.4.25 publicada y verificada

- Release pública [v0.4.25](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.25), publicada 20:07:38 UTC. [Proceso completo](https://github.com/danielcamposlozada/sahten/actions/runs/40228407580) correcto en pruebas, Windows, Mac y publicación. Merge normal del PR #29 y etiqueta conservados.
- Windows EXE/MSI y Mac universal DMG disponibles. El endpoint `releases/latest/download/latest.json` anuncia 0.4.25; sus siete entradas de plataforma apuntan a esta versión, tienen firma de actualización y los tres archivos únicos responden 200. Evidencia `entregables/publicacion-0.4.25/release-verificado.json`. La app instalada debe actualizarse para incorporar el comportamiento en Mostrador.
- Web final en Cloudflare `c20f3cd9-f0f0-4547-bbef-7264321d509b`, 17 archivos y fotos verificados. Se sugiere al escribir calle/altura y se quita el botón habitual en web y Mostrador; el reintento «Buscar de otra forma» solo se muestra ante fallo o sin resultados. 608 pruebas / 64 archivos y compilación aprobados.
- Tutorial visual y escrito actualizado y empaquetado en `entregables/tutorial-tienda/tutorial-sahten.zip`; disponible sin conexión, independiente de la app. No se añaden pantallas de tutorial nuevas al instalador.
- Sin nuevas órdenes, pagos, cambios de precios ni escritura directa en Supabase. Condiciones de delivery activadas antes permanecen intactas; textos informativos pospuestos por el dueño y prueba física IT01 siguen pendientes. Auditoría UX general continúa pausada.

### 26/10/2026 — Mejoras de operación y ubicación del aviso de delivery (en preparación)

Por solicitud del dueño: confirmar pedidos web y locales por WhatsApp con tiempo estimado, sonido solo para nuevos pedidos web, cancelación directa conservando historial y buscador de clientes en Mostrador. Se prepara también la tarjeta de disponibilidad de la web inmediatamente debajo de Delivery / Retiro, antes de los datos personales. Detalle en [MOSTRADOR.md](MOSTRADOR.md#confirmaciones-tiempos-y-cancelación--preparado-el-26102026).

Cambios de código y pruebas locales; todavía no hay publicación de nuevos instaladores ni reemplazo de la carpeta productiva. No se escriben pedidos/precios/menús en Supabase, no se envían WhatsApp reales ni se hacen reembolsos. El contenido comercial, los logos y los textos libres de delivery pospuestos permanecen intactos.

Verificación local del 26/10/2026: 626 pruebas en 66 archivos aprobadas, sin errores no controlados; compilación, scripts clásicos, versiones y revisión de diferencias correctos. Chrome real: búsqueda/alta de cliente, asignación por teclado, tiempo de retiro en la confirmación, cancelación preservando historial y aviso web inmediatamente debajo de la modalidad, con datos ficticios sin conexión al negocio. Capturas en `entregables/revision-pedidos-2026-10-26/`. Instaladores y web activa todavía sin cambios.


### 26/10/2026 — Publicación 0.4.26 autorizada

El dueño pidió «subelo» después de revisar el resumen y la captura del PR #30: autoriza integrar y publicar la app para Windows/Mac y actualizar la carpeta web. Incluye el buscador de clientes, estimación de retiro/delivery, confirmación preparada de WhatsApp, sonido exclusivo de pedidos web nuevos, cancelación conservando historial y el aviso de delivery debajo del selector. No cambia precios, catálogo, tarifas, horarios ni credenciales; no envía mensajes ni crea pedidos. Versiones alineadas en 0.4.26. Instaladores y despliegue web pendientes de verificación final.


### 26/10/2026 — Web 0.4.26 publicada; instaladores en construcción

- PR #30 integrado por merge normal `6cf1d7fa819ba2fb58dc172124a82cb46b4b9ea6`; etiqueta `v0.4.26`. CI del PR y del merge correctos. El proceso de instaladores `40388314196` aprobó las pruebas y construye Windows/macOS universal.
- Cloudflare Production `2235109a-a4a5-4675-ba60-68a561989230`, éxito, 26/10/2026 19:35:56 UTC. Los 17 archivos publicados coinciden con la carpeta generada por SHA-256; cuatro fotos públicas devuelven 200. Se usan los **33 productos vigentes de la nube**, con sus precios actuales: el catálogo cambió respecto de los 36 de la carpeta previa, y no se restauraron productos anteriores. Sitio, conexión, horarios y política de delivery aprobada conservados.
- Chrome productivo confirma el aviso «Delivery fuera de horario» inmediatamente debajo del selector Delivery/Retiro y antes de Nombre. Se revisó un Shawarma de Carne de $18.600, beneficio de $1.860 y total de $16.740 sin envío; no se completaron datos ni se envió el pedido. El producto de comprobación se quitó y el carrito quedó vacío.
- No se escribieron tablas en Supabase, no se enviaron mensajes, no se crearon pedidos ni pagos y no se modificaron credenciales. La configuración de publicación automática de precios/disponibilidad continúa pendiente; hoy se usa «Sincronizar menú» sin tener que volver a subir la carpeta.


### 26/10/2026 — Sahten 0.4.26 publicada y verificada

- [Release 0.4.26](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.26) pública, publicada el 26/10/2026 a las 19:51:01 UTC. Proceso `40388314196` completo y correcto: pruebas, Windows, Mac universal y publicación. CI del merge también correcto. Se conservan las 626 pruebas aprobadas de esta implementación.
- `releases/latest/download/latest.json` anuncia **0.4.26** con siete entradas de plataforma: Windows EXE/MSI y Mac Intel/Apple Silicon, URLs de la versión y firmas presentes. Las tres descargas únicas del actualizador devuelven 200. Incluye DMG universal y los instaladores Windows; no se afirma instalación nativa o impresión física desde este chat.
- Este estado reemplaza «instaladores en construcción». La web continúa en el despliegue productivo `2235109a-a4a5-4675-ba60-68a561989230`, con 17 archivos y cuatro fotos verificados, 33 productos y precios coincidentes con el catálogo público actual. Evidencia, carpeta, ZIP y guía de operación en `entregables/publicacion-0.4.26/` del espacio de trabajo.


### 26/10/2026 — Disponibilidad, recetas internas y nube: en preparación

El dueño aprobó separar Recetas, Productos y Tienda online. Se prepara la pausa compartida (por hoy, hasta fecha/hora o manual), producto gris sin permitir compra en web/Mostrador y disponibilidad con peticiones solo de estado. Los interruptores de Tienda online muestran/ocultan solo en la web; las internas y borradores quedan fuera de las pantallas de venta. Los nuevos productos habilitados comienzan pausados y fuera de la tienda.

Las acciones de nube se renombran a «Actualizar proyecto entre equipos» y «Publicar catálogo en la tienda», con ayuda sobre sus datos y conflictos. Generar la carpeta se llama «Exportar archivos de la web». Detalle, límites y orden de despliegue en [DISPONIBILIDAD.md](DISPONIBILIDAD.md). No modifica datos confirmados del negocio, precios, catálogo productivo, credenciales ni pedidos. La migración y las funciones se prueban localmente; no se aplicaron a producción. La versión pública sigue siendo 0.4.26.

Verificación final local: **644 pruebas en 69 archivos aprobadas**, compilación, scripts clásicos, coherencia de versiones y diferencias correctos. La suite incluye PostgreSQL local con la migración, permisos por tienda/rol, preservación del precio publicado, reintentos, vencimiento sin app abierta y bloqueo de compra en servidor. Chrome real: aviso con tres duraciones y reactivación a las 00:00, producto gris y botón deshabilitado en Mostrador y tienda generada, siempre con datos ficticios. Capturas y revisión local en `entregables/revision-disponibilidad-2026-10-26/` del espacio de trabajo. No equivale a una prueba desplegada en Supabase ni a instaladores nuevos.

### 26/10/2026 — Publicación 0.4.27 autorizada y servidor actualizado

El dueño indicó «revisa y deploy» sobre el PR #31. Se prepara la publicación coordinada de 0.4.27 para Windows/Mac y de la carpeta web; los conceptos nuevos de rediseño de menú/checkout no forman parte de esta versión. Las 644 pruebas se repitieron correctamente con la versión alineada en 0.4.27.

Aplicada la migración `20261026_menu_availability.sql` en una transacción desde el panel de Supabase en Chrome, con registro `20261026 / menu_availability`: el conector de migraciones devolvió dos errores de solicitud vencida y se comprobó que no había aplicado nada antes de usar el panel. Se verificaron tablas y funciones y permisos sin ejecución anónima. Desplegados **sahten-payments v9** y **sahten-delivery v6**, ambos activos y conservando su autenticación propia. El hash del catálogo público permaneció igual antes/después: 35 productos actuales del negocio (y los 8 del otro catálogo), sin editar precios, productos ni pedidos. No se enviaron mensajes ni se crearon pagos.

La carpeta 0.4.27 se genera con los **35 productos actuales**, conserva sus precios, fotos, sitio, conexión y política de delivery. Web, merge e instaladores pendientes de verificación final; el último release público sigue siendo 0.4.26 hasta completar el proceso.

### 26/10/2026 — Web 0.4.27 publicada; instaladores en construcción

Cloudflare Production `0cfee882-0d0e-47cd-a38a-a206393fc779`, éxito el 27/10/2026 a las 00:17:00 UTC (26/10, 21:17 Argentina). Los 17 archivos coinciden por SHA-256 con la carpeta revisada y cuatro fotos públicas devuelven 200; 35 productos. PR #31 integrado con merge normal `92742f6d400b24df66df65df6e6e360922113dc2`, etiqueta `v0.4.27`; CI correcto. El proceso Release `40425736345` construye Windows y Mac. Payments público confirma `enabled:true / production`; los tres RPC de disponibilidad rechazan al anónimo con 401. La migración original está aplicada, payments v9 y delivery v6 activos.

Revisión adicional: reproducido localmente un pedido REST que ignoraba una pausa existente solo en un catálogo importado, sin registro privado. Corregido en `20261027002342_published_pause_guard.sql`: prioriza el estado privado si existe y, si falta, consulta la pausa publicada; vencimientos válidos permiten venta y fechas inválidas bloquean. Las 645 pruebas de 69 archivos y la compilación pasan. Esta migración adicional queda **preparada, sin aplicar**: la revisión automática rechazó el clic de ejecución por requerir confirmación específica del dueño, ya solicitada. No se creó ni pausó ningún producto real para comprobarlo. Los conceptos nuevos de menú/checkout siguen fuera del código de producción.

El dueño confirmó «Sí, aplicar esa corrección del servidor». La migración adicional **ya está aplicada y registrada** como `20261027002342 / published_pause_guard`. Se comprobó su registro por consulta independiente; ambos catálogos conservan exactamente el hash anterior (35 y 8 productos respectivamente). Esto reemplaza el estado pendiente del párrafo anterior. No requiere reconstruir los instaladores: la corrección está únicamente en la validación de base de datos. Windows y Mac del release 0.4.27 terminaron correctamente; la publicación final está en cola.

### 26/10/2026 — Sahten 0.4.27 publicada y verificada

- [Release 0.4.27](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.27) pública, publicada el 27/10/2026 a las 00:29:34 UTC (26/10 a las 21:29:34 Argentina). Proceso `40425736345` completo y correcto: pruebas, Windows, Mac universal y publicación. `latest.json` anuncia 0.4.27 con siete entradas de plataforma, firmas presentes y las tres descargas únicas responden 200. No se afirma instalación nativa en Windows ni impresión física desde este chat.
- PR #31 integrado mediante merge normal `92742f6d400b24df66df65df6e6e360922113dc2`; etiqueta `v0.4.27`. PR #32 del control adicional también integrado por merge normal `d4c986dfa82c263f6ac01b6f00a6e3d68f9e679f`, CI correcto. 644 pruebas para el instalador y 645 con la comprobación adicional del servidor, en 69 archivos; compilación y versiones correctas.
- Web productiva `0cfee882-0d0e-47cd-a38a-a206393fc779`, 17 archivos por hash y cuatro fotos verificados, 35 productos actuales y precios conservados. Ambas migraciones registradas y servicios payments v9 / delivery v6 activos. Los RPC nuevos rechazan al anónimo; Mercado Pago continúa habilitado en producción. No se crearon pedidos ni pagos, no se editaron precios o productos reales, ni se accedió a nuevas credenciales.
- Este estado reemplaza las referencias anteriores a preparación, permisos pendientes o instaladores en construcción. Evidencia, paquete, guía de uso y resultados en `entregables/publicacion-0.4.27/` del espacio de trabajo. Falta únicamente la comprobación operativa opcional de una pausa sobre un producto que el dueño elija, con la app actualizada en sus equipos. Los conceptos de carta y checkout solicitados aparte siguen siendo propuestas locales, sin implementación ni despliegue visual.


### 26/10/2026 — Apertura de delivery y vistas de Productos (preparación local)

Por pedido del dueño se prepara la apertura operativa en Ajustes → Negocio → Delivery, separada de Pagos de la tienda. El estado se envía solo por RPC autenticado de dueño/admin; cola persistente por tienda, sin reemplazar precios, zonas ni tarifas. La web consulta automáticamente cada 10 segundos y al volver a la pestaña. La pausa bloquea nuevas entregas en web, Mostrador y servidor; mantiene retiro, pedidos existentes y pagos ya iniciados. Reactivar vuelve a respetar el horario, no modifica turnos ni incentivos. Una publicación desde una copia vieja no puede reabrir un estado operativo pausado.

La revisión confirmó que las cuatro vistas acordadas de precios seguían únicamente como propuesta. Se incorporan a Productos: Lista esencial inicial, Lista con editor lateral, Tarjetas y Comparador, con favoritos, selección en lote, fotos, detalles plegables, precios fijados y colores por canal. Conserva tabla avanzada/grilla anterior y el mismo editor/fórmula/historial. El concepto Carta visual de la tienda continúa aprobado como propuesta; esta preparación no lo despliega.

No se cambiaron datos del negocio ni estados reales, no se escribió en Supabase ni se publicaron instaladores o web. Pendiente despliegue conjunto de migración `20261027010000_delivery_service_state.sql`, funciones de envíos/pagos, plantilla y app. La revisión visual usa exclusivamente una pizzería ficticia sin conexión; no representa los precios ni el estado de Sahten. Resultado final de comprobaciones se registra al terminar.

Comprobación final de esta preparación: **652 pruebas / 70 archivos** aprobados. Después del ajuste de la preferencia inicial se repitieron 29 comprobaciones de Productos, estado de delivery y controlador, todas correctas. Build, scripts clásicos, versiones y revisión de diferencias correctos. Chrome: lista y editor lateral a 1366 × 768; Productos y Ajustes a 1024 × 600 con ancho de documento igual a viewport (sin desborde horizontal). El guardado desde el editor lateral conserva precio fijado e historial. Pruebas de base cubren permisos, catálogo antiguo, rechazo REST de envíos y acreditación de una reserva de MP previa a la pausa. No hubo pruebas físicas en Windows ni despliegue productivo.


### 26/10/2026 — Publicación 0.4.28 autorizada

El dueño indicó «publica» tras revisar la apertura de delivery, los ajustes separados y las cuatro vistas de Productos. Se autoriza integrar por merge normal, publicar instaladores Windows/Mac, plantilla web y migración/funciones necesarias. Se conserva el catálogo actual, precios, disponibilidad, tarifas, horarios y credenciales, sin crear pedidos ni pagos. La Carta visual del menú y checkout sigue siendo propuesta local, fuera de esta publicación. Verificación de despliegue pendiente.


### 27/10/2026 — Sahten 0.4.28 publicada y verificada

- PR #33 integrado por merge normal `956e7652b2d8ca2c7cf8b2b2fdfe75b9bb34b138`, etiqueta `v0.4.28`. CI del PR y proceso Release `40437632154` correctos: pruebas, Windows, Mac universal y publicación. Release público desde el 27/10 a las 02:30:55 UTC (26/10 a las 23:30:55 Argentina). Comprobación final del 27/10: manifiesto del actualizador en 0.4.28, siete entradas de plataforma con firmas y las tres descargas únicas con respuesta 200.
- Web Cloudflare Production `05db7a62-01b0-4102-98e5-0a23a8501b31`, éxito a las 02:23:22 UTC. Los 17 archivos coinciden por SHA-256 con la carpeta generada y cuatro fotos públicas devuelven 200. Se conservaron los 35 productos actuales con sus precios, sitio, conexión y política de delivery. Chrome comprobó catálogo, carrito editable, descuento, medios de pago y aviso fuera de horario debajo del selector, sin completar datos ni enviar pedidos.
- Aplicada la migración `20261027010000 / delivery_service_state` desde el panel de Supabase en una transacción, después de verificar que el conector falló por solicitud vencida sin aplicar cambios. Tablas privadas con RLS, permisos autenticados y rechazo anónimo comprobados. Servicios `sahten-delivery` v7 y `sahten-payments` v10 activos. Los hashes de ambos catálogos permanecieron iguales y la tabla del estado operativo quedó vacía: no se pausó ni reactivó el negocio para la prueba. Mercado Pago permanece habilitado en producción.
- 652 pruebas de 70 archivos aprobadas tras alinear la versión; compilación, scripts clásicos, versiones y diferencias correctos. No se afirma instalación nativa ni impresión física. No se crearon órdenes/pagos, no se publicaron precios nuevos ni se modificaron credenciales, tarifas u horarios.
- Este estado reemplaza las referencias anteriores de preparación o despliegue pendiente. En la app actualizada: Ajustes → Negocio → Delivery para pausar/reactivar y Productos → selector de vista para Lista esencial, editor lateral, Tarjetas y Comparador. La Carta visual de menú/checkout continúa como propuesta independiente; no forma parte de 0.4.28. Evidencias y guía en `entregables/publicacion-0.4.28/` del espacio de trabajo.


### 27/10/2026 — Carta visual y checkout aprobados: implementación

Tras confirmar la publicación 0.4.28, el dueño indicó «hazlo» respecto de la Carta visual pendiente. Se implementa el concepto ya elegido: búsqueda por nombre, categoría y descripción; tarjetas con fotografías, dos columnas en celular y tres en escritorio; pedido lateral editable en escritorio y acceso fijo en celular. El checkout conserva dos pasos y agrupa entrega, contacto y pago, con datos opcionales plegables y resumen separado en escritorio.

Se conserva la marca y el contenido configurados por negocio, sin datos comerciales nuevos. El aviso de descuento se obtiene de la política real; el precio del producto, beneficio, envío, vuelto, pausas, horario, recorrido y Mercado Pago continúan con el motor existente. No requiere migración ni desplegar servicios de Supabase. La revisión local usa una copia del catálogo con conexión a respuestas ficticias locales; no genera órdenes o cobros reales. Verificación y publicación de plantilla/app pendientes de cerrar.


Publicación coordinada de 0.4.29 en curso: el «hazlo» continúa la implementación y publicación del concepto aprobado. El paquete se generó con los 35 productos actuales de la nube, precios verificados y sitio/logos/conexión/política conservados. No requiere ni se ejecuta una migración o cambio de servicios. Revisión en Chrome local: 1366 × 768, 1024 × 600 y celulares de 390/320 px, sin desborde del documento; carrito, datos conservados, efectivo/vuelto y Mercado Pago mediante respuestas ficticias locales, sin enviar. Al editar una dirección se quitan de totales y botones de pago los cargos de envío anteriores mientras se valida la nueva. Resultado final de suite/instaladores/hosting se registra al finalizar.


### 27/10/2026 — Carta visual 0.4.29 publicada en la web

Cloudflare Production `59b798a9-0aeb-42b2-b946-6795836cbf6e`, éxito a las 05:05:33 UTC (02:05 Argentina). Diecisiete archivos coincidentes por SHA-256 con el paquete revisado; cuatro fotos públicas 200; 35 productos y precios actuales conservados. Chrome productivo confirma la búsqueda sin tildes, pedido lateral editable, descuento configurado y segundo paso con modalidades, aviso fuera de horario, campos opcionales y Mercado Pago. Se agregó un producto solo al carrito local para revisar la pantalla; luego se quitó y quedó vacío. Sin datos personales completados, pedidos enviados, pagos ni errores de consola.

PR #34 integrado por merge normal `238e3e1b9f0223c6d7225cf86a8230507eb1b1d3`, CI correcto; etiqueta `v0.4.29`. Las 657 pruebas en 70 archivos, compilación, versiones y scripts clásicos pasaron. Instaladores en el proceso `40453320938`; publicación final pendiente de comprobación. No hubo cambios en Supabase ni en credenciales, estados reales, precios, zonas u horarios. Esto reemplaza el estado de «propuesta» de Carta visual: ya es la plantilla publicada; la app instalada debe recibir 0.4.29 para conservarla al volver a exportar.


### 27/10/2026 — Sahten 0.4.29 publicada y verificada

- Release [v0.4.29](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.29) pública desde las 05:16:22 UTC (02:16:22 Argentina). Proceso `40453320938` completo y correcto: pruebas, Windows, Mac universal y publicación. El manifiesto del actualizador anuncia 0.4.29, con siete entradas de plataforma, firmas presentes y las tres descargas únicas con respuesta 200. No se afirma instalación nativa desde este chat.
- La Carta visual y checkout ya están implementados en la plantilla de la app y desplegados en https://sahten.online/pedir/. Web Production `59b798a9-0aeb-42b2-b946-6795836cbf6e`: 17 archivos verificados por hash, cuatro fotos públicas 200, 35 productos y precios conservados. Chrome verificó además la web publicada en tamaño de celular, sin desborde horizontal, con el logo original y la navegación presentes.
- 657 pruebas en 70 archivos aprobadas; compilación, scripts clásicos, versiones y diferencias correctos. PR #34 integrado por merge normal; etiqueta conservada. No se modificaron servicios ni tablas de Supabase, tarifas, descuentos, horarios, credenciales o estados reales. No se enviaron pedidos, mensajes ni pagos.
- Este estado reemplaza las referencias anteriores a instaladores en construcción y concepto pendiente. Actualizar la app a 0.4.29 conserva el diseño al exportar nuevamente; la web ya está actualizada y puede verse recargando la pestaña. Evidencia, capturas de escritorio/celular, carpeta, ZIP y guía en `entregables/publicacion-0.4.29/` del espacio de trabajo.


### 28/10/2026 — Mercadería e inventarios preparados, sin publicar

- Se prepara un catálogo privado de Mercadería para productos terminados de proveedores: costo por presentación/unidad, proveedor, uso en recetas/combos y creación de productos de reventa sin receta. Comparte cálculo de costos, inventario y registro histórico privado de las nuevas ventas. Traslado explícito desde Ingredientes solo para artículos en unidades; sin modificar el proyecto real.
- Por ampliación del dueño, se prepara la misma claridad de interfaz para Ingredientes, Envases y Stock, acciones de tres puntos y mejoras de navegación/columnas fijas en la tabla avanzada de Productos. Detalle en [MERCADERIA.md](MERCADERIA.md).
- La web recibe únicamente el producto de venta y su precio final; no los proveedores ni costos de compra. No hay cambios en la plantilla de la web, catálogos productivos, precios, Supabase, cobros, horarios o delivery. La última versión publicada sigue siendo **0.4.29**; estos cambios requieren una futura publicación de la app. Validación final se registra al terminar.


### 28/10/2026 — Autorizaciones y pausas por zona en vivo: preparación

El dueño pidió desactivar Requiere autorización de Zona 1 y evitar publicar el catálogo completo para cada cambio posterior. Se preparan los controles por zona (enabled/requiresAuthorization) con RPC autenticado de dueño/admin, estado privado por negocio, cola persistente y protección frente a publicaciones antiguas. La web abierta consulta los flags cada 10 segundos y conserva precios/tarifas del carrito; los otros equipos leen los estados sin arrastrar el borrador económico. Auditoría de los demás interruptores y límites en [CONTROLES-EN-VIVO.md](CONTROLES-EN-VIVO.md).

Lectura del catálogo productivo confirmó Zona 1 habilitada con autorización, zonas 2–4 habilitadas sin autorización, Zona 5 y Excepcional pausadas. **Todavía no se cambió ese dato en producción**: requiere desplegar la migración y la app, y aplicar el control desde la sesión dueña. Sin cambios de tarifas, mínimos, horarios, descuentos, credenciales, órdenes o pagos. La última versión pública sigue siendo 0.4.29; implementación y verificación local en curso.

Verificación local final de esta preparación: **674 pruebas en 73 archivos aprobadas**, compilación, scripts clásicos, coherencia de versiones y revisión de diferencias correctos. PostgreSQL local confirma dueño/admin, rechazo a cajero/anónimo/otro negocio, actualización de un único flag y protección frente a publicación vieja. La prueba de checkout abierto recibe pausa/autorización conservando precio y foco, sin crear órdenes. Chrome a 1024 × 640 confirma los controles agrupados y documento sin desborde horizontal, con un proyecto ficticio sin conexión. Evidencia en `entregables/controles-en-vivo-2026-10-28/`. Servidor, app pública y web productiva todavía sin cambiar; la autorización real de Zona 1 sigue activa hasta aplicar la operación después del despliegue inicial.


### 28/10/2026 — Publicación conjunta 0.4.30 autorizada

El dueño confirmó publicar app Windows/Mac, plantilla web y migración de zonas en vivo junto con Mercadería, inventarios y tabla avanzada. Después se desactivará únicamente Requiere autorización de Zona 1 desde la sesión dueña; conservar tarifas, mínimos, horarios y todas las demás zonas. Publicación y operación aún pendientes de verificación. No se autoriza crear pedidos, pagos ni activar zonas pausadas.


Servidor 0.4.30 preparado: migración aplicada y registrada como **20261028233706 / delivery_zone_operations** mediante el conector. Ambos RPC rechazan al anónimo, la tabla privada queda sin filas y el catálogo conserva el hash anterior `5d4e62bd158b4870ef20b7412e79002f`; todavía no se cambió Zona 1. Verificación local de versión 0.4.30: 674 pruebas / 73 archivos, build, versiones, scripts clásicos y diferencias correctos. Carpeta web generada con **33 productos actuales** de la nube y precios coincidentes; sitio, logos, conexión y política conservados. Merge, instaladores y hosting en curso.


### 28/10/2026 — Web 0.4.30 publicada y verificada

PR #35 integrado mediante merge normal `169e3827ceef68ad63340cdc3a2a228c146c6187`, etiqueta `v0.4.30`; CI del PR correcto. Release `40789132088` construye Windows y Mac, con pruebas correctas. Cloudflare Production `b0f7a7bd-f1f2-4cf6-9543-d0d8471cde04`, éxito el 28/10 a las 23:46:47 UTC (20:46 Argentina). Los 17 archivos coinciden por SHA-256, cuatro fotos públicas devuelven 200; 33 productos actuales y precios conservados. Chrome confirma la carta, logo, navegación, fotografías y carrito vacío, sin errores de consola ni pedidos enviados.

La subida del ZIP por el panel quedó detenida y se completó por la API oficial de assets de Pages con una sesión temporal de carga, sin claves permanentes nuevas ni cambios de permisos. La tabla de estados de zona permanece vacía y el catálogo de Supabase conserva su hash previo: falta aplicar la desactivación de autorización de Zona 1 desde la app nueva al terminar los instaladores. No se modificaron precios, tarifas, mínimos, horarios, descuentos, credenciales, pedidos o pagos.


### 28/10/2026 — Publicación 0.4.30 completada y Zona 1 aplicada

Release v0.4.30 pública para Windows y Mac: workflow 40789132088 completado con éxito, instaladores y manifiesto firmado verificados. App de este equipo actualizada mediante su actualizador a 0.4.30. Web productiva verificada en el despliegue b0f7a7bd-f1f2-4cf6-9543-d0d8471cde04.

Desde la sesión dueña se desmarcó únicamente **Zona 1 → Requiere autorización**; la app confirmó «Estados confirmados en la web». La consulta independiente confirma false. Al restituir ese único booleano solo dentro de la expresión de lectura, el catálogo recupera exactamente el hash previo `5d4e62bd158b4870ef20b7412e79002f`: precios, tarifas, mínimos, beneficios, horarios, productos y demás zonas conservados. No se publicó el catálogo completo para esta operación ni se crearon pedidos o pagos. La protección por recorrido excepcional permanece. Evidencia y guía en `entregables/publicacion-0.4.30/` del espacio de trabajo. Este estado reemplaza los pendientes de publicación anteriores.

Solicitud adicional: impresión directa al confirmar desde Cobrar, por equipo y con impresora seleccionada; todavía no está implementada ni incluida en 0.4.30.


### 29/10/2026 — Impresión directa preparada; tienda sin cambios

PR #36 agrega impresora predeterminada de Sahten por equipo y modos sin diálogo independientes para Mostrador y pedidos nuevos de la web (retiro/delivery). Reutiliza la plantilla compacta y el control de duplicados; no altera pagos, precios, datos del negocio ni el hosting. 679 pruebas / 74 archivos, build y validaciones nativas de Mac/Windows aprobadas. Selección y opciones verificadas en una app local de prueba separada con proyecto ficticio y sin conexión a Supabase, sin imprimir ni crear órdenes. Guía y límites en [IMPRESION-DIRECTA.md](IMPRESION-DIRECTA.md).

Permanece **sin publicar**: Sahten pública sigue en 0.4.30 y sahten.online conserva su último despliegue. Falta una actualización de instaladores y la prueba física de la IT01 en la caja; no se afirma validación de esa impresora desde este Mac.


### 29/10/2026 — Publicación 0.4.31 autorizada

El dueño confirmó publicar la impresión directa preparada en PR #36. Se alinean las versiones a 0.4.31 y se prepara merge normal e instaladores firmados de Windows/Mac. La web y Supabase conservan su estado; no se activan modos de impresión ni se crean órdenes o trabajos de impresión reales. Publicación en curso, pendiente de verificar los instaladores y el manifiesto del actualizador. Prueba física de IT01 pendiente en caja.


### 29/10/2026 — Sahten 0.4.31 publicada y verificada

PR #36 integrado con merge normal `86fea46aa8b0db1ffb3272ef3b9474d16dd82b6f`; etiqueta `v0.4.31`. CI general/nativo correctos y Release `40830764350` finalizada con éxito. Windows EXE/MSI y Mac universal publicados el 29/10 a las 03:55 de Argentina. Manifiesto público del actualizador en 0.4.31 para siete destinos; sus tres paquetes únicos descargados y firmas criptográficas de archivo/comentario verificadas con la clave pública configurada. DMG accesible; 679 pruebas / 74 archivos aprobados para la versión.

La publicación de impresión queda completada; actualizar la app en cada equipo y seleccionar su impresora desde Ajustes → Negocio → Impresión. No se modificó sahten.online ni Supabase, no se cambiaron preferencias de impresión de las cajas y no se crearon órdenes o trabajos reales. Falta la prueba física de la IT01 en el equipo donde está instalada. Guía y comprobación en `entregables/publicacion-0.4.31/` del espacio de trabajo. Este estado reemplaza el pendiente de publicación anterior.


### 29/10/2026 — Fotos, movimiento y propuesta editorial (sin publicar)

El dueño entregó `SAHTEN-FOTO-Exportadav2.af` (foto de cuatro personas en el local) e `IMG_1107-Exportada.png` (la Sitto de Marcel, contexto confirmado por el dueño). Se conserva una exportación web en `docs/brand/sahten/photos/`: 1024×768 / 132 KiB y 1065×1600 / 332 KiB, respectivamente. Del documento Affinity se extrajo su vista PNG embebida de 1024×768, sin afirmar que sea la exportación de máxima resolución. Nuevos campos genéricos preparados para una segunda foto, texto alternativo y pies de foto; pendientes de una próxima versión de la app. La carga de las fotos en el proyecto del dueño todavía no se realizó; el JSON de contenido no importa imágenes.

Datos personales públicos confirmados por el dueño para la propuesta: **Marcel Kamisso**, voz en primera persona y parte del proyecto; **María T. Ortega Levi de Kamisso**, chef; **Choukri Antonio Kamisso** y **Daniel Campos Lozada**, integrantes del proyecto sin otras funciones atribuidas. La denominación «principal» es contexto interno, no texto público. Propuesta: relato breve de Marcel en la home, nombres completos de los cuatro en Nuestra historia. Pendiente aprobación del copy y la disposición definitiva.

Se prepara movimiento funcional de 100–280 ms, tiempos menores en celular, sin cinta infinita y con `prefers-reduced-motion`. Vista local de propuesta separada de producción, sin conexión a pedidos/pagos. No se publicó en Cloudflare ni se escribió en Supabase. Los textos viejos de mínimos/gratuidad de delivery siguen publicados y se detectan como contradictorios con las reglas por zona; se propone reemplazarlos, sin cambiar tarifas ni beneficios.


Revisión de la propuesta (29/10): el dueño pidió una voz más cálida y profesional, más contexto y bajar la foto del grupo. Se amplió el borrador de Marcel a dos párrafos, conservando los hechos confirmados. El grupo baja 24 px en la retícula y se coloca en un marco crema de 28 px arriba (22 px en celular), sin inventar fondo ni retocar a las personas. Sigue siendo una propuesta local; sin publicación ni escritura en Supabase.

Nombre de la Sitto confirmado posteriormente por el dueño: **Marcelle Wakil**, abuela paterna de Marcel Kamisso. Incorporado al borrador en primera persona, al texto alternativo y al pie del retrato familiar. Pies propuestos: «El equipo de Sahten, en nuestro local de Vicente López.» y «Con mi Sitto, Marcelle Wakil. Sus recetas son el origen de Sahten.» Siguen sin publicar.

Los pies de foto se muestran a 14 px con un tono secundario de mayor contraste (`#536256` sobre el fondo crema). El borrador cálido y los dos captions se revisaron visualmente en Chrome; la foto de grupo se baja dentro de la composición con un marco, sin modificación generativa del fondo.


**Corrección que reemplaza el encuadre anterior (29/10):** el dueño rechazó la variante con fondo extendido y pidió utilizar la foto original aunque tenga poco aire sobre las cabezas. Esa variante no se incorporó a la web ni a Supabase y fue retirada de la carpeta de fuentes publicables. Se quita el marco crema y se usa una composición asimétrica: grupo más ancho y 40 px más abajo; retrato más estrecho y elevado; en celular, retrato con sangría suave. Las fotos originales optimizadas y sus captions se conservan. Propuesta local sin publicar.


### 29/10/2026 — Historia, fotos originales y movimiento publicados

El dueño autorizó publicar tras aprobar el relato cálido de Marcel, los captions con Marcelle Wakil y la composición asimétrica usando las fotos originales. PR #37 integrado con merge normal `621778aa68caab4a7f52ab56dbd9fd4970baf2b6`; CI `40932262930` correcto. Cloudflare Production `084bb1d6-9cf8-4c3f-9992-2620c6540056`, completado el 29/10 a las 15:41 de Argentina. Home y página Nuestra historia incluyen las dos fotos; esta última presenta los nombres completos del equipo. Logos originales y caligrafía conservados. Se mejoran contraste y movimiento de controles, sin cinta infinita.

Verificación: 683 pruebas / 75 archivos, build, scripts clásicos, versiones y contraste de marca correctos. Chrome a 360/390/640 px en preferencias clara/oscura y escritorio; movimiento reducido emulado: botones a 0s y diálogo sin animación. Preferencias temporales restauradas. Los 19 archivos públicos coinciden por SHA-256; catálogo público de Supabase idéntico antes/después, 33 productos, precios, fotos de productos, pagos y delivery conservados. No se escribieron menus/projects/orders ni se enviaron pedidos o pagos.

Las fotos generadas/extendidas fueron descartadas y excluidas de la publicación. Evidencia de producción y paquete en `entregables/web-foto-motion-2026-10-29/publicacion/` del espacio de trabajo. Revisión de skills y límites en [REVISION-HOME-2026-10-29.md](REVISION-HOME-2026-10-29.md) y [MOVIMIENTO-WEB.md](MOVIMIENTO-WEB.md). Esta publicación actualiza la web; los instaladores siguen en 0.4.31 y el proyecto dueño no importa automáticamente fotos/contenido. Para futuras exportaciones, incorporar los campos nuevos y el JSON/fotos preservados antes de reemplazar la carpeta. Los textos viejos de mínimos/gratuidad por zona siguen pendientes por decisión previa del dueño.


### 30/10/2026 — Horarios independientes y publicación urgente 0.4.32

El dueño confirmó apertura desde las 12:00, conservando cierre de mediodía 15:30, turnos nocturnos y domingo cerrado, y pidió publicar en paralelo app y web con urgencia. Maps mostraba 11:00: prima la corrección expresa del dueño; no se modifican Google ni Ads. Mostrador solo advierte fuera de apertura y permite cobrar. Retiro web respeta apertura, delivery su calendario independiente. La consulta de solo lectura encontró 31 productos vigentes: se conserva ese catálogo, sin recuperar los 33 de la carpeta anterior.

Preparados calendarios por tienda/servicio con permisos dueño/admin, revisión para evitar sobrescrituras, cola local y protección frente a publicación desde apps antiguas. La web consulta cambios cada 10 segundos y al recuperar foco, sin aplicar precios nuevos al carrito. Las páginas informativas consultan solo los calendarios públicos; la copia HTML para buscadores sin JavaScript conserva la última exportación. Pagos iniciados antes del cierre y ventas anteriores conservan su curso. Guía: [HORARIOS-Y-DELIVERY.md](HORARIOS-Y-DELIVERY.md).

Pruebas, despliegue de servidor, configuración desde la sesión dueña, hosting y publicación de instaladores en curso. No afirmar aplicación productiva hasta comprobar cada paso. El reporte del cliente no trae su mensaje exacto; las regresiones verifican retiro al mediodía con delivery cerrado y cierre por servicio, sin afirmar reproducción exacta del incidente original.

Verificación previa 0.4.32: **709 pruebas / 78 archivos aprobados**, build, scripts clásicos, versiones y diferencias correctos. Deno comprueba ambos servicios; la advertencia heredada allowJs se ignora por Deno y no impide compilar. Chrome confirma los dos calendarios y el nombre nuevo con un negocio ficticio aislado, sin desborde a 1200 px. Consulta pública parcial de calendarios probada en Supabase con respuesta 200. Todavía no se confirma despliegue ni instalación de horarios en el negocio.


Servidor y web publicados el 30/10/2026: migración `20261030150815 / store_service_hours` aplicada; `sahten-delivery` v8 y `sahten-payments` v11 activos, autenticación propia conservada. RPC de lectura/escritura de horarios rechazan al anónimo (401); tabla privada sin acceso directo. Asesores señalan los RPC autenticados intencionales y la tabla privada con RLS sin políticas; permisos por negocio/rol verificados, sin nuevas llamadas anónimas. No se modificaron los catálogos durante el despliegue (Sahten hash `3118cf32eea29100eb0bcbe7b2a43de0`, 31 productos; segundo negocio idéntico). Calendarios privados todavía sin filas: la configuración de las 12:00 se aplicará desde la sesión dueña en la app nueva.

PR #38 integrado por merge normal `792d35103c5b314c2c715d3b510f2dbe15473928`; etiqueta v0.4.32 y Release `41078150343` en construcción. Cloudflare Production `0ca67e8d-62ba-4012-ad9a-5d9c8a427df3`, éxito a las 15:10:20 UTC: 19 archivos coinciden por SHA-256, cuatro fotos públicas 200, 31 productos y catálogo actual preservados. Chrome muestra retiro disponible al mediodía y delivery cerrado hasta las 18:00 sin enviar compras. Configuración pública de pagos 200, enabled=true / production; no se crearon pedidos ni pagos. Evidencia en `entregables/publicacion-0.4.32/`. La confirmación de horario guardado, reconstrucción de respaldo y publicación de instaladores se registran al terminar.


### 30/10/2026 — 0.4.32 instalada, horarios activos y publicación completada

Release [v0.4.32](https://github.com/danielcamposlozada/sahten/releases/tag/v0.4.32) pública: proceso `41078150343` completo y correcto en pruebas, Windows, Mac universal y publicación; CI del merge `41078102032` correcto. `latest.json` anuncia 0.4.32; Windows MSI/EXE y Mac descargados, firmas criptográficas de archivo y comentario verificadas; DMG accesible. La app de esta Mac se actualizó desde 0.4.30 por su actualizador y muestra 0.4.32, con proyecto y sesión dueña conservados.

Desde **Ajustes → Negocio → Horarios y delivery**, se guardaron los calendarios normales mediante sus botones: apertura/retiro desde 12:00 (revisión `6bb684cb-3510-45f8-9540-b6b15df3206f`, 15:24:08 UTC), delivery nocturno original sin cambios (revisión `c029dfe8-17f2-4526-9a66-44b144e6b72a`, 15:25:14 UTC). Ambos muestran **Horario confirmado en la web**. Una pestaña productiva abierta antes de guardar recibió el calendario de apertura sin recargar ni subir archivos; retiro disponible al mediodía y delivery cerrado hasta 18:00. No se enviaron órdenes, WhatsApps ni pagos; carrito de comprobación vaciado.

Eliminando solo los dos campos nuevos de horario en una consulta de lectura, el catálogo de Sahten conserva exactamente el hash `3118cf32eea29100eb0bcbe7b2a43de0` (31 productos). Productos, precios, fotos, tarifas, mínimos, beneficios, disponibilidad y pagos idénticos; segundo negocio sin cambios. No hubo escrituras SQL directas sobre menús/proyectos/pedidos para configurar el horario: se usó el RPC de la app autenticada.

Respaldo y páginas estáticas reconstruidos con los calendarios ya activos. Dos FAQ que todavía decían atención solo nocturna remiten al horario vigente de la página; los textos comerciales antiguos sobre mínimo/gratuidad permanecen pospuestos. Contenido conservado en `docs/brand/sahten/sitio-publicado-2026-10-30.json`. Despliegue final Cloudflare Production **69f0137b-ddb5-4aaf-8e16-2d74d592cfe8**, éxito a las 15:27:24 UTC: 19 archivos por SHA-256, 4 fotos públicas 200, catálogo público idéntico al paquete. Sustituye `0ca67e8d` y todos los pendientes de publicación anteriores de esta sección. Actualizar a 0.4.32 los demás equipos; futuros horarios se guardan desde la misma sección sin exportar ni publicar catálogo. La investigación del rediseño de home continúa separada de esta actualización.


Investigación posterior de home (sin implementación): el dueño confirmó el 30/10/2026 que el nombre correcto del postre es **Aristelos**. El catálogo vigente aún usa Aristilos (Porcion): la confirmación se registra para los borradores; no se renombró automáticamente en la nube. La vigencia comercial de Tabla Compartir sigue por confirmar; se puede estudiar el reel sin afirmar disponibilidad. Rappi original 200856 fue legible en Chrome antes de redirigir tras hidratar; se guardaron notas factuales fuera del repo, sin importar precios/promociones.


### 30/10/2026 — Opciones de home y auditoría preparadas, sin implementar

Investigadas visualmente en Chrome las tres referencias de Dribbble entregadas; se extrajeron principios de jerarquía editorial, fotografía de comida, retícula y expresión gráfica, sin copiar marcas ni composiciones completas. Preparadas tres maquetas locales con escritorio y celular: **Mesa de familia**, **Cocina a la vista** y **Carta de encuentros**. Incluyen los tres reels de comida juntos y el tutorial separado, fotos familiares originales, logos íntegros y copy aprobado. La elección del dueño precede al rediseño. Evidencia, imágenes, páginas navegables, fuentes, briefing y comprobaciones en `entregables/rediseno-home-2026-10-30/` junto al repositorio. No están desplegadas ni incluidas en 0.4.32.

Auditoría completa en Word/PDF (12 páginas): seis páginas públicas, robots y sitemap, con fuentes actuales y límites de medición. Señala descripciones ausentes, tres metas recortadas y textos libres de delivery que el dueño había pospuesto. Los horarios/FAQ corregidos por 0.4.32 se registran como resueltos. Las notas editoriales no son mediciones de ranking, tráfico o Core Web Vitals. El tutorial entregado aún incrusta envío gratis $45.000 y horarios anteriores: debe actualizar su cierre antes de publicarse; los cuatro originales no se cargan todos al abrir la home.

Pedido adicional confirmado: las **descripciones de productos se actualizarán automáticamente al guardar desde la app**, sin exportar archivos. Requisito incorporado al briefing del editor y a la auditoría: operación aislada por producto/negocio, revisión y cola con confirmación, sin publicar precios pendientes; una fuente común para contenido visible y HTML/SEO. Es una implementación futura, no una función terminada de 0.4.32. Los horarios operativos ya están activos en vivo; el resto del publicador de contenido todavía requiere implementación.
