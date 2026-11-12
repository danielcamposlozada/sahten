# Guía para agentes — Sahten

App de gestión para restaurante (Vite + Tauri, Supabase) que además **genera y publica la web del menú** (`src/online/`). Idioma de trabajo y de la interfaz: español (Argentina).

> **Este protocolo es permanente y obligatorio para todo agente de IA** (Claude, OpenAI Codex u otro) en cada intervención. No es una tarea de una sola vez. Las reglas de las secciones 1 a 7 se suman a las reglas de negocio que siguen más abajo.

---

## 1. Orden de lectura al ingresar (obligatorio, en este orden)

1. Este archivo (`AGENTS.md`). `CLAUDE.md` solo lo importa; no tiene reglas propias.
2. [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md): qué es Sahten, arquitectura, reglas comerciales, estado verificado.
3. **La entrada más reciente** de [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) (están ordenadas de la más nueva a la más vieja; la primera es la última intervención). Si la tarea retoma trabajo de otro agente, leé también las entradas anteriores relacionadas.
4. La documentación específica de la funcionalidad que vas a modificar (índice en la sección 8 de `docs/AI_CONTEXT.md`).
5. El código fuente relacionado y sus pruebas en `tests/`.

Antes de modificar nada, **explicá brevemente al dueño**: qué entendiste, cuál es el estado actual y qué pensás modificar. Si pertenece al área web/SEO/marca, aplican además los documentos de la sección «Antes de empezar» más abajo.

## 2. Verificar el estado actual antes de actuar

- Corré `git status`, `git branch -a` y `git log -5 --oneline`. Si hay cambios sin confirmar o ramas de otro agente relacionadas con tu tarea, **no los toques**: informá al dueño.
- **No des por implementado nada solo porque la documentación lo menciona.** Verificá que exista en el código y que tenga pruebas. `docs/AI_CONTEXT.md` distingue «verificado en código» de «afirmado solo en documentación»; mantené esa distinción.
- Chequeá si la entrada previa de `AI_HANDOFF.md` dejó pendientes o bloqueos que afecten tu tarea.
- Los registros históricos (`CHANGELOG.md`, `docs/SEO-GEO-AEO.md`) describen un momento. Si contradicen el código actual, **el código manda**; anotá la discrepancia en tu entrada de handoff.

## 3. Protección del trabajo existente

- Trabajá en una **rama propia** (`feat/…`, `fix/…`, `docs/…`). No hagas commits directos a `main` salvo que el dueño lo pida expresamente.
- **No modifiques funcionalidades que no estén relacionadas con la tarea** sin justificarlo por escrito en `AI_HANDOFF.md` y avisar al dueño. Cambios oportunistas (refactors, formato, renombres masivos, actualización de dependencias) están prohibidos si no se pidieron.
- No sobrescribas, reviertas ni borres trabajo de otro agente o del dueño (ramas, PR, archivos locales, historial). No uses `git push --force`, `git reset --hard` ni borrado de ramas sin autorización explícita.
- No elimines ni reescribas entradas anteriores de `docs/AI_HANDOFF.md`; solo se agregan nuevas **al principio**.
- Conservá lo que ya funciona en: pedidos, pagos, checkout, delivery, mapa, cupones, tickets y sincronización. Cualquier cambio ahí exige pruebas (sección 5).
- Los archivos generados o de otras fuentes de verdad (`reference/`, `tests/fixtures/baseline-v3.json`, `docs/brand/sahten/export/`, `src/online/brand/sahten.js`) se regeneran con su script; no se editan a mano.

## 4. Restricciones de producción (nunca sin autorización explícita del dueño)

Es producción real de un negocio con clientes y pagos. **Está prohibido, salvo autorización expresa y específica para ese cambio en esa conversación:**

- Desplegar la web (Cloudflare Pages, workflows `deploy-*`/`sahten-promo-checkout`), publicar releases o instaladores, o disparar `workflow_dispatch` con `deploy: true`.
- Aplicar migraciones en `supabase/migrations/` o SQL en el proyecto Supabase real, desplegar o cambiar Edge Functions (`sahten-delivery`, `sahten-payments`, `sahten-promotions`), cambiar secretos o configuración de proveedores.
- Escribir en las tablas de producción (`menus`, `projects`, `orders`, programas de fidelización, cupones) o crear pedidos, cupones, pagos o reembolsos reales para «probar».
- Cambiar la ficha de Google, perfiles externos, DNS, Search Console u otras cuentas.
- Mergear PR a `main`. **Atención:** un push a `main` que toque `package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md` o `.github/workflows/release-on-version.yml` dispara la publicación de instaladores si la versión es nueva; y cambios en las rutas listadas en `.github/workflows/sahten-promo-checkout.yml` disparan su flujo. Revisá los `on:` de los workflows antes de proponer un merge.

Una autorización vale solo para lo que nombra. Mostrá al dueño cada valor antes de ejecutar una acción con efecto público. No pegues claves, tokens ni datos personales de clientes en commits, docs, logs ni conversaciones.

## 5. Pruebas y validación

- Instalación: `npm ci`. **Nota:** `xlsx` se descarga de `cdn.sheetjs.com`; si el entorno lo bloquea (403), `npm ci` falla. Documentá el bloqueo; no cambies `package.json` para eludirlo.
- Antes de dar algo por terminado, corré lo que corresponda: `npx vitest run` (suite completa) o el archivo de prueba del área tocada; `npm run check:versions`; `npm run check:legacy` si tocaste `src/legacy/`; `npm run build` y `SAHTEN_ONLINE=false npm run build` si tocaste código de la app.
- Cambios de fórmulas de costos/precios: `npm run baseline` solo si el cambio es deliberado; el baseline v3 debe seguir coincidiendo.
- Toda lógica nueva o corregida lleva su prueba. Los cálculos monetarios se prueban con casos reales (ver ejemplos en `CHANGELOG.md`) y los importes en centavos enteros.
- **Nunca declares exitosa una prueba que no ejecutaste** ni un despliegue que no verificaste. Si no pudiste correr algo, escribilo así en el handoff, con el motivo. Informá cantidades reales (archivos/pruebas pasadas y falladas), no «todo OK».
- Las pruebas contra Supabase real, Mercado Pago real, impresión física y instaladores **no se ejecutan en la suite**: figuran como verificación manual (`docs/QA.md`). No las des por hechas.

## 6. Obligación de documentar al finalizar

Antes de cerrar una intervención:

1. Revisá los cambios reales con `git status` y `git diff` (lo que hiciste, no lo que planeabas).
2. Ejecutá las pruebas aplicables (sección 5).
3. Actualizá la documentación afectada: `docs/AI_CONTEXT.md` si cambió arquitectura, reglas, estado o problemas conocidos; la guía específica de la funcionalidad; `CHANGELOG.md` (sección «Sin publicar») si hay un cambio visible para el usuario.
4. Agregá una **nueva entrada al principio** de `docs/AI_HANDOFF.md` con la plantilla que figura en ese archivo.
5. Separá con claridad **implementado / probado / publicado / pendiente**. Cada uno es independiente: algo implementado no está probado ni publicado salvo que lo hayas verificado.
6. Dejá instrucciones concretas, ejecutables, para que otro agente continúe (comandos, archivos, siguiente paso, qué decidió el dueño y qué falta decidir).
7. Si hay cambios sin confirmar o ramas sin integrar, decí cuáles y dónde están.

## 7. Reglas de coordinación entre agentes (Claude y Codex)

- Un solo agente por rama a la vez. Antes de empezar, verificá en `AI_HANDOFF.md` y en `git branch -a` si otro agente tiene trabajo en curso en el mismo archivo o funcionalidad.
- Si encontrás trabajo local o no subido de otro agente (ver también la decisión del dueño del 31/10/2026 más abajo), **no lo toques**: avisá al dueño.
- Identificate en el handoff con el agente real que sos (por ejemplo «Claude (Claude Code)» u «OpenAI Codex») y la fecha.
- Las decisiones comerciales o de diseño las toma el dueño. Si algo no está documentado como decidido, preguntá; no lo infieras.
- Si descubrís un error en la documentación, corregilo en el mismo cambio o registralo como «problema de documentación» en el handoff.

---

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

**Fotos que el dueño sí conserva:** hay respaldo aislado en la rama `assets/fotos-sahten-2026-10-31`, carpeta `media/sahten-fotos/` y README. **Dos fotos distintas** —una de **tortas/dulces (es la misma fotografía)** y otra del **plato con cerdo**— rotan **exclusivamente en el banner del beneficio del 10 % OFF** (solo si ese descuento está comercialmente activo); **mesa completa fija y exclusiva para Catering**. Los tres archivos están identificados en la rama de recursos; **no falta una tercera imagen del banner**. No duplicar fotos, no usarlas en el hero, ni fusionar la propuesta descartada. Mantener intactos pedidos, pagos, checkout, delivery, mapa y sincronización. No desplegar sin autorización.
