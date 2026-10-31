# Videos reales de Sahten — Integración con Terra

## ACTUALIZACIÓN FINAL: RECURSOS YA INCORPORADOS EN GITHUB (31/10/2026)

**Se reemplaza el estado pendiente de subir archivos que aparece más abajo.** Los 4 MP4 optimizados para la aplicación y sus 4 posters WebP ya están versionados bajo `media/terra/` en el PR #40. Sus blobs SHA se verificaron contra los archivos locales. Las versiones de 540×960 para los videos de mayor peso (H.264/AAC, hasta ~1,9 MB por clip) se adaptaron al tamaño de las tarjetas; la versión 720×1280 sigue disponible en el ZIP original de la conversación.

**Integración ejecutada por ChatGPT, no delegada a Codex:** `src/online/web/index.html` contiene 3 reproductores HTML5 de carga diferida; `src/online/web/terra.css` los adapta a escritorio/móvil; `src/online/site.js` y `src/legacy/sahten-siteeditor.js` aportan el módulo editable; `src/online/terra-media.js` importa los binarios como assets diferidos, y `src/online/publish.js` los agrega **automáticamente** al paquete estático cuando el tema Terra y la sección de videos están activos. No hace falta copiar archivos manualmente ni que Codex suba los videos.

**DECISIÓN DEL DUEÑO (31/10/2026):** mantener visible el tutorial original `como-comprar.mp4` aunque use la interfaz anterior; se renovará cuando esté lista la estética nueva. Se activó `site.videos.tutorialEnabled` en el borrador Terra y se conserva el aviso visible de que la tienda actual contiene los precios y condiciones vigentes. Esta autorización es para usar el tutorial existente, no para declarar aprobado el rediseño completo. La web pública `sahten.online` permanece sin cambios hasta realizar la publicación de la plantilla; el PR sigue en borrador.

Fecha: 2026-10-31 · Estado: **recibidos, verificados y optimizados; NO alojados ni publicados**

## Archivos recibidos

El usuario proporcionó en esta conversación `Archive(1).zip` (~93,7 MB), con cuatro videos originales H.264/AAC, todos 1080×1920, 9:16 y con pista de audio. Los archivos fuente **no están dentro del repositorio**.

| Original | Duración | Uso EXACTO en la maqueta Terra | Estado |
| --- | ---: | --- | --- |
| `Picada Tabla Celebrar + Audio IA.mov` | 32,11 s | Reel 01: Tabla para Celebrar | Listo para revisión |
| `Picada Tabla Compartir + Audio IA.mov` | 32,53 s | Reel 02: Tabla Compartir | Listo para revisión |
| `Video SupeMIX + Audio IA.mov` | 22,53 s | Reel 03: Shawarma Supermix | Listo para revisión |
| `SAHTEN WEB - Como Comprar.mp4` | 31,17 s | Video tutorial en bloque de ayuda | **Aprobado para mostrar con aviso de interfaz anterior** |

El video de compra muestra la interfaz anterior, además de importes y descuentos de demostración. Por decisión expresa del dueño se muestra ahora acompañado de una aclaración visible que remite a los precios y condiciones actuales de la tienda; más adelante se reemplazará por una versión acorde con la nueva estética.

## Paquete producido en la conversación

`sahten_videos_web_optimizados.zip` (≈9,7 MB), creado a partir de los originales, contiene:

| Archivo | Tamaño aprox. |
| --- | ---: |
| `videos/tabla-celebrar.mp4` | 3,30 MB |
| `videos/tabla-compartir.mp4` | 2,91 MB |
| `videos/supermix.mp4` | 1,53 MB |
| `videos/como-comprar.mp4` | 1,94 MB |
| `posters/{slug}.webp` | 30–42 KB cada uno |
| `manifest.json` | Duraciones, dimensiones, SHA-256 y estado |
| `README-VIDEO-CODEX.md` | Instrucciones de reproducción e integración |

Videos optimizados: MP4 H.264 + AAC 96 kb/s, resolución 720×1280, `+faststart`, sin modificar el original. Posters WebP 540×960. El ZIP está disponible en la conversación con el usuario y debe adjuntarse a la sesión de Codex o colocarse en su workspace para publicación autorizada. **No afirmar que el ZIP esté montado en el ambiente de Codex ni que se haya cargado a Cloudflare/Supabase/GitHub.**

## Posiciones dentro del rediseño de Terra

La maqueta `tipografia/tipo-3-home-pulida.html` del ZIP original contiene:
- `.reel-grid`: tres videos gastronómicos («Tabla para Celebrar», «Tabla Compartir», «Shawarma Supermix»), inicialmente solo imágenes/posters que no reproducen el video.
- `#ayuda`: video `Cómo comprar`, independiente de los reels, acompañado de pasos de compra completos.
- Los CTA a la carta se deben vincular al catálogo activo: no conservar enlaces hacia maquetas HTML ni copiar sus 31 artículos de ejemplo.
- No confundir `#ayuda` con la sección nueva del mapa que Codex estaba desarrollando en paralelo. Integrar el mapa sin sobrescribir otras ramas.

## Contrato técnico de video

1. No modificar las funciones actuales de carrito, pago, horarios, cobertura, navegación ni Supabase para mostrar videos.
2. Publicar solamente en un hosting estático autorizado, con URL estable, caché y tipo de contenido correcto. Acordar almacenamiento y política de versiones; no subir los MOV originales (~94 MB) al repo.
3. Inicialmente mostrar poster WebP; video solo al click/tap (`preload="none"`, `playsinline`, `controls`, atributos de ancho/alto). Evitar 3–4 reproducciones y descargas simultáneas.
4. Audio disponible en los originales y optimizados, pero jamás autoplay con audio. Para autoplay decorativo en caso de aprobación: `muted` y respetar preferencias de movimiento.
5. Mantener accesibilidad y contraste; preparar transcripción y subtítulos verdaderos cuando se disponga de su contenido. No inventar subtítulos.
6. Los textos de nombres de comida deben contrastarse con el catálogo real y disponibilidad. Si un producto está oculto/pausado, no llevar al cliente a un producto inexistente.
7. Revisar SEO/VideoObject SOLO después de que exista URL pública real de los recursos; no emitir datos estructurados con URLs futuras inventadas.
8. Medir rendimiento de portada (LCP y carga móvil) al integrar, comprobar video en Safari iOS y Android.
9. El dueño autorizó mantener visible el tutorial original mientras se prepara su reemplazo estético. Mostrar siempre el aviso sobre interfaz anterior y precios/condiciones vigentes en el checkout; no presentarlo como captura actual.

## Estado de ejecución y pendientes

- [x] Inspección del ZIP: 4 videos originales con audio.
- [x] Revisión visual por fotogramas: 3 videos gastronómicos + video de compra viejo.
- [x] Transcodificación a MP4 H.264 + AAC para web, posters WebP.
- [x] ZIP optimizado, manifiesto y README para Codex.
- [x] Subir 4 MP4 y 4 WebP al repositorio en `media/terra/` y conectar su exportación automática. **Aún no se desplegaron en el hosting público.**
- [x] Implementar las tres tarjetas reproductoras en el generador real (solo en rama Terra), sin tocar órdenes ni pagos.
- [ ] Aprobar y subir videos a hosting; después configurar URLs de producción/preview.
- [ ] Rehacer/actualizar el tutorial de compra y revisarlo antes de habilitarlo públicamente.
- [ ] Pruebas de rendimiento, responsive, accesibilidad y calidad visual.
- [ ] Autorizar deployment separado; la web publicada no debe cambiar sin confirmación.
