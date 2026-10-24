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
| Beneficio confirmado el 24/10/2026 | 10 % con efectivo o transferencia, solo productos (envío sin descuento), en web y Mostrador. No acumulable: aplicar el mayor descuento de la orden. Pendiente de activación/publicación |
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
5. Resuelto el 24/10/2026: 10 % por efectivo o transferencia; solo productos, web y Mostrador, sin acumular (se aplica el mayor). Activación pendiente.
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
