# Changelog

## 0.4.4

- **Corrección al eliminar proyectos**: al elegir «Borrar el archivo…», el cuadro para escribir el nombre quedaba detrás del anterior y la pantalla se oscurecía sin poder continuar.
- **Actualizaciones en las notificaciones 🔔**: al abrir la app de escritorio, si hay una versión nueva queda un aviso con el botón «Actualizar ahora» (ya no interrumpe con un cuadro). Los avisos de la app no dependen del proyecto abierto.
- **Ajustes reorganizado** en tres grupos: **Negocio** (marca y apariencia, canales, niveles de ganancia, tienda online y delivery), **Proyecto** (archivo y proyectos, respaldos e importación, zona peligrosa) y **Esta app** (versión y actualizaciones, ayuda y tour).

## 0.4.3

- **Sitio web por módulos** (Menú Online › Sitio web): portada, favoritos, menú, cómo funciona, historia, cinta de texto, reseñas, catering, delivery, preguntas frecuentes y contacto. Cada sección se enciende, se mueve y se edita, con vista previa real al lado y fotos para portada e historia. Página publicada rediseñada. Descripción corta por producto.
- **Proyectos**: la app entra directo al último proyecto; pantalla de proyectos tipo perfiles; bienvenida más simple; eliminar proyectos (quitar de la lista o borrar el archivo).

## 0.4.2

- **Menú Online rediseñado** en una sola pantalla: estado de publicación (sin publicar / al día / cambios sin publicar / falta completar), lista agrupada por categoría con interruptores, arrastrar para ordenar, fotos, avisos por producto (precio $0, sin categoría, sin foto), filtros y búsqueda, ajustes plegables y **vista previa del celular en vivo**.
- Corrección: la columna Precio del Menú Online mostraba $0 en todos los productos; ahora muestra el precio que se publica. «Productos visibles» ahora cuenta lo que realmente sale (respeta las categorías ocultas).
- Mostrador: cobra el precio con el descuento del canal, igual que el panel Menú.
- Demo: el canal WhatsApp no tiene recargo (mismo precio que Mostrador) y el menú ya trae título y WhatsApp de ejemplo.

## 0.4.1

- **Sin datos reales en el repositorio**: el negocio de ejemplo, los archivos de prueba, el baseline, la carpeta `reference/` y los valores por defecto (dirección, coordenadas, teléfono) ahora son ficticios. Se quitaron las referencias antiguas v2.

- Cambio de numeración: la versión pasa a ser **0.4.1** (reemplaza a 4.0.x) y se muestra en la app («Beta v0.4.1») desde una única fuente: `APP_VERSION`. Cambia a mano en cada versión (package.json, tauri.conf.json, Cargo.toml, schema.js; un test verifica que coincidan).
- Proyecto de ejemplo nuevo: **pizzería ficticia** con 6 productos, ingredientes, envases, stock, gastos fijos, canales y proyección (`scripts/pizzeria-data.mjs`, `npm run demo`).
- **Tour guiado**: se abre solo en el ejemplo y se puede repetir en Ajustes › Archivo y respaldo › «Tour guiado», también con tus propios datos.

- Abrir un `.json` de versiones anteriores lo convierte en proyecto y **pide enseguida dónde guardarlo** (ya no queda «sin guardar»).
- Ajustes › Archivo y respaldo: «Dónde está guardado» (ruta, mostrar en carpeta, cambiar ubicación), «Carpeta de proyectos» (escritorio) e «Importar datos» (como proyecto nuevo, o reemplazando los del proyecto abierto con respaldo previo).
- El indicador «Sin guardar» ahora se puede tocar para guardar.

## 4.0.0 — Fase D: instaladores de escritorio (Tauri) y web/PWA

- **Sin CDN**: Chart.js, Leaflet, SheetJS y las fuentes DM Sans / DM Mono van empaquetadas (Leaflet y SheetJS se cargan al primer uso). El build no pide nada a servidores externos.
  El mapa (OpenStreetMap) y la búsqueda de direcciones (Nominatim) siguen necesitando internet: la app avisa y se puede cargar el envío a mano.
- **Tauri** (`src-tauri/`): ventana nativa, plugins `fs`, `dialog`, `store`, `updater`, `process`, `opener`. Abrir/guardar `.sahten` con los diálogos del sistema, guardado atómico
  (temporal + renombrado), respaldos **junto al proyecto** (`.<nombre>.backup-…sahten`), configuración de la app en el store de Tauri, descargas (CSV, ZIP) con «Guardar como»,
  enlaces y WhatsApp en el navegador del sistema, vista previa y carpeta del menú publicado.
- **Asociación de archivos** `.sahten` (doble clic abre el proyecto; una sola ventana).
- **Actualizaciones automáticas** con el updater de Tauri + GitHub Releases (firmadas con clave propia). Botón «Buscar actualizaciones» en Ajustes › Archivo y respaldo.
- **CI**: `ci.yml` (tests + builds) y `release.yml` (`tauri-apps/tauri-action`: macOS universal `.dmg` + Windows `.msi`/`.exe`, borrador de Release con `latest.json`). Firma de Apple opcional.
- **PWA**: manifiesto, íconos y service worker (la web abre sin internet), mismo código.
- [docs/INSTALACION.md](docs/INSTALACION.md): avisos de Gatekeeper y SmartScreen y cómo abrirla igual, firma opcional (USD 99/año), publicar versiones.
- Menú publicado: los mensajes de WhatsApp ya **no llevan emojis** (`wa.me` los convertía en «�» al redirigir; verificado con un redirect real). Con el menú en vivo, solo se muestran
  las fotos que existen en la carpeta publicada; si una foto no carga, se muestra la inicial del producto.
- Íconos de la app regenerados (logo más grande, legible en 32 px), `.ico` con 6 tamaños, `.icns`, PNG y PWA (maskable).
- QA final: checklist automatizado ([docs/QA.md](docs/QA.md)) y modo oscuro verificado en todos los paneles.
- Tests: 272.

## 4.0.0-alpha.3 — Fase C: online opcional por proyecto (costo $0)

- **Publicar menú** (sin backend): carpeta `index.html` + `menu.json` + imágenes optimizadas (hasta 800 px, JPEG), lista para Cloudflare Pages,
  GitHub Pages o Netlify ([docs/PUBLICAR.md](docs/PUBLICAR.md)). El pedido sale por `wa.me/<número>` con detalle, total, envío por zona y datos del cliente.
  `menu.json` no lleva costos, márgenes ni datos de clientes. La web nueva reemplaza a `Sahten Menu v2.html` (queda en `reference/`).
- **Delivery por zonas compartido** (`src/core/delivery.js`): el Mostrador, el menú publicado y la web usan la misma cuenta (círculo/polígono, envío gratis por monto, mínimo de pedido).
- **Supabase opcional** (`supabase/schema.sql`, [docs/SUPABASE.md](docs/SUPABASE.md)): tablas `stores`, `menus`, `orders` (C.2) y `projects`, `project_ops`, `project_members`,
  `project_invites`, `audit_log` (C.3), con RLS. Probado contra Postgres real (PGlite): visitante anónimo solo lee el menú y crea pedidos;
  los costos solo se leen con funciones que verifican el rol.
- **App**: conectar proyecto (URL, anon key, slug, cuenta), sincronizar menú, pedidos entrantes por Realtime en Mostrador › Delivery con notificación
  (con respaldo por consulta periódica) y el estado del pedido vuelve a la nube. Si la web no tiene conexión, se lo avisa al cliente.
- **Sincronización**: local primero (el `.sahten` siempre se guarda), cola offline con reintentos, conflictos por versión con aviso (mía / de la nube).
- **Roles**: dueño, administrador, encargado (sin costos), cajero, solo lectura. Pantalla «Nube y usuarios»: invitaciones por email, cambio de rol,
  auditoría y vista remota de solo lectura para el dueño.
- **Build sin online**: `SAHTEN_ONLINE=false npm run build` deshabilita la UI de conexión («No disponible en esta versión»). El formato `.sahten` es el mismo.
- **Keep-alive**: GitHub Action diaria para que Supabase gratis no se pause; alternativa Cloudflare D1 + Workers documentada.
- Arreglo: al abrir un proyecto, el menú online y los reportes volvían sin sus valores de fábrica.
- Tests: 236.

## 4.0.0-alpha.2 — Fase B: un archivo por proyecto (`.sahten`)

- **Formato `.sahten`** (JSON, esquema 2): `project`, `settings`, `catalog`, `costs`, `channels`, `stock`, `sales`, `projections`, `online`, `images`, `ui`.
  Ver [docs/FORMATO-SAHTEN.md](docs/FORMATO-SAHTEN.md).
- **`migrate(data)`**: abre `.sahten` de cualquier esquema, el JSON de `collectState()` de v2/v3 y los `Proyeccion_*.json`.
- **Mismo formato con o sin online**: lo que esta versión no conoce (p. ej. `online.supabase`) se conserva al guardar.
- **Sin `localStorage` para datos del negocio**: pedidos, clientes, menú online, tienda, reportes, notificaciones, imágenes (antes IndexedDB) y
  personalización viven en el proyecto. Se reemplazó el selector de «proyectos» (espacios de trabajo) por Abrir / Recientes / Nuevo / Duplicar / Exportar copia.
- **Guardado automático** con espera de 2 s, solo si cambió el contenido, y escritura atómica; indicador «Guardando… / Guardado hace X s / Error».
  File System Access API en Chrome/Edge; descarga e importación manual en el resto.
- **Respaldos**: diario (`.<nombre>.backup-AAAA-MM-DD.sahten`), previo a estrategia/importación (`.pre-estrategia.sahten`) y previo a restaurar.
  Reemplazan el respaldo de estrategia en `localStorage`. Ajustes › Archivo y respaldo: restaurar respaldo de ayer y deshacer la última estrategia, con resumen de diferencias.
- Arranque sin proyecto: pantalla de bienvenida (abrir, nuevo, ejemplo, recientes). «Nuevo» dispara el asistente de configuración.
- **Corrección de v3 — los combos no sobrevivían a guardar/cargar.** Las filas «Pizza Muzzarella x4» / «Pizza Napolitana 1/2» perdían su cantidad: el costo daba 0 en la
  primera carga y otro valor en la segunda (los productos «Tabla para…» cambiaban de precio). Ahora la fracción se convierte a cantidad al migrar.
- **Proyecto de ejemplo consistente** (`npm run demo`): se parte del demo de v3, se aplican las recetas del Excel y se repite guardar → cargar hasta
  un punto fijo. Las recetas del Excel ya no se aplican «solas» en la primera edición (movían 18 precios del demo).
- Tests: 140+ (formato, migraciones, sesión, respaldos, restauración idéntica byte a byte, app real con el proyecto como archivo).

## 4.0.0-alpha.1 — Fase A: base técnica (sin cambios de comportamiento)

- Vite + `src/`: el HTML/CSS de v3 se conservan; la lógica sale de a poco de `src/legacy/`.
- `src/core/` (cálculo puro): `costs`, `gf` (incluye control mensual), `pricing`, `projection`, `menuEngineering`, `stock`.
- **`computeProjection()` única.** La pantalla de Proyección, el snapshot, el CSV y el PDF ya no repiten la cuenta.
  Antes de calcular normaliza la distribución de canales, así el snapshot y el CSV no dependen de haber abierto la pantalla.
- **Estado único del proyecto.** Las globales de v3 son accesores sobre `state`. Comisión global y dólar viven en el estado
  (antes se leían de inputs del DOM).
- **Registro de módulos con eventos** (`onPanelShow`, `afterRender`, `beforeRender`, `around`, `onDataChanged`) en lugar de los
  wrappers en cadena sobre `showPanel`, `renderDashboard`, `renderProyeccion`, `renderMostrador`, `renderRecipeBody`,
  `renderStock`, `renderProductos`, `renderCostReceta`, `mkChart` y `mostSetTab`.
- i18n mínimo (`t()`, es-AR) para los textos del núcleo.
- Tests con Vitest (95): baseline de precios idéntico a v3 en 6 escenarios, GF mensual, costos, combos, precios, proyección,
  stock, asistente de estrategia y eventos.
