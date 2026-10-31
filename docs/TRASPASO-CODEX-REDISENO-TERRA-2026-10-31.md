# TRASPASO INTEGRAL A CODEX — Rediseño Terra de Sahten
Fecha de preparación: 2026-10-31
Propósito: que cualquier agente o Codex pueda retomar el trabajo sin reconstruir la conversación ni poner en riesgo el negocio.

## 0. ENTRAR POR ACÁ
- Repositorio: danielcamposlozada/sahten.
- Rama de trabajo: feat/terra-home-carta-integracion.
- PR de revisión: https://github.com/danielcamposlozada/sahten/pull/40 (DRAFT).
- Base al inicio: main / Sahten 0.4.33 / 63b2fb31c2be2d1a99a2d2167f5417abdc920740.
- Web real: https://sahten.online (Cloudflare Pages, proyecto sahten-menu).
- Descripción del alcance y prohibiciones: docs/REDISENO-TERRA-INTEGRACION.md.
- Fuente visual original: ZIP suministrado por el dueño, rediseno-home-2026-10-30.zip; NO está alojado en este PR. Recuperar del dueño si necesitás los HTML y pantallazos de comparación exactos.
- **IMPORTANTE: no hacer merge, deploy, escritura a Supabase ni publicación de precios/beneficios sin autorización nueva del dueño.**
- La integración no fue declarada funcional/visualmente aprobada. El objetivo es máxima fidelidad al rediseño, sin regresiones.

## 1. DECISIÓN DE DISEÑO Y ORIGEN
La conversación con el modelo Terra cerró la dirección C unificada + opción tipográfica 3 pulida.
Archivos de referencia dentro del ZIP de Terra:
- tipografia/tipo-3-home-pulida.html
- tipografia/tipo-3-carta-pulida.html
- tipografia/pulido.css y tipografia/pulido-criterios.md
- vistas PNG desktop/móvil y recursos en las carpetas de conceptos, carta y fotos.

Dirección:
- Familias tipográficas: DM Sans para interfaz y titulares; Lora Italic para acentos editoriales, no para párrafos extensos. Lora cargada condicionalmente.
- Verde base #235328, naranja #E9953C en bloques editoriales, beige #FFF4D6, texto oscuro #213326. Mantener contraste.
- Botón destacado beige sobre la barra verde; módulos narrativos con fotos reales, márgenes grandes, retícula editorial y tarjetas de comida amplias.
- Títulos 44 px desktop / 34 px móvil aproximadamente; texto de lectura 18 px desktop / 16 px móvil; fotos de catálogo 180/155 px. Son criterios, deben ajustarse tras comprobar contenido real.
- Mantener logo Sahten original y fotos familiares sin regenerar rostros.
- NO usar prototipos como página real; sus categorías, 31 productos y carrito eran de demostración. 0.4.33 tenía 28 ítems vigentes como referencia histórica; consultar el catálogo actual, que puede cambiar.
- Los videos MP4 finales NO estaban en el ZIP; quedan pendientes, no inventar archivos ni thumbnails que los simulen.

## 2. CONTRATO FUNCIONAL INNEGOCIABLE
El usuario exige que funcione **todo** como antes. No modificar lógica existente de:
- Carrito, cantidades, productos/categorías, pedido, estado, cálculo de totales.
- Retiro en local y delivery, zonas geográficas, direcciones, distancias, mínimos por zona, tarifas, beneficios, descuentos y barra de progreso.
- Horarios de apertura/retiro y de delivery independientes y cambios en vivo, pausas comerciales y disponibilidad de productos.
- Mercado Pago, efectivo/otros pagos configurados, WhatsApp y retornos a la tienda desde la pasarela.
- Actualización en vivo de catálogo/condiciones vía Supabase, pedidos online, Mostrador y app Mac/Tauri.
- SEO/GEO/AEO: metadatos, canonical, robots, sitemap, Restaurant, Menu, FAQPage, BreadcrumbList, páginas indexables e integración con buscadores.
- Web accesible: keyboard/foco, menú responsive, reduced motion, alt real, elementos accionables.

El editor y el generador de archivos siguen siendo la **fuente de publicación**. No reemplazar src/online/web/index.html por los HTML de Terra. No tocar tablas comerciales ni órdenes en producción para ensayar estilos.

## 3. CAMBIOS IMPLEMENTADOS EN ESTA RAMA
1. src/online/site.js:
   - Campo de visualización opt-in visualStyle = "terra-2026".
   - Valor por defecto "classic", por compatibilidad.
   - Se conserva en normalizeSite/buildSite y exportar/importar contenido.
   - No se activa automáticamente por usar el ZIP.
2. src/online/publish.js:
   - Genera home y /pedir/ con atributo data-visual-style exclusivamente si se eligió Terra.
   - Inyecta la hoja de estilos Terra y Lora Italic condicionalmente.
   - Conserva las rutas de imágenes, menu.json, scripts compartidos, checkout, SEO y vistas.
3. src/online/web/terra.css:
   - Hoja visual aislada por data-visual-style.
   - Hero, navegación, CTA, destacados, carta, relato, preguntas frecuentes, páginas informativas y mobile.
   - CSS responsive y tipografía; revisar pixel a pixel comparando con el ZIP de Terra.
4. src/online/web/index.html:
   - Nuevos renderers de presentación terraHero, terraMenu, terraFavorites, terraHow y terraFaq.
   - Se usan SOLO cuando site.visualStyle = "terra-2026".
   - Consumen MENU.products, imágenes reales, categoría, pausas y visibilidad, y llaman al orderHref existente.
   - El modo clásico mantiene los renderers de siempre; compras siguen en código actual.
   - La historia enlaza a /nuestra-historia/ cuando la página existe.
5. src/online/pages.js:
   - Aplica la identidad editorial, solo con Terra activo, a /menu/, /delivery-y-retiro/, /catering/ y /nuestra-historia/.
   - No elimina ni reemplaza SEO ni scripts de horarios en vivo.
6. src/legacy/sahten-siteeditor.js:
   - Selector "Clásico (actual)" / "Editorial Terra · opción C" en Menú Online > Sitio web.
   - Guardado y vista previa real con el generador. No activa Terra por defecto.
7. docs/brand/sahten/sitio-terra-borrador-2026-10-31.json:
   - BORRADOR de contenido completo para importar/revisar, NO publicado.
   - 11 FAQ reales conservadas con respuestas comerciales revisadas.
   - Cambió títulos/secciones a dirección C, conservando historia familiar, catering, reseñas verificadas y metadatos.
   - El archivo de origen sigue intacto: docs/brand/sahten/sitio-publicado-2026-10-30.json.
8. tests/terra-redesign.test.js:
   - Protección de opt-in, importación/exportación, 11 FAQ en HTML y JSON-LD, páginas propias, canonical, catálogo de prueba, checkout sin envío real, imágenes ocultas y selector de editor.
   - Otros tests del proyecto permanecen sin editar.
9. docs/REDISENO-TERRA-INTEGRACION.md:
   - Contrato general y secuencia de aceptación inicial.

**Advertencia:** esto es integración técnica en curso, NO certificación de que las capturas sean idénticas al prototipo. No se hizo deploy de preview final.

## 4. CONTENIDO REAL, FAQ Y CAMBIOS COMERCIALES
El snapshot original tenía **11 FAQ** y algunas respuestas obsoletas: envío gratis desde $45.000, radio aproximado 6 km y delivery hasta las 23 h. No replicar esos números en el diseño nuevo.
El borrador reemplaza dichas afirmaciones por explicación basada en la cotización vigente de la tienda. Las políticas reales deben salir de la configuración en vivo; respetar el motor geográfico, la dirección del comprador y permisos.
Los horarios de entrega NO son los horarios de atención/retiro; verificarlos de forma independiente. La app puede guardar configuraciones comerciales sin publicar el catálogo. No restaurar información del snapshot sobre el servidor.
Un solo objeto de contenido debe alimentar el texto FAQ visible, contenido accesible sin JS y schema FAQPage. No crear manualmente una segunda lista HTML distinta del JSON-LD.
Revisar etiquetas de productos: la maqueta no es autoridad de nombres. No restituir 31 ítems ni volver a publicar precios pendientes.
Mantener la fuente de datos de página completa (historia, catering, delivery, menú informativo, footer, reseñas). Evitar FAQ recortadas y páginas abreviadas; comprobar mobile con textos completos.

## 5. ESTADO DE PRUEBAS: NO OCULTAR FALLOS
- En varios runs anteriores, el conjunto preexistente pasó y falló **una prueba nueva** en tests/terra-redesign.test.js (no el carrito).
- Run 41173242632 asociado al commit 0e6ad47b: 734 pruebas aprobadas, 1 fallida en una aserción que comparaba robots meta inexistente con .toContain (undefined), que se corrigió en el commit be08719c.
- La prueba anterior de CSS también fue corregida: el entorno Vitest simula importaciones CSS ?raw; ahora se comprueba el CSS fuente y su inyección; Vite debe verificar la salida compilada.
- **Comprobar el resultado del CI del HEAD ACTUAL** y los dos builds. No declarar CI verde por los runs antiguos; no hacer merge si un test falla.
- Sin una vista visual y una verificación de compra end-to-end en entorno seguro, NO se puede asegurar "todo 100 %".
- Las pruebas de carrito disponibles no generan pedidos ni realizan cobros.

Comandos de continuación:
  git fetch origin
  git switch feat/terra-home-carta-integracion
  git pull --ff-only
  npm ci
  npm run check:versions
  npm test
  npm run build
  SAHTEN_ONLINE=false npm run build

Seguir AGENTS.md, docs/SEO-GEO-AEO.md, docs/PUBLICAR.md, docs/ARQUITECTURA.md y CHANGELOG.md. Registrar en CHANGELOG "Sin publicar" los cambios visibles antes de una versión.

## 6. PRIORIDADES PARA CODEX AL RETOMAR
A. Revisar CI del HEAD y corregir fallos reales.
B. Levantar la vista previa REAL del generador con el JSON borrador y catálogo simulado (nunca datos de órdenes reales).
C. Comparar con tipografia/tipo-3-home-pulida.html y tipografia/tipo-3-carta-pulida.html del ZIP; corregir composición sin reemplazar checkout.
D. Probar desktop y móvil: 320, 390, 640, 1024, 1440 px; foco, menú, FAQ desplegada, títulos largos, fotos faltantes, tamaños y contraste.
E. Verificar menú de pedido: añadir/quitar, cantidades, carrito, retiro/delivery, tarifa dinámica, mínimo, descuentos y métodos de pago (sin cobro real).
F. Verificar páginas informativas, metadata social, canonical, sitemap, robots y Schema.org. Revisar SSR/HTML legible sin JS.
G. Revisar copy completo con el dueño, fotografías originales y autorización del uso de videos.
H. Preparar preview aislada solo después de cumplir lo anterior. Solicitar aprobación; luego planificar merge/deploy con rollback y validación post-publicación.

**Nunca desplegar a sahten.online por asumir que "ok" autorizó producción.** En este hilo la autorización fue preparar integración, no publicar.

## 7. VIDEOS POR INCORPORAR
El dueño puede aportar MP4/MOV directamente en el chat, comprimidos en ZIP, o compartir links a los archivos originales con permiso de lectura. Pedir el archivo fuente original y sus indicaciones de uso.
- Preferible: tres reels originales de comida, nombrados por escena, sin texto quemado si es posible.
- Mantener proporciones originales; para web comprimir y derivar versiones optimizadas en etapa posterior, sin alterar los originales.
- Incorporar video muted/playsinline/loop solo cuando se apruebe su ubicación y haya poster accesible; respetar prefers-reduced-motion y ahorrar datos en móvil.
- El audio no es necesario para autoplay; no forzar autoplay con sonido.
- No subir videos grandes al repo ni a Cloudflare/Supabase sin acordar el hosting y las autorizaciones. Usar ruta confiable y CORS correcto.

## 8. RESUMEN PARA NUEVA SESIÓN
"Continuá el PR #40 de Sahten en feat/terra-home-carta-integracion. Leé AGENTS.md, este documento y docs/REDISENO-TERRA-INTEGRACION.md. Tenemos el diseño editorial Terra C/3 sobre los módulos reales, 11 FAQ y un selector opt-in, pero falta validar CI, fidelidad visual, videos y checkout end-to-end seguro. El negocio depende de pedidos, delivery en vivo y pagos: no modifiques estos servicios ni despliegues sin una aprobación explícita. Trabajá en la rama; mantené rollback y no publiques precios o configuraciones pendientes."

## 9. ACTUALIZACIÓN: LOS VIDEOS YA FUERON ENTREGADOS (31/10/2026)
**No repetir la solicitud de videos al usuario.** Entregó `Archive(1).zip` con los cuatro originales. Fueron inspeccionados y optimizados. Leer el inventario completo y los criterios de uso en [docs/VIDEOS-TERRA-SAHTEN-2026-10-31.md](docs/VIDEOS-TERRA-SAHTEN-2026-10-31.md).

El paquete descargable de la conversación se llama `sahten_videos_web_optimizados.zip` (~9,7 MB): los tres reels y el tutorial, cada uno en MP4 ligero + poster WebP; incluye `manifest.json` y `README-VIDEO-CODEX.md`. Hay que adjuntar ese ZIP al entorno de Codex o colocar sus archivos en el workspace; **los archivos binarios todavía no están en GitHub ni alojados públicamente**. La referencia visual `tipografia/tipo-3-home-pulida.html` contiene las tres tarjetas de reels y el bloque de tutorial separado. **El tutorial contiene capturas de la tienda anterior y precios/descuentos de ejemplo: no publicarlo sin corregirlo.** Mantener pedidos, cálculos, delivery, Mercado Pago y sincronización intactos.
