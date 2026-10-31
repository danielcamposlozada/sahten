# Guía para agentes — Sahten

App de gestión para restaurante (Vite + Tauri, Supabase) que además **genera y publica la web del menú** (`src/online/`). Idioma de trabajo y de la interfaz: español (Argentina).

## Antes de empezar (obligatorio si tocás web, SEO, menú online, imágenes o perfiles externos)
1. [docs/SEO-GEO-AEO.md](docs/SEO-GEO-AEO.md): datos confirmados del negocio, reglas, estado, pendientes y preguntas abiertas.
2. [docs/brand/sahten/README.md](docs/brand/sahten/README.md): colores, logos permitidos, regla del árabe con vocales y kit de imágenes.
3. [docs/PUBLICAR.md](docs/PUBLICAR.md): cómo se arma y se sube la carpeta publicada.
Prompt listo para pegar: [docs/PROMPT-AGENTES.md](docs/PROMPT-AGENTES.md).

## Reglas
- **No inventar** datos del negocio (horarios, precios, promos, categorías). Si falta, preguntar.
- **Árabe siempre con vocales** (صَحْتَيْن). Logos solo con letras sólidas y colores de marca; no redibujar ni recortar.
- **No escribir en Supabase** (`menus`, `projects`, `orders`) para cambiar el sitio: se pisa al publicar; `orders` tiene datos personales.
- **Acciones con efecto público** (cambiar la ficha de Google, perfiles, publicar, enviar formularios) solo con confirmación explícita del dueño, mostrando antes cada valor.
- `src/online/seo.js` va embebido en la web como script plano: sin `import`, sin nombres que choquen con la plantilla.

## Comandos
- `npm ci` · `npx vitest run` (toda la suite) · `npx vitest run tests/seo.test.js` (SEO y páginas).
- Kit de marca: `pip install cairosvg pillow && python3 scripts/build-brand-kit.py` (regenera `docs/brand/sahten/export/` y `src/online/brand/sahten.js`).

## Cambios y versiones
- Cada cambio visible para el usuario va en `CHANGELOG.md` (sección «Sin publicar» hasta que haya versión). Probar con `node scripts/check-versions.mjs` si se sube versión.

## Decisión del dueño: rediseño Terra rechazado, continuar Codex (31/10/2026)
**Antes de cualquier trabajo de Home, banners, Catering o mapa, leer [issue #41](https://github.com/danielcamposlozada/sahten/issues/41).** El diseño propuesto por ChatGPT en el PR #40 fue **rechazado** y el PR cerrado sin merge: no recuperarlo ni tomar su vista previa como referencia visual. **Retomar la versión que Codex estaba implementando antes**, incluida la sección de mapa, sin tocar trabajos locales o no subidos de Codex.

**Fotos que el dueño sí conserva:** hay respaldo aislado en la rama `assets/fotos-sahten-2026-10-31`, carpeta `media/sahten-fotos/` y README. Tres fotos distintas —tortas, dulces y plato con cerdo— rotan **exclusivamente en el banner del beneficio del 10 % OFF** (solo si ese descuento está comercialmente activo); **mesa completa fija y exclusiva para Catering**. Solo hay 2 fotos de banner y la de Catering identificadas en ese respaldo; falta verificar/recuperar la tercera imagen de dulces. No duplicar fotos, no usarlas en el hero, ni fusionar la propuesta descartada. Mantener intactos pedidos, pagos, checkout, delivery, mapa y sincronización. No desplegar sin autorización.
