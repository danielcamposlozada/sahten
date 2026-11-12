# Sahten — Contexto permanente para agentes de IA

> **Lectura obligatoria** (paso 2 del protocolo de [AGENTS.md](../AGENTS.md)). Este documento es el mapa del proyecto. La bitácora de intervenciones está en [AI_HANDOFF.md](AI_HANDOFF.md).
>
> **Cómo se mantiene:** lo actualiza cada agente cuyo cambio altere arquitectura, reglas, estado o problemas conocidos. Si algo de acá contradice el código, el código manda: corregí este archivo.
>
> **Convención de certeza** usada en todo el documento:
> - **[Código]** = comprobado leyendo el código/archivos del repositorio en la auditoría del 12/11/2026 (commit `7048311`, versión 0.4.55).
> - **[Doc]** = afirmado solo por documentación histórica (`CHANGELOG.md`, `docs/*.md`); no se re-verificó en el código o en producción.
> - **[No verificado]** = depende de servicios externos o de producción, que la auditoría no pudo consultar.

---

## 1. Objetivo del producto

Sahten es la herramienta de gestión del restaurante **Sahten Gastronomía Árabe** (cocina árabe siria, Roca 1489, Vicente López, Buenos Aires; web https://sahten.online) y es **además un producto genérico** («gestión de costos para gastronomía») licenciado AGPL-3.0-or-later. [Código: `package.json`, `LICENSE`]. Datos confirmados del negocio: `docs/SEO-GEO-AEO.md` §2.

Hace cuatro cosas, en un mismo proyecto:

1. **Gestión de costos y precios**: ingredientes, envases, recetas/combos, gasto fijo, precios por tier y canal, proyección de ventas, ingeniería de menú, reportes, stock y mercadería.
2. **Mostrador** (caja): venta presencial, retiro y delivery, descuento de stock, tickets/comandas, impresión directa.
3. **Web de pedidos** (`sahten.online`): se **genera desde la app** (`src/online/`), con tienda `/pedir/`, carta, promociones, checkout, delivery con zonas geográficas, cupones, fidelización por teléfono y pago con Mercado Pago.
4. **Operación en la nube** (Supabase, opcional): sincroniza proyecto, menú y pedidos entre equipos, con usuarios y roles.

## 2. Arquitectura y componentes

Tres piezas que se despliegan por separado:

| Pieza | Qué es | Dónde corre | Cómo se publica |
|---|---|---|---|
| **App** (cliente) | Vite + JS, UI en español; HTML/CSS de «v3» + módulos | Navegador / PWA / app de escritorio **Tauri 2** (Mac y Windows) | Release de GitHub con instaladores firmados para el actualizador (`release-on-version.yml`) |
| **Web publicada** | Carpeta estática (`index.html`, `menu.json`, `pedir/`, `menu/`, etc.) generada por la app o por scripts de `scripts/deploy/` | **Cloudflare Pages** (proyecto `sahten-menu`) | Workflows manuales/condicionados en `.github/workflows/` |
| **Backend** | Postgres + RLS + RPC + **3 Edge Functions** de Supabase (Deno) | Supabase | Manual: migraciones y deploy de funciones, solo con autorización del dueño |

Capas dentro del código [Código: `docs/ARQUITECTURA.md` + estructura real]:

- `src/core/` — cálculo **puro** (sin DOM): costos, precios, proyección, stock, delivery, promociones, política comercial, cupones, fidelización, tickets. Todo recibe el estado como primer argumento. Es la fuente de verdad de los importes y **se reutiliza en el servidor** (las Edge Functions importan `src/`).
- `src/project/` — el proyecto como archivo `.sahten` (esquema, migraciones, guardado automático, respaldos, adaptadores de archivo).
- `src/legacy/` + `reference/` + `src/styles/` — scripts clásicos heredados de «Sahten v3.html» (aún grandes: `src/legacy/app.js` ≈ 5.100 líneas). Migrando panel por panel a `src/modules/`.
- `src/modules/`, `src/ui/`, `src/events.js`, `src/bridge/legacy-globals.js` — paneles, componentes, registro de eventos y puente entre código viejo y nuevo (el estado vive en `window.SAHTEN.state`).
- `src/online/` — web publicada y conexión online (cliente Supabase REST/Auth/Realtime, sincronización con cola offline, roles, pedidos en vivo, publicación, SEO, tienda, promociones públicas).
- `src/delivery/`, `src/payments/`, `src/promotions/` — **lado servidor** (`repository.js`/`service.js`/`server.js` corren en Edge Functions) y clientes/UI asociados.
- `src/desktop/` + `src-tauri/` — integración de escritorio (archivos, respaldos, configuración, impresión térmica nativa en `src-tauri/src/printing.rs`, actualizador).
- `media/sahten-editorial/` — recursos de la home editorial publicada (banners, videos, mapa MapLibre, CSS/JS runtime).

Principios de diseño vigentes:
- **Nunca confiar en importes/costos/cupones que mande el navegador**: el servidor recotiza con datos propios (comentario explícito en `src/core/promotions.js`). [Código]
- Importes en **centavos enteros** en motores de promoción/pago. [Código]
- Local primero: el archivo `.sahten` es la fuente de verdad del dueño; la nube sincroniza con cola offline y detección de conflictos por versión. [Código: `src/online/sync.js`; Doc]
- El baseline v3 (`tests/fixtures/baseline-v3.json`) garantiza que los números de costos/precios siguen idénticos al original. [Código: `tests/baseline.test.js`, `tests/bridge.test.js`]

## 3. Estructura de directorios (resumen)

```
AGENTS.md  CLAUDE.md(@AGENTS.md)  README.md  CHANGELOG.md  index.html  vite.config.js
src/            app, core puro, módulos, online, delivery, payments, promotions, desktop, legacy, i18n, styles, ui
src-tauri/      Rust: ventana, plugins, asociación .sahten, actualizador, impresión (printing.rs)
supabase/       schema.sql, payments.sql, photos.sql, migrations/ (32), functions/{sahten-delivery,sahten-payments,sahten-promotions}
scripts/        make-*.mjs, check-*.mjs, release-notes.mjs, build-brand-kit.py, deploy/ (empaquetado de la web)
scripts/deploy/ sahten-safe-checkout, sahten-safe-promo-checkout, editorial-home/shell, catalog-integrity, indexnow, build-sahten-cuenta
tests/          Vitest: 150 archivos *.test.js + helpers/fixtures (app-harness.js construye la app real en jsdom)
docs/           guías por funcionalidad, SEO-GEO-AEO.md (también funciona como registro histórico), brand/, sahten/, delivery/
media/          recursos de la home editorial
public/         PWA (manifest, sw.js, íconos) y receipt-print.html
reference/      «Sahten v3» original intacto (fuente del baseline)
samples/        proyecto demo (.sahten) y sitio demo
.github/workflows/  ci, release*, deploy*, promo checkout, native-printing, rentabilidad-captures, diagnósticos
```

## 4. Tecnologías y dependencias

[Código: `package.json`, `.github/workflows/`]

- **JS/Node 22**, ESM, Vite 7, Vitest 3, jsdom 26, `@electric-sql/pglite` (Postgres real en pruebas), jsqr.
- Runtime: Chart.js 4, Leaflet 1.9, `polygon-clipping`, `qrcode-generator`, fuentes DM Sans/DM Mono, **SheetJS `xlsx` 0.20.3 desde `https://cdn.sheetjs.com/...tgz`** (no está en npm; ver problemas conocidos), plugins Tauri 2 (dialog, fs, opener, process, store, updater). Home editorial: MapLibre GL (`media/sahten-editorial/`, licencia incluida).
- Escritorio: Rust/Tauri 2 (`identifier app.sahten.desktop`), actualizador con `latest.json` en GitHub Releases.
- Backend: Supabase (Postgres, Auth, Realtime, Storage de fotos, Edge Functions en Deno con `deno.lock`).
- Sin CDN en tiempo de ejecución: `tests/release-config.test.js` lo exige. [Código]
- Versión única en 6 lugares (`package.json`, `tauri.conf.json`, `Cargo.toml`, `schema.js APP_VERSION`, `package-lock.json` ×2/Cargo.lock); `npm run check:versions` verifica que coincidan. [Código]

## 5. Bases de datos e integraciones

### Supabase (opcional por negocio; producción en uso) [Código: `supabase/`]

- **Esquema público** (`schema.sql`): `projects`, `menus`, `orders`, `stores`, `project_members`, `project_invites`, `project_ops`, `audit_log`; RPC de proyecto/roles (`create_project`, `save_project`, `get_project_data`, `invite_member`, `set_member_role`, `list_audit`, …). Roles: `owner`, `admin`, `encargado`, `cajero`, `lectura` (`src/online/roles.js`; la seguridad real es RLS).
- **Esquemas privados** (no accesibles a `anon`/`authenticated`): `sahten_private` (Mercado Pago, cupones, fidelización, cobros), `sahten_catalog_private` (disponibilidad, horarios, zonas, configuración de delivery, campañas, complementos/upsells), `sahten_delivery_private` (cotizaciones, validaciones del POS, límites).
- **32 migraciones** en `supabase/migrations/` (de 20261023 a 20261107). **No hay registro en el repo de cuáles están aplicadas en producción**: `docs/SEO-GEO-AEO.md` y `docs/CONTROLES-EN-VIVO.md` narran las aplicaciones hasta 0.4.50; de las posteriores (p. ej. `20261105…`, `20261106…`, `20261107…`) hay que confirmarlo con el dueño o consultando Supabase. [No verificado]
- **Edge Functions** (`supabase/functions/*/index.ts`, finas; la lógica está en `src/`):
  - `sahten-delivery` → `src/delivery/repository.js` (+`service.js`): cotización, validación del POS, creación de pedidos de retiro/delivery, rutas (OpenRouteService en `routing.js`), ofertas firmadas de complementos (HMAC `SAHTEN_UPSELL_SIGNING_KEY`, opcional).
  - `sahten-payments` → `src/payments/*`: preferencia de Mercado Pago Checkout Pro, webhook verificado, acreditación y conciliación.
  - `sahten-promotions` → `src/promotions/server.js`: emisión administrativa de cupones (solo servidor, `service_role`).
- Secretos usados por workflows: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TAURI_SIGNING_PRIVATE_KEY(+PASSWORD)`, `APPLE_*` (opcionales). **Nunca** registrar sus valores.

### Otros servicios
- **Cloudflare Pages** (web) y DNS; **GitHub** (código, CI/CD, releases, issues/PR; el repo es `danielcamposlozada/sahten`).
- **Mercado Pago** (Checkout Pro, por negocio; cada negocio aporta sus credenciales — `docs/MERCADO-PAGO.md`).
- **OpenRouteService** (rutas/geocoding de delivery), **IndexNow** (aviso a buscadores tras publicar), **Google Search Console / Business Profile**, **WhatsApp** (`wa.me`) como canal alternativo de pedido.

## 6. Flujos funcionales principales

Cada ítem indica dónde mirar. Los detalles de comportamiento y las cifras históricas están en `CHANGELOG.md` y en la guía enlazada.

1. **Costos y precios** — `src/core/costs.js`, `pricing.js`, `projection.js`, `gf.js`, `menuEngineering.js`; paneles en `src/modules/`. Pruebas: `costs`, `pricing`, `projection`, `gf`, `baseline`.
2. **Mostrador** — `src/modules/mostrador.js`, `src/legacy/sahten-mostrador.js`, `src/core/stock.js`. Con delivery consulta la cotización vigente del servidor antes de confirmar y pide aceptación de diferencias (según CHANGELOG 0.4.51). Guía: `docs/MOSTRADOR.md`.
3. **Checkout web** — cliente `src/online/storefront.js`, `payment-choice`, `checkout-service-choice`, `media/sahten-editorial/checkout-runtime.js`; servidor `src/delivery/service.js` + `src/payments/service.js`. El servidor valida horario de servicio, disponibilidad, zona/envío, cupón y recotiza; idempotencia por `requestId` e intención del carrito. Pruebas: `checkout-*`, `coupon-*`, `delivery-*`, `storefront-*`.
4. **Motor de promociones** — `src/core/promotions.js` (campañas por horario con zona `America/Argentina/Buenos_Aires`, `quotePromotions`), `promotion-policy.js` (regla de rentabilidad, comisión de Mercado Pago editable y **provisional 10 %** por defecto), `payment-benefit.js` (descuento por efectivo/transferencia), `upsell-economics.js` + `src/promotions/upsell-checkout.js` (complementos con oferta firmada de 5 min y nonce). Publicación y revisión de costos: `promotion-publication.js`, `promotion-cost-review.js`, `promotion-verification.js`. Guías: `docs/GUIA-PROMOCIONES-Y-CUPONES.md`, `docs/sahten/*`.
5. **Cupones y fidelización** — `coupon-terms.js`, `loyalty-phone.js`, `src/promotions/server.js`; SQL: `sahten_private.promotion_coupons`, `loyalty_programs`, `hold_checkout_coupon`/`settle_checkout_coupon`/`sahten_mp_release_coupon`. Primera y segunda compra se reconocen por **teléfono, sin código**; la segunda compra solo se emite con el pedido original **cobrado** (Doc 0.4.50). El cupón es de Sahten también con Mercado Pago, con condiciones propias (`couponForMethod`).
6. **Delivery** — `src/delivery/` (zonas geográficas, hoja de ruta, incentivos, horarios, estado en vivo), `src/core/delivery.js`, tablas `delivery_*`. **El envío gratis se evalúa sobre el subtotal bruto de productos, antes de descuentos** (0.4.51/0.4.55). Guías: `DELIVERY-GEOGRAFICO.md`, `HORARIOS-Y-DELIVERY.md`, `CONTROLES-EN-VIVO.md`.
7. **Pedidos operativos** — flujos de estado distintos para retiro y delivery (`src/online/order-workflow.js`); migración `20261023_online_order_statuses.sql`.
8. **Tickets e impresión** — `src/ui/receipt-*.js`, `src/desktop/receipt-printing.js`, `src-tauri/src/printing.rs`, `public/receipt-print.html`; el ticket incluye QR de reseñas y beneficio de segunda compra. Guías: `IMPRESION.md`, `IMPRESION-DIRECTA.md`. **La prueba con impresora física IT01 figura como pendiente** (CHANGELOG 0.4.50).
9. **Autenticación** — `src/online/supabase.js`, `authDialogs.js`, `cloudEntry.js`: correo+contraseña, código OTP por correo, recuperación, pegado de enlaces de correo con `token_hash` (endpoints `/auth/v1/{token,otp,verify,recover,signup,user}`). Descubre las membresías del usuario y abre solo el proyecto autorizado. Guía: `docs/SUPABASE.md`.
10. **Publicación de la web** — la app genera carpeta/ZIP (`src/online/publish.js`, `docs/PUBLICAR.md`); producción usa `scripts/deploy/sahten-safe-promo-checkout.mjs` (preserva portada, fotos y catálogo; verifica huella comercial; IndexNow) disparado por workflow. SEO: `src/online/seo.js` (script plano embebido, **sin imports**).
11. **Instaladores y actualizaciones** — `release-on-version.yml`: ante un push a `main` que toque `package.json`/`tauri.conf.json`/`CHANGELOG.md`/el workflow, y **si el tag `v<versión>` no existe**, corre pruebas y publica instaladores Windows x64 y macOS universal con firma de actualizador (`TAURI_SIGNING_*`). La app **no está firmada/notarizada por Apple** salvo que existan los secretos `APPLE_*` (`docs/INSTALACION.md`).

## 7. Reglas comerciales y restricciones

Vigentes según la documentación del dueño; **verificá siempre contra el código y pedí confirmación ante la duda**.

- **No inventar datos del negocio** (horarios, precios, promos, categorías). Fuente: `docs/SEO-GEO-AEO.md` §2 y §6 (preguntas abiertas).
- **Descuento 10 % efectivo/transferencia**: solo productos, web y Mostrador, **no acumulable** (se aplica el mayor). Activado el 24/10/2026 (Doc). La política es configurable (`paymentBenefitPolicy`).
- **Envío gratis por zona sobre subtotal bruto**, antes de descuentos de pago/campañas/cupones (Código: tests `0.4.55`; ver CHANGELOG).
- **Cupones**: de un solo uso, ligados al teléfono, reserva por intento y canje tras acreditación verificada; liberación de reservas vencidas solo tras consultar el estado del proveedor.
- **Promociones**: nada se publica sin revisión económica (costos privados, margen del complemento y de la cesta). Los costos nunca viajan al navegador. «Costos adicionales pendientes» se registra como supuesto provisional, no como comprobado.
- **Comisión de Mercado Pago**: 10 % provisional editable; no es la tasa contractual ni un gasto contable.
- **Fatay Hour** (18:30–21:30) y envío gratis en Vicente López: aparecen en materiales del negocio; su vigencia figura como pregunta abierta en `SEO-GEO-AEO.md` §6 — confirmar con el dueño antes de usarlos en textos nuevos.
- **Marca**: verde `#235328`, naranja `#EF8E23`, crema `#FFF4D6`; **árabe siempre con vocales**; logos solo variantes sólidas del kit, sin redibujar ni recortar (`docs/brand/sahten/README.md`). Nota: los colores citados en notas de otros contextos pueden diferir (p. ej. naranja `#F28C00`); la fuente de verdad es el README de marca.
- **Home/banners/Catering/mapa**: decisión del dueño del 31/10/2026 (ver `AGENTS.md` e issue #41): rediseño «Terra» rechazado, se continúa la versión de Codex; fotos del banner 10 % OFF y de Catering con reglas exactas.
- **Restricciones de producción**: ver `AGENTS.md` §4. Ningún agente despliega, migra, publica ni escribe en producción sin autorización explícita.
- **Datos personales**: la tabla `orders` contiene datos de clientes; no se lee ni se vuelca a logs/docs/commits.

## 8. Índice de documentación específica (leer según el área)

| Área | Documento |
|---|---|
| Arquitectura base y migración | `docs/ARQUITECTURA.md`, `docs/AUDITORIA.md`, `docs/AUDITORIA-UX.md`, `docs/SISTEMA-DISENO.md` |
| Formato de archivo | `docs/FORMATO-SAHTEN.md` |
| Web, SEO, marca | `docs/SEO-GEO-AEO.md`, `docs/brand/sahten/README.md`, `docs/PUBLICAR.md`, `docs/PROMPT-AGENTES.md` |
| Supabase / nube / roles | `docs/SUPABASE.md`, `docs/CONTROLES-EN-VIVO.md` |
| Pagos | `docs/MERCADO-PAGO.md` |
| Promociones, cupones, complementos | `docs/GUIA-PROMOCIONES-Y-CUPONES.md`, `docs/sahten/*` |
| Delivery y horarios | `docs/DELIVERY-GEOGRAFICO.md`, `docs/HORARIOS-Y-DELIVERY.md`, `docs/DISPONIBILIDAD.md` |
| Mostrador, stock, mercadería | `docs/MOSTRADOR.md`, `docs/MERCADERIA.md`, `docs/PRECIOS-FIJADOS.md` |
| Impresión | `docs/IMPRESION.md`, `docs/IMPRESION-DIRECTA.md` |
| Instalación y releases | `docs/INSTALACION.md` |
| Clientes | `docs/IMPORTAR-CLIENTES.md` |
| QA | `docs/QA.md` |
| Historial de cambios | `CHANGELOG.md` (solo hasta la versión indicada; ver §10) |

## 9. Decisiones técnicas relevantes

- **Núcleo puro compartido cliente/servidor**: `src/core` se importa tanto en la app como en las Edge Functions, para que caja, tienda y servidor calculen igual.
- **Migración incremental desde v3**: se conserva `src/legacy/` y se mueve por paneles, protegida por el baseline.
- **Estado único** (`state`) con accesores globales para no romper los `onclick` heredados.
- **Seguridad en el servidor**: tablas privadas en esquemas aparte, funciones `security definer` con `search_path` fijado (migración `20261025015321_delivery_function_search_paths.sql`), `service_role` solo en Edge Functions; el cliente rechaza `service_role` (`supabase.js`).
- **Publicación conservadora de la web**: los scripts de despliegue preservan catálogo, fotos y rutas de producción y verifican la huella comercial antes de publicar; el workflow histórico «sin promociones» quedó solo manual.
- **Mercado Pago por negocio** (no una cuenta central) y cupones propios de Sahten con reserva/canje.
- **Sin dependencias de CDN** en runtime.
- **Impresión directa nativa** en Tauri (Rust) con validación de tamaño de trabajos.
- **Diseño de web**: se descartó la propuesta «Terra» (PR #40); la home editorial vigente es la «C / tipografía 3» con mapa MapLibre.

## 10. Problemas conocidos

Encontrados en la auditoría del 12/11/2026. Ver la entrada de `AI_HANDOFF.md` de esa fecha para el detalle y la evidencia.

**De entorno / pruebas**
1. `npm ci` falla en entornos sin acceso a `cdn.sheetjs.com` (HTTP 403): `xlsx` se instala desde una URL de tarball. Sin esa dependencia, 21 de 150 archivos de prueba no corren (los que construyen la app completa, p. ej. `nav`, `bridge`, `online-app`, `delivery-app`). Con la dependencia ausente: 129 archivos pasan, 922 pruebas pasan, 159 omitidas, 1 falla (`release-config`, por el mismo motivo).
2. Las pruebas contra servicios reales (Supabase, Mercado Pago, impresora física, instaladores, Rust) no están en la suite (ver `docs/QA.md`).

**De documentación** (ver también el handoff)
3. `docs/ARQUITECTURA.md` está desactualizado: dice «95 tests» (hay 150 archivos), describe una «Fase A» y omite `delivery/`, `payments/`, `promotions/`, `supabase/functions`, `media/` y `scripts/deploy/`.
4. `docs/SEO-GEO-AEO.md` (829 líneas) mezcla guía de SEO, reglas, estado histórico de despliegues y entradas de bitácora; su última entrada de estado detallada es la 0.4.50 (5/11/2026), mientras el código está en 0.4.55. `AI_HANDOFF.md` pasa a ser el registro cronológico; ese archivo conserva su valor como guía de SEO y registro histórico hasta 0.4.50.
5. `README.md` no describía el proyecto ni enlazaba un protocolo de agentes; `docs/PROMPT-AGENTES.md` solo cubre SEO/marca y no el protocolo general.
6. `CHANGELOG.md`: la sección «Sin publicar» está **debajo** de `0.4.55` y contiene trabajo web posterior a 0.4.50 que no se puede ubicar en una versión; su estado de publicación **no está documentado**.
7. Falta un registro de qué migraciones de `supabase/migrations/` están aplicadas en producción y qué versión de cada Edge Function está activa (las cifras `sahten-delivery` v20 / `sahten-payments` v13 son de 5/11/2026 en `SEO-GEO-AEO.md`).
8. Parte de las rutas citadas en documentos históricos (p. ej. `../entregables/web-editorial-2026-11-04/`) apuntan a evidencia **fuera del repositorio**; no se pudo verificar.
9. Hay discrepancias de color de marca entre fuentes (naranja `#EF8E23` en el README de marca; otras notas del dueño usan `#F28C00`).
10. `AGENTS.md` referencia el issue #41 y la rama `assets/fotos-sahten-2026-10-31`; **no se pudieron leer** en la auditoría (la rama no existe en el clon: solo hay `origin/main`; el acceso a issues desde el entorno de la auditoría está limitado).

**De producto / técnicos** (declarados por el propio repo)
11. Pruebas físicas de ticket con impresora IT01 pendientes (CHANGELOG 0.4.50).
12. `npm audit` informó cuatro alertas en herramientas de desarrollo (Vite/Vitest) al 23/10/2026; actualización pendiente como tarea aparte (Doc; no se re-ejecutó).
13. La app de escritorio no está firmada ni notarizada para Apple/Windows salvo que se configuren los secretos; el usuario ve avisos de Gatekeeper/SmartScreen (`docs/INSTALACION.md`).
14. Solicitud manual de reindexación en Search Console falló por reCAPTCHA el 5/11/2026 (Doc); no se reintentó.
15. Complementos: Falafel pendiente por decisión del dueño; Delivery, Mostrador y Mercado Pago en el recorrido de complementos requieren contratos propios (`docs/sahten/INTEGRACION-COMPLEMENTOS.md`).

## 11. Estado verificado de las funcionalidades (auditoría 12/11/2026, commit `7048311`, v0.4.55)

Leyenda: ✅ existe en código **y** tiene archivos de prueba en `tests/` · 🟡 existe en código, sin prueba localizada o su estado de producción no se verificó · ⛔ no verificable desde el repo.
«Pruebas» significa que **existen** archivos de prueba; no que se hayan ejecutado todas (ver §10 punto 1).

| Funcionalidad | Código | Pruebas | Producción |
|---|---|---|---|
| Costos, precios, proyección, GF, ingeniería de menú, stock | ✅ `src/core` | ✅ | n/a (app local) |
| Archivo `.sahten`, respaldos, migración de esquema | ✅ `src/project` | ✅ `session`, `schema`, `project-app` | n/a |
| Mostrador, impresión, tickets | ✅ | ✅ `print`, `receipt-*`, `direct-printing` | ⛔ impresora física pendiente |
| Roles y usuarios, sync online | ✅ `src/online` | ✅ `online-*`, `supabase-rls` | ⛔ |
| Auth por correo/OTP/recuperación | ✅ | ✅ `supabase-client`, `user-menu` | ⛔ |
| Checkout web, delivery, zonas, horarios | ✅ | ✅ `checkout-*`, `delivery-*`, `service-hours-*` | ⛔ (Doc: publicado hasta 0.4.50) |
| Mercado Pago (Checkout Pro) | ✅ `src/payments` | ✅ `mercadopago*` | ⛔ |
| Promociones, cupones, fidelización por teléfono | ✅ | ✅ `promotion*`, `coupon-*`, `loyalty-*` | ⛔ (Doc: 0.4.50 publicado; programas aún sin activar al 5/11) |
| Complementos/upsells con oferta firmada | ✅ | ✅ `upsell-*` | ⛔ activación sujeta a revisión económica |
| Envío gratis sobre subtotal bruto (0.4.55) | ✅ commit `7048311` | ✅ según CHANGELOG | ⛔ publicación no documentada |
| Web editorial / SEO | ✅ | ✅ `seo`, `editorial-web`, `web-nav`, `storefront*` | ⛔ (Doc: publicada) |
| CI y empaquetado de web | ✅ `.github/workflows`, `scripts/deploy` | ✅ `deployment-catalog-integrity`, `release-config` | ⛔ |
| Instaladores | ✅ `release-on-version.yml`, `src-tauri` | ✅ `release-config`, `release-notes` | ⛔ (Doc: v0.4.50 publicada) |

Para cualquier ⛔, no afirmes el estado de producción: pedíselo al dueño o verificalo con acceso autorizado.
