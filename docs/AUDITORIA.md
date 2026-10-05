# Sahten — Auditoría Fase 0

Fecha: 04/10/2026. Alcance: `Sahten v2.html` + `sahten-*.js/css` + `Sahten Menu v2.html`.
Método: lectura de código. **No se modificó nada.** La revisión visual se hizo sobre el código (colores fijos, overrides de modo oscuro). Las capturas quedan pendientes para hacerlas con la app abierta.

Prioridades: **A** = afecta números o datos · **M** = afecta el uso · **B** = cosmético.

---

## 0.1 Mapa de cálculo

```
INGREDIENTES (precioPkg, grPaquete, cantidad, unit)
   └─ calcIngCost(row)  → qty a gramos base × (precioPkg / grPaquete)
ENVASES (precioPkg, cantidad)
   ├─ calcEnvCost(row)  → usado por packCost()          ┐ dos funciones
   └─ calcPackCost(row) → usado dentro de combos         ┘ para lo mismo
PRODUCTO
   totalCost = (Σ ingredientes  ó  receta_cost manual) + packCost + comboCost
   getPorc   = porcionesOverride › (pesoTotal/porcionCant)×(1−merma) › porciones
   costPerUnit = totalCost / getPorc
GASTOS FIJOS
   totalGFRaw = Σ GASTOS_OP + Σ GASTOS_S
   totalGF    = totalGFRaw × (1 − Σ descuentos activos)
   gfPerUnit  = totalGF / Σ avgMes (TODOS los productos)
   gfAssigned = gfPerUnit × (gfPctOverride/100 si existe)
PRECIO
   mostradorPrice      = (costPerUnit + gfAssigned) × tier.factor − descuento → redondeo a $50
   mostradorFinalPrice = mostradorPrice × (1+surcharge mostrador) × (1+comisión global)
   channelPrice(delivery) = mostradorFinalPrice × (1+surcharge canal) × (1+comisión global)   ← ver bug B1
   channelNetReceived  = channelPrice × (1 − comisión plataforma)
   …WithDisc           = igual, con effectiveChannelDisc (producto › canal)
CONSUMIDORES
   Productos, Dashboard, Ventas+GF, Proyección (pantalla / snapshot / CSV / PDF),
   Mostrador (usa SIEMPRE mostradorFinalPrice), Menú Online (precioMostrador en collectState),
   Reportes (lee órdenes del Mostrador + Excel importado)
```

| Función | Lee | Devuelve | La usan |
|---|---|---|---|
| `calcIngCost` | INGREDIENTES, row.qty/unit, `row.v` como alternativa | $ de la fila | totalCost, recalcRecetaCost, calcComboCost |
| `totalCost` | ingredients, receta_cost, packaging, combos | $ costo de la receta completa | costPerUnit |
| `getPorc` | porcionesOverride, pesoTotal, porcionCant, merma, porciones | porciones (≥0.01) | costPerUnit, combos, peso |
| `costPerUnit` | totalCost, getPorc | $ por unidad | precios, proyección, tiers |
| `totalGF` | GASTOS_OP, GASTOS_S, GF_DISC_HISTORY | $ por mes | gfPerUnit, proyección, PE |
| `gfPerUnit` | totalGF, avgMes de todos | $ por unidad | gfAssigned |
| `mostradorPrice` | costPerUnit, gfAssigned, tier, discount | $ redondeado a 50 | todo lo de precios |
| `mostradorFinalPrice` | mostradorPrice, canal mostrador, **input DOM** de comisión | $ | Mostrador POS, channelPrice, exportaciones |
| `channelPrice` | ídem + surcharge del canal | $ al cliente | proyección, productos |
| `getProjUnits` | projManualMode, projManualUnits, avgMes | unidades | Proyección, tierProfitTotalProj |
| `getUSD` | **input DOM** `usd-rate` (si no hay valor: 1200) | cotización | solo referencias en USD |

**Hallazgo estructural:** la proyección se calcula en **4 lugares distintos** con lógica copiada:
- `renderProyeccion`
- `_buildSnapData`
- `exportProjectionCSV`
- `computeCurrentProjData` (PDF)

Ya divergen (ver B4 y B5). Hay que unificarlos en una sola función `computeProjection()`.

---

## 0.2 Mecánicas

### Menú / Productos
- **Cómo funciona:** precio = (costo + GF asignado) × tier − descuento. `recetaOnly` lo oculta del Menú y del Mostrador. La categoría es texto libre.
- **Depende de:** Costo de Receta, GF, Tiers, Canales.
- **Afecta:** todas las secciones de venta y análisis.
- **Casos borde:**
  - Sin ventas cargadas (`avgMes` = 0 en todos), `gfPerUnit` = 0 y **los precios no incluyen gasto fijo**. En un proyecto nuevo, todos los precios salen por debajo de lo necesario hasta cargar ventas. El setup inicial debe pedir ventas estimadas.
  - `getTier(id)` devuelve `TIERS[2]` como respaldo. Con menos de 3 tiers (proyecto vacío), devuelve `undefined` y `tier.factor` rompe el render. **Bloquea el arranque vacío.**
  - Redondeo a $50 fijo: en otras monedas (USD/EUR) no tiene sentido. Hacerlo configurable.

### Stock
- **Cómo funciona:** stock actual y mínimo por ítem (ingrediente, envase, producto). Movimientos manuales: ingreso, egreso, merma, ajuste.
- **Bug A:** **el Mostrador no descuenta stock.** `mostradorCheckout()` crea la orden y no toca `STOCK`. Una venta no consume ingredientes ni envases.
  - Propuesta: al cobrar, descontar según la receta (ingredientes × qty / porciones, envases, combos).
  - Registrar el movimiento como `egreso · venta #0001`.
  - Permitir revertirlo si se reabre o elimina la orden.
- **Bug A:** el stock de envases se maneja por unidades, pero `initStock` crea mínimos en gramos (`minimo:500, unit:'g'`) para todo.
- **Bug B:** en la vista de tarjetas, el selector de unidad tiene `background:white` fijo (`Sahten v2.html` línea ~6898) y en modo oscuro aparece en blanco.

### Gastos Fijos
- **Cómo funciona:** operativos + sueldos, con descuentos acumulables activables (historial).
- **Bug A:** los descuentos se **suman** (`Σ pct`). Dos descuentos del 10% dan 20%, no 19%. Puede ser lo buscado, pero la UI dice "acumulativamente". Confirmar la regla.
- **Bug M:** `gfPctOverride` redistribuye el GF de un producto, pero no rebalancea los demás. Con overrides, la cobertura total puede quedar por encima o por debajo del 100% sin que se avise. Hoy solo se ve en la barra de cobertura de Ventas+GF.
- **Bug B:** la equivalencia en USD de cada fila usa `color:#888` fijo.

### Costo de Receta
- **Cómo funciona:** ingredientes por `ingId` con conversión de unidades, envases, combos anidados con overrides locales y protección de ciclos. Peso automático, merma y porciones.
- **Bug A — se pierde el costo manual:** `recalcRecetaCost()` hace `p.receta_cost = totIng`. Si la receta no tiene ingredientes cargados (solo costo manual), cualquier edición la pone en **0**. Debería escribir solo cuando `totIng > 0`.
- **Bug A — combo con costo manual:** `calcComboCost` usa solo el costo de ingredientes del sub-producto. Si el sub-producto tiene `receta_cost` manual (sin ingredientes), el combo suma **$0** por él. `totalCost` sí usa el valor manual. Hay que unificar.
- **Bug A — envases en kg/g:** `calcEnvCost` con unidad `kg` hace `qty × 1000 × precio por unidad`, es decir, trata el precio unitario como si fuera por gramo.
  - `calcPackCost` ignora la unidad.
  - Las dos funciones dan resultados distintos para la misma fila, según se calcule directo o dentro de un combo.
- **Bug A — división por cero:** `calcEnvCost` divide por `env.cantidad` sin protección (0 → Infinity). `calcPackCost` sí tiene protección.
- **Bug M:** `totalCost` y `packCost` hacen `p.ingredients.reduce` / `p.packaging.reduce` sin `|| []`. Un producto importado sin esos arrays rompe todo el render.
- **Bug M:** en `ingRowWeightG`, ml se suma como g (densidad 1). Está documentado en el código pero no en la UI.

### Envases
- **Cómo funciona:** precio unitario = precio del paquete ÷ cantidad. Se usan en packaging de recetas y en combos.
- Ver los bugs de `calcEnvCost` / `calcPackCost` en Costo de Receta.

### Ingredientes
- **Cómo funciona:** precio por gramo base = precioPkg ÷ grPaquete. Los cambios se propagan a todas las recetas en vivo.
- **Bug M:** para unidad `u`, si `grPaquete` o `cantidad` faltan, se usa 1 g por unidad sin aviso.
- **Bug M:** USD es solo referencia (`getUSD()` lee el input; sin valor usa **1200**). Si el input no está en pantalla, se usa 1200. Hay que pasar el valor al estado del proyecto.

### Reportes
- **Fuentes de datos:**
  - órdenes del Mostrador (`SAHTEN_ORDERS`),
  - Excel importado (`sahten_report_data`, por ejemplo de Fudo).
- **Bug A — clave compartida:** `sahten_report_data` **no se separa por proyecto**. Todos los proyectos ven los mismos reportes importados.
- **Bug M — sin vínculo con Ventas+GF:** las ventas reales del Mostrador no actualizan `avgMes`. Ventas+GF y Proyección trabajan con promedios cargados a mano, mientras Reportes tiene los reales. Propuesta: botón "Actualizar promedios desde ventas reales (últimos 30/60/90 días)".
- **Bug M — dependencias desde internet:** SheetJS y (si falta) Chart.js se cargan desde CDN al entrar a la sección, así que sin internet no hay XLSX.

### Proyección / Ventas+GF / Canales
Ver bugs B1–B5.
- `tierProfitTotalProj` ya usa unidades proyectadas (correcto).
- El Punto de Equilibrio usa un margen promedio ponderado. Es correcto mientras el mix se mantenga.

### Menú Online / Tienda
- **Bug A — clave compartida:** la configuración de la tienda se guarda en `sahten_tienda_` + `SAVE_KEY`. Pero `SAVE_KEY` es siempre `sahten_v4_data` y el sistema de workspaces solo separa las claves que **empiezan** con los prefijos listados, por lo que `sahten_tienda_*` **queda compartida** entre proyectos.
- **Bug A — la web solo lee el proyecto "default":** la web pública tiene escrito `projKey = 'sahten_tienda_sahten_v4_data'`, más la clave legacy `sahten_tienda_config` para los métodos de pago (otra clave distinta).
- **Bug M — texto engañoso:** la pestaña Categorías dice "Arrastrá para reordenar", pero no hay drag & drop, solo botones ▲▼.
- **Bug B — modo oscuro:** cada ítem de categoría tiene `background:white` inline con `color:var(--ink)`. **Este es el problema de modo oscuro reportado en Categorías.**

---

## 0.3 Bugs sospechados: verificación

| # | Bug | Estado | Ejemplo numérico |
|---|---|---|---|
| B1 | Comisión global doble en delivery | **Confirmado** | mostradorPrice $1.000, comisión global 10%, Rappi +30%. Hoy: 1.000×1,10 = 1.100 → ×1,30 = 1.430 → ×1,10 = **$1.573**. Con la comisión una sola vez: 1.000×1,30×1,10 = **$1.430**. El precio al cliente queda **+10%** inflado (+$143). |
| B2 | Banner ⭐ vs. código | **Confirmado** | El banner dice "÷ unidades de productos ⭐". `gfPerUnit()` divide por la suma de `avgMes` de **todos**. Recomendación: mantener el código (todos) y corregir el texto. |
| B3 | Comisión leída del DOM | **Confirmado** | `globalComm()` = `#global-commission.value`. Lo mismo pasa con `getUSD()`. Fuera del panel funciona solo porque el input existe oculto; si no se renderiza, la comisión vale 0. |
| B4 | Descuento de canal | **Parcial** | CSV: **ya aplica** el descuento. Snapshot (`_buildSnapData`): **no aplica**, usa `channelNetReceived` sin descuento. |
| B4b | Respaldo erróneo en CSV | **Nuevo** | `channelNetReceivedWithDisc(...) \|\| channelPrice(...)`. Con descuento del 100% (neto 0) usa el precio bruto **sin comisión** como neto, y sobreestima el ingreso. |
| B5 | Totales distintos según dónde se calculan | **Nuevo** | El CSV redondea las unidades por canal (`Math.round`). Pantalla y snapshot no lo hacen. 7 u. al 50/50 → CSV 4+4 = 8 u.; pantalla 3,5+3,5 = 7 u. |
| B6 | Claves no separadas por proyecto | **Confirmado** | Separadas: `sahten_v4_data`, `sahten_proj_snapshots`, `sahten_active_proj`, `sahten-customization`, imágenes (IndexedDB). **Compartidas:** `sahten_menu_config`, `sahten_tienda_*`, `sahten_orders`, `sahten_customers`, `sahten_mostrador_discounts`, `sahten_mostrador_payments`, `sahten_report_data`, `sahten_gf_pages`. |
| B7 | Menú Online vacío con config `{}` | **Probable causa** | Si la config se guardó con arrays faltantes (`hiddenProducts`, `hiddenCategories`), el merge `{...defaults, ...cfg}` los conserva. Pero si se guardaron como `null`, `.includes` falla y el panel queda en blanco. Validar los tipos después del merge. |
| B8 | Datos precargados | **Confirmado** | `PRODUCTS`, `INGREDIENTES`, `ENVASES`, `CHANNELS`, `TIERS`, `GASTOS_*` están escritos en el código con los datos de Sahten. |
| B9 | Pestañas recordadas | **Parcial** | `_saveTabState` existe en el Mostrador. Falta verificar Stock, Ajustes, Reportes y Menú Online. |
| B10 | Duplicación de lógica | **Confirmado** | `_esc`/`_fmtN` definidos en 3+ módulos (el último gana). `showPanel`, `renderMostrador`, `renderRecipeBody` y `Storage.prototype` están parcheados con wrappers en cadena: el orden de carga de los `<script>` decide el comportamiento. |
| B11 | Botón Cancelar del modal de nombre | **Nuevo** | `this.closest('[style]')` encuentra **el propio botón** (tiene `style`) y lo elimina. El modal queda abierto y sin botón Cancelar. Afecta "Guardar proyección" > "Nueva". |
| B12 | Mostrador ignora canal y descuentos | **Nuevo** | El POS cobra siempre `mostradorFinalPrice`. No aplica el descuento del canal mostrador definido en Canales. |

---

## 0.4 Revisión visual (desde el código)

**Cómo funciona hoy el modo oscuro:** el CSS base usa colores fijos y `sahten-enhancements.css` agrega unas **450 reglas** `[data-theme="dark"]` que los sobrescriben uno por uno. Todo color fijo puesto **inline** desde JS queda fuera de esas reglas.

Colores fijos claros encontrados (fondo blanco o casi blanco, texto gris o negro):

| Archivo | Cantidad | Notas |
|---|---|---|
| `Sahten v2.html` | 157 | CSS base (la mayoría tiene override) más inline en JS: `showNameModal` (fondo `white`, botón Cancelar `white`), selector de Stock, USD de GF `#888` |
| `sahten-enhancements.css` | 30 | revisar los que no tienen override, por ejemplo `#fffdf0` y `#fff8e1` |
| `sahten-mostrador.css` | 14 | `#FFF3CD`/`#FFE0CC` en estados de orden |
| `sahten-menuonline.js` | 1 | **ítems de Categorías (`background:white`)** |
| `sahten-tienda.js` | 4 | fondo del mapa `#e8e8e8`, popups y editor de zonas `white`, borde `#ccc` |
| `sahten-notifications.js` | 2 | panel de notificaciones `white` |
| `sahten-mostrador.js` / `enhancements.js` | 6 | ticket de impresión (`#000`, correcto para papel) |
| `sahten-reportes.css` | 0 | usa variables (bien) |

**Problemas visuales y de navegación**

| Prioridad | Panel | Problema | Solución |
|---|---|---|---|
| A | Menú Online › Categorías | Ítems blancos en modo oscuro | `background:var(--card)` |
| A | Proyección › Guardar nueva | Modal blanco en oscuro y Cancelar roto (B11) | Usar el modal común con clases |
| M | Stock (tarjetas) | Selector de unidad blanco | Clase `.stock-select` con variables |
| M | Tienda | Popups del mapa y editor de zonas blancos | Variables y estilos de Leaflet por tema |
| M | Notificaciones | Panel blanco | Variables |
| M | Navegación | Canales y Tiers están dentro de Ajustes, lejos de Gastos Fijos y Productos, donde se usan | Agrupar el sidebar en Configurar › Producir › Vender › Analizar |
| M | Flujo "producto nuevo" | Pide ir a Ingredientes → Envases → Costo Receta → Productos → Menú Online (5 paneles) | Desde la receta, crear un ingrediente o envase en línea, sin salir |
| M | Números calculados | No se ve de dónde sale un precio | Tooltip "¿De dónde sale?" con el desglose: costo + GF × tier − descuento + canal |
| B | Menú Online › Categorías | Dice "Arrastrá" sin drag | Implementar el drag o cambiar el texto |
| B | Gráficos (Chart.js) | Los colores no cambian con el tema | Leer variables CSS al renderizar |

**Pendiente con la app abierta:** capturas claro/oscuro de cada panel, medición de contraste y overflow de tablas en pantallas angostas.

---

## Cambios propuestos (orden sugerido para la Fase 3)

1. **Números (A):** B1, B4, B4b, B5 → unificar en `computeProjection()`. Además:
   - `recalcRecetaCost` no debe pisar el costo manual,
   - combos con costo manual,
   - `calcEnvCost`/`calcPackCost` → una sola función,
   - protecciones para división por 0 y arrays faltantes.
2. **Arranque vacío (A):** quitar los datos del código (pasan a `samples/`), sacar la dependencia de `TIERS[2]` y `CHANNELS[0]`, y pedir ventas estimadas en el setup.
3. **Datos por proyecto (A):** pasar todas las claves de B6 al estado del proyecto (luego al archivo `.sahten` en la Fase 1). Quitar el monkey-patch de `Storage`.
4. **Stock (A):** descontar al cobrar en el Mostrador y revertir al reabrir.
5. **Reportes (M):** "Actualizar promedios desde ventas reales".
6. **Comisión y USD al estado (M):** B3.
7. **Modo oscuro (M/B):** reemplazar los colores inline por variables. Empezar por Categorías, el modal de nombre, Stock, Tienda y Notificaciones.
8. **Navegación (M):** sidebar agrupado, tooltip "¿De dónde sale?", creación en línea desde la receta.

**Decisiones tomadas (04/10/2026):**
- **B1:** la comisión global se aplica **una sola vez** sobre el precio final de cada canal.
- **B2:** el GF se reparte entre los productos **que el usuario elige**. Hace falta un flag por producto, "Absorbe GF", configurable desde Ventas+GF. Por defecto: todos los productos que no son `recetaOnly`. Hay que corregir el código y el texto del banner.
- **Stock:** el descuento automático es **opcional** (switch en Ajustes). Pendiente definir si se descuenta al cobrar o al pasar a "Listo".
- **Descuentos de GF:** pendiente (suma vs. encadenado).

Otro hallazgo: las filas de descuentos de GF (`renderDiscHistory`) también tienen `background:white` fijo, el mismo problema de modo oscuro.

**Decisiones originales:**
- **B1:** ¿la comisión global debe aplicarse una vez sobre el precio final de cada canal? (Recomendado: sí.)
- **Descuentos de GF:** ¿se suman (10%+10% = 20%) o se encadenan (19%)?
- **B2:** ¿el GF se reparte entre todos los productos (como hace el código) o solo entre los ⭐?
- **Stock:** ¿descontar al cobrar o cuando la orden pasa a "Listo"?
