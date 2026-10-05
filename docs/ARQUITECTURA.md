# Arquitectura (Fase A)

Sahten sigue siendo la misma app que `Sahten v3.html`, ahora con Vite, un núcleo de cálculo testeado y un estado único.
El HTML y el CSS son los de v3. La lógica se mueve de a poco: lo que ya salió está en `src/core/`; el resto sigue en `src/legacy/`.

```
index.html                 markup de v3 (sin <script> inline)
src/
  main.js                  entrada: estilos → núcleo → puente → código legado → módulos
  core/                    cálculo PURO (sin DOM, sin localStorage). Todo recibe el estado como 1.er argumento
    state.js               estado único del proyecto (objeto en memoria)
    format.js              fmt() y RND() según moneda del proyecto
    costs.js               ingredientes, envases, combos, porciones
    gf.js                  gasto fijo: total, absorbe, por unidad, control mensual (GF_MONTHS)
    pricing.js             tier, ajuste, descuento, redondeo, canales, neto recibido
    projection.js          computeProjection() única + distribución por canal
    menuEngineering.js     ingeniería de menú (Kasavana & Smith) y escenarios de estrategia
    stock.js               consumo por orden, descuento y reversión
    delivery.js            zonas y envío (lo usan el Mostrador, el menú publicado y la web)
    projectFile.js         .sahten ⇄ estado (mínimo; la Fase B lo completa)
  project/                 el proyecto como archivo (.sahten)
    schema.js              formato, migrate(), serialización estable, hash de contenido
    session.js             archivo abierto, guardado automático, abrir/nuevo/duplicar/exportar, respaldos
    backups.js, diff.js    respaldos diario / pre-estrategia y resumen de diferencias
    kv.js                  datos del negocio de los módulos viejos en memoria (van al archivo)
    adapters/              fsAccess (Chrome/Edge), download (resto), memory (tests), backupStores (OPFS)
    app.js, ui.js          integración con la app: qué se guarda y qué se carga; menú, indicador, bienvenida
    demo.sahten.json       proyecto de ejemplo (npm run demo)
  online/                  menú publicado y online opcional (Fase C)
    menuJson.js, publish.js, web/index.html   carpeta estática: index.html + menu.json + img/ (pedido por WhatsApp)
    orderMessage.js        mensaje de WhatsApp (se inyecta también en la web publicada)
    supabase.js            cliente REST + Auth + Realtime (solo anon key; rechaza service_role)
    controller.js, orders.js   conectar, sincronizar menú y recibir pedidos en vivo en Mostrador › Delivery
    sync.js                local primero, cola offline, conflictos por versión; roles.js, roleView.js, ui.js
  desktop/                 app de escritorio (Tauri): adaptador de archivos, respaldos junto al proyecto, configuración, integración con el sistema
  libs.js                  Chart.js y fuentes (al arrancar), Leaflet y SheetJS (al primer uso): sin CDN
  i18n/                    t('clave', {param}); es-AR por defecto
  events.js                registro de módulos con eventos (reemplaza los wrappers en cadena)
  bridge/legacy-globals.js accesores y funciones globales para el código legado
  modules/                 un archivo por panel (qué se dibuja al mostrarlo)
  legacy/                  scripts clásicos de v3 (app.js, sahten-*.js), a migrar panel por panel
  styles/                  CSS de v3
src-tauri/                Rust: ventana, plugins, asociación .sahten, actualizador
public/                    manifiesto PWA, íconos y service worker
reference/                 v3 original intacto (fuente del baseline de precios)
tests/                     Vitest
scripts/                   baseline, arnés jsdom, verificación de sintaxis legada
samples/sahten-demo.sahten proyecto de ejemplo (generado desde SAHTEN_DEMO_DATA)
```

## Cómo se conecta lo viejo con lo nuevo

- **Estado único.** `PRODUCTS`, `TIERS`, `CHANNELS`, `GASTOS_OP`, `projManualMode`… ya no son variables sueltas:
  son accesores sobre `state` (`window.SAHTEN.state`). El código viejo las lee y asigna igual; el dato vive en el estado.
  La comisión global y el dólar (`state.globalCommission`, `state.usdRate`) dejaron de leerse del DOM: los inputs los
  reflejan y escriben con `SAHTEN.setSetting(...)`.
- **Funciones de cálculo.** `costPerUnit(p)`, `mostradorPrice(p)`, `channelPrice(p, id)`… existen como globales finos que llaman
  a `src/core` con el estado aplicado. Los `onclick="…"` del HTML siguen funcionando.
- **Eventos.** Ningún archivo reemplaza `window.showPanel` ni `window.renderX`. Cada módulo declara lo que quiere escuchar:

  ```js
  SAHTEN.events.onPanelShow('mostrador', () => …)   // al mostrar un panel ('*' = cualquiera)
  SAHTEN.events.afterRender('renderDashboard', () => …)
  SAHTEN.events.beforeRender('renderStock', () => …)
  SAHTEN.events.around('mostSetTab', (next, tab) => …)
  SAHTEN.events.onDataChanged(() => …)               // tras recalcAll() / applyData()
  ```
  `main.js` envuelve cada función de render **una sola vez** (`instrument`) y los ganchos corren en orden de registro.

## Comandos

```bash
npm install
npm run dev          # servidor de desarrollo
npm run build        # build estático en dist/
npm test             # Vitest (95 tests)
npm run baseline     # regenera tests/fixtures/baseline-v3.json y samples/sahten-demo.sahten desde reference/
SAHTEN_ONLINE=false npm run build   # versión sin online (UI de conexión deshabilitada)
npm run desktop:dev / desktop:build   # app de escritorio (necesita Rust: docs/INSTALACION.md)
npm run demo         # regenera el proyecto de ejemplo (punto fijo de guardar → cargar)
npm run check:legacy # verifica que src/legacy/*.js parseen como scripts clásicos
```

## Garantía de «mismo comportamiento»

`npm run baseline` abre `reference/Sahten v3.html` (el original) en jsdom, aplica 6 escenarios (comisión, descuentos,
ajuste de precio, GF sin ventas, moneda con decimales, proyección manual) y guarda precios por producto y canal, GF y
proyección. `tests/baseline.test.js` y `tests/bridge.test.js` exigen números **idénticos** tanto desde `src/core` como
desde la app real compilada. `tests/menuEngineering.test.js` hace lo mismo con el asistente de estrategia.

## Qué falta mover de `src/legacy/` (próximas fases)

Render de cada panel, `collectState`/`applyData` (ahora alimentan al archivo `.sahten`), Mostrador/Tienda/Menú online (Fase C),
librerías por CDN (Fase D).
