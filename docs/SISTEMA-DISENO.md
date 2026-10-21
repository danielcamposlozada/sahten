# Sistema de diseño de Sahten

Resumen de lo que ya usa la app y de las reglas para lo nuevo. Los valores viven en `src/styles/app.css` (marca y base) y `src/styles/sahten-ui.css` (tokens, foco, diálogos, avisos, usuario).

## Identidad
- Verde `--primary #235328` + naranja `--accent #F28C00` por defecto. **Cada tienda cambia nombre, logo y paleta** en Ajustes › Negocio › Marca y apariencia; se guardan dentro de su archivo `.sahten` y al abrir otro proyecto se vuelven a leer (`custReload`).
- La marca activa se ve en: menú lateral (logo), botón de usuario de la barra superior (iniciales y color), título de la pestaña y `theme-color`.
- Estilo: suave, tipo iOS (bordes casi transparentes, sombras livianas, barra superior con desenfoque). Tipografía del sistema + DM Mono para números.

## Tokens (`sahten-ui.css`)
| Grupo | Variables |
|---|---|
| Espaciado | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 |
| Radios | `--r-sm` 8 · `--r-md` 10 · `--r-lg` 14 · `--r-xl` 16 · `--r-pill` |
| Letra | `--fs-xs` 12 (mínimo) · `--fs-sm` 13 · `--fs-md` 15 · `--fs-lg` 18 |
| Táctil | `--touch` 44 px |
| Estado | `--ok`, `--danger`, `--warn`, `--focus` |

Regla: nada de colores sueltos (`#hex`) en componentes nuevos; usar variables. Ningún texto menor a 12 px.

## Componentes base
- **Botón** `.btn` (+ `.btn-primary`, `.btn-accent`). Acción principal por pantalla: una sola.
- **Chip / filtro** `.mo-chip`; **interruptor** `.mo-sw`; **tarjeta** `.card`.
- **Diálogo** `sahtenDialog / sahtenConfirm / sahtenAlert` (`src/ui/dialog.js`): foco atrapado, Esc, `aria-modal`, devuelve el foco. **No usar `confirm()` ni `prompt()`**; `alert()` ya muestra este aviso.
- **Aviso breve** `sahtenToast(msg)`: se anuncia a lectores de pantalla.
- **Usuario / tienda** `.um-*` (`src/online/userMenu.js`).
- **Navegación**: cada acceso declara `data-panel="seccion"`; un solo listener (`src/ui/nav.js`) y URL `#/seccion`. Menú lateral, barra inferior y cajón del celular salen de las mismas 15 secciones.

## Espacio adaptable (0.4.9)
- `src/ui/workspace.js` y `src/styles/sahten-workspace.css` gestionan el lateral amplio (260 px), compacto (72 px) y cajón móvil (hasta 768 px). El botón permite plegarlo; la preferencia `sahten-navigation` pertenece al equipo y no se sincroniza como dato del negocio. Cada ícono conserva su nombre accesible y ayuda emergente.
- Mostrador decide entre dos columnas y pedido superpuesto según el ancho real disponible en `.main` (900 px). El contenido ocupa la altura útil; catálogo, historial y cuerpo del pedido se desplazan dentro. Total y cobro conservan su espacio. `data-current-panel` identifica la pantalla en el root; reservar `data-panel` para controles de navegación.
- En tamaños estrechos, «Ver pedido» abre explícitamente el panel. Escape y el botón de cierre devuelven el foco; el fondo queda inactivo mientras está abierto. Los cambios de tamaño conservan los renglones.
- La ventana nativa calcula su tamaño inicial con el área útil y escala del monitor. El mínimo habitual es 640 × 480, limitado al espacio disponible.
- La plantilla web reserva «Pedido» en el encabezado y agrupa las secciones en un menú desplegable. El diálogo de pedido usa cuerpo desplazable, pie de envío visible, etiquetas, foco cíclico y altura de `visualViewport` para el teclado móvil.
- `src/ui/contrast.js` elige texto claro u oscuro sobre los colores de marca para las acciones principales. `node scripts/check-contrast.mjs` comprueba 288 combinaciones con contraste mínimo 4,5:1. Esto no certifica todos los componentes heredados.

Validación: 385 pruebas automáticas, compilación web y comprobación Rust en macOS. En navegador se completaron Retiro y Delivery ficticios, y un pedido de 20 renglones a 360 × 640; cobro visible también a 1024 × 600 en claro y oscuro. La escala y el teclado nativos de Windows requieren comprobación en ese sistema.

## Accesibilidad (mínimos)
- Foco visible siempre (`:focus-visible`), `aria-current="page"` en la sección activa, `aria-label` en botones solo-ícono, enlace «Saltar al contenido».
- Zonas táctiles de 44 px en pantallas táctiles; `prefers-reduced-motion` respetado.
- Errores junto al campo (`role="alert"`), no solo arriba ni en un `alert()`.

## Pendiente de migrar
- ~500 colores `#hex` directos en los CSS y estilos inline en JS que deberían pasar a variables/clases.
- Íconos emoji (estados, ⭐, ▲▼) → SVG.
- `confirm()` restantes en módulos viejos → `await sahtenConfirm()`.
