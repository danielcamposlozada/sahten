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

## Estado de implementación (rama `ux/vista-previa-menu-online`)

| # | Hallazgo | Estado |
|---|---|---|
| 1 | Vista previa del Menú Online | Hecho: diálogo dentro de la app (celular/escritorio) + «Abrir en el navegador» con permiso de Tauri y aviso de error |
| 2 | Identidad de sesión | Hecho: botón de usuario con tienda (nombre y color), cuenta, rol y sincronización |
| 3 | Conectar pedía 5 datos | Hecho: configurar una vez (con código de conexión) y luego solo email y contraseña; cerrar sesión conserva la conexión; recuperar contraseña |
| 4 | Cajón del celular sin 4 secciones | Hecho: el cajón incluye Mostrador, Menú Online, Reportes y Nube y usuarios |
| 5 | Navegación con `div onclick` | Hecho: enlaces `<a href="#/…">` con `data-panel`, `aria-current`, sin `onclick` en la navegación |
| 6 | Sin URL ni Atrás | Hecho: hash por sección, Atrás/Adelante y enlace directo |
| 7 | Estado activo frágil | Hecho: se calcula con `data-panel`; además `window.currentPanel` ahora se actualiza |
| 8 | Foco invisible | Hecho: `:focus-visible` global |
| 9 | Emoji como íconos | Parcial: botones solo-ícono con `aria-label`; los emoji de estado/⭐/▲▼ siguen |
| 10 | Zonas táctiles y letra | Hecho en hojas de estilo (44 px táctil, mínimo 12 px); falta en estilos inline de JS |
| 11 | Barra superior sobrecargada | Hecho: Guardar + menú «Archivo»; usuario y avisos agrupados |
| 12 | `alert()`/`confirm()` | Hecho: diálogo/aviso propio; los `confirm()` de los módulos se pasaron a `await sahtenConfirm` |
| 13 | Errores asíncronos mudos | Hecho: aviso para toda promesa rechazada sin atender + `safeAction` |
| 14 | USD duplicado | Sin cambios: los tres campos se mantienen sincronizados |
| 15–16 | Tokens y estilos inline | Parcial: tokens y `docs/SISTEMA-DISENO.md`; ~500 colores `#hex` y estilos inline por migrar |
| 17 | Formularios | Parcial: los diálogos nuevos tienen etiqueta visible, error junto al campo y `role="alert"` |
| 18 | Movimiento | Hecho: `prefers-reduced-motion` global |
| 19 | Estados vacíos | Parcial: Menú Online con botón; resto por revisar |
| 20 | Mockup oculto bajo 1100 px | Hecho: el botón abre la vista previa a pantalla completa |
| — | Marca por tienda | Hecho: se relee al abrir otro proyecto; pestaña, `theme-color` y `stores.name` siguen la marca |
| — | Notas de Release | Hecho: `release.yml` usa la sección de `CHANGELOG.md` de la versión |

Verificación: 336 tests (suite completa, en una copia donde `xlsx` se reemplazó por un sustituto vacío porque `cdn.sheetjs.com` está bloqueado en esta sesión) y capturas de pantalla en escritorio y celular con Chromium. Falta probarlo en la app de escritorio real (Tauri) y publicar una versión nueva.

## Versiones y releases

Cada versión publicada deja una página en GitHub Releases (`v0.4.1` a `v0.4.4` con 10 archivos cada una: instaladores, firmas y `latest.json`). El texto de las notas es el mismo en todas ("Instaladores de Sahten…"); el detalle de cambios está en `CHANGELOG.md` y no se copia a la Release. Resuelto en esta rama: `release.yml` arma las notas con la sección de `CHANGELOG.md` de la versión (`scripts/release-notes.mjs`).
