# Sahten — Bitácora de intervenciones de agentes de IA

> **Reglas de este archivo** (detalle en [AGENTS.md](../AGENTS.md) §6):
> - Las entradas se **agregan al principio**, justo debajo de la plantilla. La primera entrada es la última intervención.
> - **No se borra ni se reescribe** ninguna entrada anterior. Si algo de una entrada vieja resultó incorrecto, aclaralo en tu entrada nueva.
> - Separá siempre **Implementado / Probado / Publicado / Pendiente**. No declares exitosa una prueba que no ejecutaste ni un despliegue que no verificaste.
> - Contexto general del proyecto: [AI_CONTEXT.md](AI_CONTEXT.md).

## Plantilla (copiar al principio, debajo de esta línea, y completar)

```markdown
## AAAA-MM-DD — <título corto> — <Agente (herramienta)>

- **Fecha y agente:** …
- **Objetivo solicitado:** …
- **Estado inicial observado:** (rama, commit, `git status`, pendientes previos relevantes)
- **Archivos inspeccionados:** …
- **Archivos modificados / creados:** …
- **Implementación (detalle técnico):** …
- **Decisiones tomadas y motivos:** …
- **Cambios en base de datos o APIs:** (migraciones, RPC, Edge Functions; «ninguno» si corresponde)
- **Pruebas realizadas y resultados:** (comando exacto + cantidades reales; qué NO se pudo correr y por qué)
- **Problemas encontrados:** …
- **Funcionalidades pendientes:** …
- **Estado de publicación o despliegue:** (rama/commit/PR; web; Supabase; instaladores; «no publicado» si corresponde)
- **Resumen:** Implementado: … · Probado: … · Publicado: … · Pendiente: …
- **Instrucciones para continuar:** (pasos concretos, comandos, archivos, decisiones del dueño que faltan)
```

---

## 2026-11-12 — Implantación del protocolo de colaboración entre agentes de IA — Claude (Claude Code, modelo Claude Sonnet 5.5)

- **Fecha y agente:** 12/11/2026, Claude (Claude Code sobre claude.ai, sesión remota sin acceso a la computadora del dueño).
- **Objetivo solicitado:** auditar el repositorio completo y dejar un sistema permanente de colaboración y transferencia de contexto entre agentes (Claude y OpenAI Codex): `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_HANDOFF.md` y una sección en el README. Sin reestructurar la app, sin cambiar comportamiento funcional y sin publicar en producción.
- **Estado inicial observado:**
  - Clon superficial (`--depth 1`) de `danielcamposlozada/sahten`, rama `main` en `7048311` («fix(v0.4.55): respetar envío gratis antes de descuentos de pago y promociones»), árbol limpio. Solo existía `origin/main`; no hay otras ramas remotas visibles en el clon (la rama `assets/fotos-sahten-2026-10-31` que cita `AGENTS.md` no estaba disponible en el clon).
  - Ya existían `AGENTS.md` (reglas de web/SEO/marca y la decisión del 31/10/2026) y `CLAUDE.md` (solo `@AGENTS.md`). No existían `docs/AI_CONTEXT.md` ni `docs/AI_HANDOFF.md`. El README tenía 846 bytes sin protocolo para agentes.
  - Versión 0.4.55 coherente en `package.json`, `tauri.conf.json`, `Cargo.toml`, `schema.js` y locks (`npm run check:versions` en la copia de prueba: «Versiones en orden: 0.4.55»).
- **Archivos inspeccionados:** `package.json`, `README.md`, `CHANGELOG.md` (primeras ~90 líneas), `AGENTS.md`, `CLAUDE.md`, `vite.config.js`, `docs/ARQUITECTURA.md`, `docs/PROMPT-AGENTES.md`, `docs/QA.md`, encabezados de `docs/SUPABASE.md`, `PUBLICAR.md`, `GUIA-PROMOCIONES-Y-CUPONES.md`, `CONTROLES-EN-VIVO.md`, `MERCADO-PAGO.md`, `INSTALACION.md`, `SEO-GEO-AEO.md` (secciones 5–7 y final), `docs/sahten/INTEGRACION-COMPLEMENTOS.md` (inicio), `.github/workflows/{ci,deploy-sahten-checkout,sahten-promo-checkout,release-on-version,supabase-keepalive}.yml`, `supabase/functions/*/index.ts`, nombres de tablas y funciones SQL de `supabase/schema.sql`, `payments.sql`, `photos.sql` y las 32 migraciones, cabeceras y exports de `src/delivery/{service,repository}.js`, `src/payments/{service,repository}.js`, `src/promotions/{server,upsell-checkout}.js`, `src/core/{promotions,payment-benefit,coupon-terms,promotion-policy,order-confirmation}.js`, `src/online/{order-workflow,roles}.js`, `src-tauri/tauri.conf.json`, funciones de `src-tauri/src/printing.rs`, `scripts/check-versions.mjs`, inicio de `scripts/deploy/sahten-safe-promo-checkout.mjs`, listado de `tests/` (150 archivos). **No se leyeron completos** los módulos grandes (`src/legacy/*`, `src/online/storefront.js`, la lógica SQL de las migraciones, ni `docs/SEO-GEO-AEO.md` entero); lo afirmado sobre ellos en `AI_CONTEXT.md` se basa en nombres, cabeceras, pruebas existentes y documentación, y está marcado como tal.
- **Archivos modificados / creados:**
  - Modificado: `AGENTS.md` (se agregaron las secciones 1–7 del protocolo; **se conservaron intactas** las reglas previas: «Antes de empezar», «Reglas», «Comandos», «Cambios y versiones» y la decisión del dueño del 31/10/2026).
  - Creados: `docs/AI_CONTEXT.md`, `docs/AI_HANDOFF.md`.
  - Modificado: `README.md` (nueva sección «Protocolo obligatorio para agentes de IA»; el resto del contenido se conservó).
  - No se tocó código fuente, tests, workflows, `package.json`, `CHANGELOG.md`, migraciones ni nada bajo `supabase/`.
- **Implementación (detalle técnico):** solo documentación. `AGENTS.md` define: orden de lectura, verificación del estado, protección del trabajo, restricciones de producción (incluye advertencia de qué rutas disparan workflows al hacer push a `main`), reglas de pruebas, obligación de documentar y coordinación Claude/Codex. `AI_CONTEXT.md` describe producto, arquitectura (app/web/backend), directorios, tecnologías, Supabase (esquemas, RPC, funciones), flujos, reglas comerciales, decisiones, problemas conocidos y una tabla de estado con tres niveles de certeza (Código / Doc / No verificado).
- **Decisiones tomadas y motivos:**
  - Se **extendió** el `AGENTS.md` existente en lugar de reemplazarlo, para conservar las instrucciones válidas (pedido del dueño).
  - `CLAUDE.md` se dejó como está (`@AGENTS.md`): Claude y Codex leen el mismo archivo y no hay reglas duplicadas.
  - No se tocó `CHANGELOG.md`: el cambio no es visible para el usuario **y** modificar ese archivo en `main` es uno de los disparadores de `release-on-version.yml`.
  - No se corrigió `docs/ARQUITECTURA.md` ni se reorganizó `docs/SEO-GEO-AEO.md` (están desactualizados, ver problemas): queda fuera del alcance pedido («no reestructures»); se documentó como pendiente.
  - Se separaron en el contexto «verificado en código» y «afirmado solo en documentación» porque el pedido exige no suponer que algo está implementado por estar mencionado.
- **Cambios en base de datos o APIs:** ninguno. No se consultó ni se escribió en Supabase, Cloudflare, Mercado Pago ni GitHub (más allá de clonar el repositorio).
- **Pruebas realizadas y resultados:**
  - `npm ci` en el clon **falló**: HTTP 403 al descargar `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (el entorno bloquea ese host). No se modificó `package.json` en el repositorio.
  - Para tener una referencia, se hizo una **copia temporal fuera del repo** (`/tmp`, vía `git archive`), quitando `xlsx` de su `package.json` y sin lockfile, y se corrió `npx vitest run`: **129 archivos pasaron y 21 fallaron; 922 pruebas pasaron, 1 falló, 159 omitidas** (150 archivos en total). Verifiqué la causa en dos de los fallos representativos (`nav`, `payment-benefit`): «Rollup failed to resolve import "xlsx" from src/libs.js»; la falla de `release-config` y `pricing-import-app` tiene la misma causa. **No verifiqué una por una** las otras 18 suites fallidas; por el patrón (las que construyen la app completa con `app-harness`) se atribuyen a `xlsx`, pero eso es una inferencia hasta correrlas con la dependencia instalada.
  - `node scripts/check-versions.mjs` en la copia: correcto (0.4.55).
  - No se ejecutaron `npm run build`, `check:legacy` ni pruebas de Supabase real, Mercado Pago, impresora o instaladores.
  - Revisión de los cambios reales con `git status`/`git diff` antes del commit: solo los cuatro archivos listados arriba.
- **Problemas encontrados (de documentación y entorno):**
  1. `docs/ARQUITECTURA.md` está desactualizado («95 tests», «Fase A»; omite `delivery/`, `payments/`, `promotions/`, `supabase/functions`, `media/`, `scripts/deploy/`).
  2. `docs/SEO-GEO-AEO.md` (829 líneas) mezcla guía de SEO, reglas, y bitácora de despliegues; su última entrada detallada es de 0.4.50 (5/11/2026), pero el código está en 0.4.55 y hay migraciones posteriores. Hay entradas de estado de producción que no se pudieron comprobar.
  3. `CHANGELOG.md`: la sección «Sin publicar» está debajo de `0.4.55` y contiene trabajo web posterior a 0.4.50; no está documentado si se publicó ni en qué versión.
  4. No hay registro de qué migraciones están aplicadas en producción ni de la versión activa de cada Edge Function (las cifras `sahten-delivery` v20 / `sahten-payments` v13 son del 5/11/2026).
  5. `AGENTS.md` cita el issue #41 y la rama `assets/fotos-sahten-2026-10-31`: no se pudieron leer (el clon solo tiene `main`; `gh issue view` falló con HTTP 403 para GraphQL desde este entorno). Cualquier agente que toque Home/banners/Catering/mapa debe leerlos antes.
  6. Evidencia citada fuera del repo (`../entregables/web-editorial-2026-11-04/`) no verificable.
  7. Colores de marca: el README de marca da naranja `#EF8E23`; otras notas del dueño citan `#F28C00`. Resolver con el dueño.
  8. `README.md` no tenía descripción del proyecto ni protocolo para agentes; `docs/PROMPT-AGENTES.md` cubre solo SEO/marca.
  9. `xlsx` desde `cdn.sheetjs.com` rompe `npm ci` en entornos restringidos (afecta a cualquier agente en un sandbox).
- **Funcionalidades pendientes:** ninguna de producto (esta tarea fue de documentación). Pendientes de documentación: ver «Instrucciones para continuar».
- **Estado de publicación o despliegue:** **Nada publicado.** Los cambios están en la rama `docs/protocolo-agentes-ia`. No se hizo merge a `main`, ni deploy, ni release, ni cambios en Supabase/Cloudflare. Los archivos modificados no coinciden con las rutas que disparan los workflows de despliegue (`sahten-promo-checkout.yml`, `release-on-version.yml`), por lo que integrarlos a `main` no debería publicar nada; igualmente revisá el `on:` de los workflows en el momento del merge.
- **Resumen:**
  - **Implementado:** `AGENTS.md` ampliado, `docs/AI_CONTEXT.md`, `docs/AI_HANDOFF.md`, sección en `README.md`.
  - **Probado:** solo la coherencia de versiones y una corrida de la suite en una copia temporal sin `xlsx` (129/150 archivos OK; 21 fallan por la dependencia ausente). No se probó la documentación contra una ejecución completa de la suite.
  - **Publicado:** nada.
  - **Pendiente:** merge de la rama por parte del dueño; verificación de los puntos «No verificado» de `AI_CONTEXT.md`; corrección de los problemas de documentación 1–8; correr la suite completa donde `xlsx` esté disponible.
- **Instrucciones para continuar:**
  1. Leé `AGENTS.md`, `docs/AI_CONTEXT.md` y esta entrada. Hacé `git fetch --all` y confirmá si la rama `docs/protocolo-agentes-ia` fue integrada; si no, no la pises.
  2. En una máquina con acceso a `cdn.sheetjs.com`: `npm ci && npx vitest run && npm run check:versions && npm run build` y anotá los números reales. Si las 21 suites ahora pasan, actualizá §10 punto 1 de `AI_CONTEXT.md`.
  3. Pedile al dueño (o verificá con acceso autorizado) el estado de producción: migraciones aplicadas, versiones de las Edge Functions, qué parte de «Sin publicar» del CHANGELOG está online y si la 0.4.55 tiene instaladores/web publicados. Registrá la respuesta en `AI_CONTEXT.md` §11 reemplazando los ⛔.
  4. Leé el issue #41 y la rama `assets/fotos-sahten-2026-10-31` antes de tocar Home/banners/Catering/mapa.
  5. Tareas de documentación sugeridas (cada una en su rama y con su entrada de handoff): actualizar `docs/ARQUITECTURA.md`; separar de `SEO-GEO-AEO.md` el registro histórico de despliegues; ordenar la sección «Sin publicar» del CHANGELOG (solo con acuerdo del dueño y recordando el disparador de `release-on-version.yml`); unificar el color naranja de marca.
  6. Desde ahora, **toda** intervención de cualquier agente agrega su entrada al principio de este archivo.
