# Auditoría de UX y navegación — Sahten 0.4.4

Fecha: 2026-10-12 · Alcance: toda la app (escritorio Tauri, web/PWA, celular) · Método: lectura del código (`index.html`, `src/legacy`, `src/project`, `src/online`, `src/styles`) contrastada con la tabla de prioridades de UI/UX Pro Max.

> Nota de método: el skill UI/UX Pro Max solo trae su `SKILL.md` en esta sesión (faltan `scripts/` y `references/`), así que no se pudo consultar su base de datos. Los criterios son la tabla de prioridades del skill (accesibilidad, táctil, estilo, layout, navegación, formularios…), no resultados de búsqueda.

## Resumen

La app es completa y tiene buenas bases (modo oscuro, ayuda, tour, estados de guardado, Menú Online ya rediseñado). Lo que más frena la experiencia es **cómo se navega y cómo se entra**: el mapa de secciones es largo y distinto en celular y escritorio, no hay "quién soy / a qué tienda estoy conectado" en ninguna parte, y los controles principales son `div` con `onclick` que no se pueden usar con teclado ni lector de pantalla.

Cifras del código: 149 `onclick` inline solo en `index.html`; 0 `aria-label` y 0 `role` en `index.html`; 84 llamadas a `alert/confirm/prompt` en `src`; 80 reglas `outline: none/0`; 505 tamaños de fuente ≤ 11 px.

## P0 — Bloquea o confunde (hacer primero)

| # | Hallazgo | Dónde | Propuesta |
|---|---|---|---|
| 1 | **"Vista previa en pestaña" no hacía nada** en escritorio. Causa: el permiso `opener:allow-open-path` no estaba en las capacidades de Tauri y el error de la promesa se perdía en silencio. Además el mockup del celular se oculta bajo 1100 px de ancho. | `src-tauri/capabilities/default.json`, `src/online/app.js`, `src/styles/sahten-menuonline.css:17` | **Ya corregido** (ver "Cambios ya hechos"). |
| 2 | **No hay identidad de sesión visible.** Ni en la barra superior ni en ningún lado se ve con qué cuenta ni a qué tienda (slug) está conectada la app. | `index.html` `.topbar`; `src/online/ui.js` | Botón de usuario en la barra superior (ver sección Login). |
| 3 | **Conectar pide URL + anon key + slug + email + contraseña** cada vez que el proyecto no tiene la conexión guardada. | `src/online/ui.js` `connectCard` | Separar "configurar tienda" (una vez) de "iniciar sesión" (siempre 2 campos). |
| 4 | **El menú del celular no tiene 4 secciones**: Mostrador, Menú Online, Reportes y Nube/usuarios están en el lateral pero no en el cajón "Más". Menú Online (donde se ve la vista previa) es inalcanzable desde el celular. | `index.html` sidebar (15 ítems) vs `.app-drawer` (12) | Una sola lista de secciones que alimente sidebar, barra inferior y cajón. |
| 5 | **Navegación solo con `div onclick`**: no se llega con Tab, no se anuncia en lector de pantalla, sin `aria-current`. | `index.html:38…` | Convertir en `<a href="#/panel">` o `<button>` con `aria-current="page"`. |

## P1 — Alto impacto

6. **Sin URL ni botón Atrás por panel.** `showPanel()` solo guarda `_panel` en localStorage. En web, Atrás sale de la app; no se puede compartir ni recargar un panel concreto. → Hash routing (`#/menuonline`) con `hashchange`.
7. **Estado activo frágil**: se calcula con `n.getAttribute('onclick').includes("'"+name+"'")` (`app.js` ~427). Cualquier cambio de texto en un `onclick` lo rompe. → `data-panel` en cada ítem.
8. **Foco invisible**: 80 `outline: none/0`. → `:focus-visible` con anillo de 2 px y contraste ≥ 3:1.
9. **Emoji como íconos** (estados de guardado, ⭐, ▲▼, ⋮⋮, ▾). Se ven distinto por sistema operativo y no tienen texto alternativo. → Íconos SVG (ya hay un set en los ítems de navegación) + `aria-label`.
10. **Tamaños de toque y de letra**: 505 fuentes ≤ 11 px; botones de ícono (`mo-iconbtn`, ▲▼, interruptores) por debajo de 44×44 px. → Mínimo 12 px en texto, 44 px de zona táctil.
11. **Barra superior sobrecargada y ambigua**: Abrir / Guardar / CSV / Recalcular son íconos sin etiqueta clara, más campana, badge de autoguardado y un menú `⋯` en celular. "CSV" y "Recalcular" compiten con acciones del archivo. → Agrupar: Archivo (Abrir, Guardar, Exportar) · Recalcular dentro del panel que lo necesita · Usuario · Notificaciones.
12. **`alert()` / `confirm()` para errores y confirmaciones** (84 usos): bloquean, no se pueden estilizar y en Tauri se ven distintos por sistema. → Un componente de aviso (toast) y un diálogo de confirmación propios.
13. **Errores asíncronos mudos.** El caso de la vista previa se repite: acciones `async` llamadas desde `try/catch` síncronos. → Envoltorio común `safeAction(fn)` que muestre el error al usuario.

## P2 — Mejora de calidad

14. **Duplicación de entradas en USD** y campos que aparecen en varios paneles (precios, tipo de cambio): el usuario no sabe cuál manda. → Un solo origen visible y los demás enlazan.
15. **Mezcla de estilos**: tarjetas con sombra, tablas planas, emoji, SVG y texto en el mismo nivel jerárquico. → Definir tokens (color, radio, sombra, espaciado) y componentes base (botón, tarjeta, chip, interruptor) en un archivo.
16. **Estilos inline** extensos en JS (`style="font-size:11.5px;color:var(--muted)"`) que impiden el modo oscuro consistente (hoy hay una "red de seguridad" en `sahten-ux.js`). → Clases + variables CSS.
17. **Formularios**: etiquetas con placeholder como pista principal en varios inputs, validación solo al enviar, mensajes de error en `alert`. → Etiqueta visible, error junto al campo, texto de ayuda.
18. **Movimiento**: una sola regla `prefers-reduced-motion` en toda la base. → Respetarla en transiciones nuevas (modal de vista previa ya usa solo `width`).
19. **Estados vacíos** con instrucciones largas en texto plano (p. ej. "Cargalos desde Costo Receta y Menú…"). → Botón de acción directo ("Ir a Costo Receta").
20. **Mockup del Menú Online** se oculta bajo 1100 px sin alternativa (ya cubierto con el botón "Ver vista previa").

## Login y conexión (tus tres ideas)

Las tres ideas son compatibles y se complementan; el orden recomendado es 1 → 2 → 3.

1. **Ver que la app ya tiene las credenciales cargadas (aunque oculto).** Sí. Hoy `connectCard` ya muestra la URL y el slug guardados cuando existen, pero solo dentro de "Nube y usuarios". Propuesta: chip de estado en la barra superior — `● Casapan` (conectado), `○ Sin sesión` (configurado, falta iniciar sesión), `+ Conectar` (sin configurar). La URL y la anon key nunca se muestran completas; solo el slug y el email.
2. **Componente de login separado.** Sí. Dividir en dos pasos: *Configurar tienda* (URL + clave pública + slug; se hace una vez por proyecto, o se puede importar con un enlace/QR/archivo de conexión) y *Iniciar sesión* (email + contraseña, un diálogo de 2 campos con "Olvidé mi contraseña"). Así el uso diario nunca vuelve a pedir la URL ni la clave.
3. **Login en el menú superior como "usuario".** Sí. Botón de avatar con iniciales a la derecha de la campana: abre un menú con tienda actual, email, rol (owner / admin / encargado / cajero / lectura), estado de sincronización, "Cambiar de tienda", "Sincronizar ahora" y "Cerrar sesión". Sin sesión, el mismo botón abre el diálogo de login.

Técnicamente: `controller.js` ya guarda la sesión por proyecto (`online-session:<projectId>`) y la conexión dentro del `.sahten`; el trabajo es de interfaz (`src/online/ui.js` + barra superior), no de backend. La contraseña sigue sin guardarse.

## Cambios ya hechos (en el repo, sin commit)

- **Vista previa dentro de la app** (`sahten-menuonline.js`, `sahten-menuonline.css`): el botón "Ver vista previa" abre un diálogo a pantalla completa con la página publicada en un `iframe`, selector Celular / Escritorio, cierre con Esc, devolución del foco y aviso de que no se publica nada. Funciona en escritorio, web y celular, sin permisos del sistema.
- **"Abrir en el navegador"** sigue disponible dentro del diálogo y en el editor de sitio; ahora si falla muestra el motivo en vez de quedarse mudo.
- **Permiso de Tauri**: `opener:allow-open-path` limitado al directorio temporal (`$TEMP`), necesario para abrir el archivo de vista previa en el navegador del sistema. **Requiere publicar una versión nueva de la app de escritorio**; el diálogo interno no lo necesita.
- Verificación: los 253 tests que pueden correr en este entorno pasan; los que fallan lo hacen por no poder descargar `xlsx` desde `cdn.sheetjs.com` (bloqueado en esta sesión), no por estos cambios. Falta probarlo en la app real.

## Versiones y releases

Cada versión publicada deja una página en GitHub Releases (`v0.4.1` a `v0.4.4` con 10 archivos cada una: instaladores, firmas y `latest.json`). El texto de las notas es el mismo en todas ("Instaladores de Sahten…"); el detalle de cambios está en `CHANGELOG.md` y no se copia a la Release. Propuesta: que `release.yml` use la sección de `CHANGELOG.md` de esa versión como cuerpo de la Release.

## Orden de trabajo sugerido

1. Navegación: lista única de secciones, `data-panel`, `<button>/<a>`, `aria-current`, cajón completo, hash routing. (#4, #5, #6, #7)
2. Barra superior + usuario/sesión + login en dos pasos. (#2, #3, #11)
3. Accesibilidad base: `:focus-visible`, zonas táctiles, tamaños mínimos de letra, íconos SVG. (#8, #9, #10)
4. Avisos y confirmaciones propios; `safeAction`. (#12, #13)
5. Tokens y componentes base; limpieza de estilos inline. (#15, #16)
6. Release notes automáticas desde el CHANGELOG.

Cada paso se puede entregar y probar por separado.
